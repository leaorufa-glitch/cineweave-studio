import {randomUUID,createHash} from 'node:crypto';
import {rm} from 'node:fs/promises';
import {db,ensureDb,transaction} from './db.ts';
import {loadMedia,saveVideoOutput} from './storage.ts';
import {probeMedia} from './media-qa.ts';
import {createRunningHubVideo,downloadRunningHubVideo,queryRunningHubVideo,uploadRunningHubReference,GatewayError,validateH3Request,gatewayConfig} from './providers.ts';
export type Run={id:string,clip_id:string,status:string,lease_token:string,provider_job_id:string|null,input_snapshot:{prompt:string,seconds:number,aspectRatio:string,referenceMediaIds:string[],references?:Array<{media_id:string,sha256:string}>}};
export type VideoProvider={upload:typeof uploadRunningHubReference,create:typeof createRunningHubVideo,query:typeof queryRunningHubVideo,download:typeof downloadRunningHubVideo};
const live:VideoProvider={upload:uploadRunningHubReference,create:createRunningHubVideo,query:queryRunningHubVideo,download:downloadRunningHubVideo};
export const safeReason=(e:unknown)=>e instanceof GatewayError?'Gateway request failed (HTTP '+e.status+', '+(e.responseCode??'provider_error')+')':e instanceof Error?e.name+': task processing failed; inspect media and input validation':'Task processing failed';
const safeProviderError=(e:unknown)=>e instanceof GatewayError?{kind:'gateway_error',status:e.status,responseCode:e.responseCode??null,requestId:e.requestId??null}:e instanceof Error?{kind:e.name,message:'task processing failed'}:{kind:'unknown_error'};
export async function recoverExpiredJobs(){
 await ensureDb();
 // Legacy submitting/rendering jobs have no leases. Never guess that paid submission did not happen.
 await db().query(`UPDATE video_runs SET status=CASE WHEN provider_job_id IS NOT NULL THEN 'queued' WHEN status='preparing' THEN 'waiting_submit' ELSE 'submission_unknown' END,error=CASE WHEN provider_job_id IS NULL AND status='submitting' THEN 'Worker stopped during submission; reconcile remote job before retrying' ELSE error END,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE status IN ('preparing','submitting') AND (lease_expires_at IS NULL OR lease_expires_at<now())`);
 await db().query("UPDATE video_runs SET lease_token=NULL,lease_expires_at=NULL WHERE lease_expires_at<now() AND status IN ('queued','in_progress','awaiting_media')");
 await db().query("UPDATE renders SET status='waiting_render',lease_token=NULL,lease_expires_at=NULL,error='Recovered interrupted local render',updated_at=now() WHERE status='rendering' AND (lease_expires_at IS NULL OR lease_expires_at<now())");
}
export async function claimVideoJob(submitting:boolean):Promise<Run|null>{
 const token=randomUUID();const where=submitting?"status='waiting_submit'":"status IN ('queued','in_progress','awaiting_media') AND next_poll_at<=now()";
 const result=await db().query(`WITH picked AS(SELECT id FROM video_runs WHERE ${where} AND (lease_expires_at IS NULL OR lease_expires_at<now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) UPDATE video_runs SET status=CASE WHEN $2 THEN 'preparing' ELSE status END,lease_token=$1,lease_expires_at=now()+interval '5 minutes',heartbeat_at=now(),attempts=attempts+CASE WHEN $2 THEN 1 ELSE 0 END,updated_at=now() WHERE id IN(SELECT id FROM picked) RETURNING *`,[token,submitting]);return result.rows[0]??null;
}
async function finish(run:Run,status:string,error:string|null=null,snapshot?:unknown){
 await db().query("UPDATE video_runs SET status=$3,error=$4,provider_snapshot=COALESCE(provider_snapshot,'{}')||COALESCE($5::jsonb,'{}'),lease_token=NULL,lease_expires_at=NULL,next_poll_at=now()+interval '180 seconds',updated_at=now() WHERE id=$1 AND lease_token=$2",[run.id,run.lease_token,status,error,snapshot?JSON.stringify({remote:snapshot}):null]);
}
export async function withJobHeartbeat<T>(table:'video_runs'|'renders',id:string,token:string,work:()=>Promise<T>){
 const timer=setInterval(()=>{db().query(`UPDATE ${table} SET heartbeat_at=now(),lease_expires_at=now()+interval '5 minutes' WHERE id=$1 AND lease_token=$2`,[id,token]).catch(()=>{});},30000);
 try{return await work()}finally{clearInterval(timer);}
}
export async function submitVideo(run:Run,provider:VideoProvider=live){
 let submissionStarted=false;
 try{
  if(provider===live)gatewayConfig();
  const images:string[]=[],audio:string[]=[];let video:string|undefined;const uploaded=[];
  for(const mediaId of run.input_snapshot.referenceMediaIds??[]){
   const m=(await db().query('SELECT * FROM media_files WHERE id=$1',[mediaId])).rows[0];if(!m)throw new Error('Reference missing');const bytes=await loadMedia(m.storage_path),frozen=run.input_snapshot.references?.find(x=>x.media_id===mediaId);
   if(frozen&&createHash('sha256').update(bytes).digest('hex')!==frozen.sha256)throw new Error('Frozen reference hash changed');
   const upload=await provider.upload(bytes,m.filename,m.mime);uploaded.push({mediaId,uploadId:upload.id,type:m.mime});
   if(m.mime.startsWith('image/'))images.push(upload.id);else if(m.mime.startsWith('audio/'))audio.push(upload.id);else if(m.mime.startsWith('video/')){if(video)throw new Error('Only one reference video allowed');video=upload.id;}else throw new Error('Unsupported reference');
  }
  const s=run.input_snapshot;const input=validateH3Request({prompt:s.prompt,seconds:s.seconds,aspectRatio:s.aspectRatio,referenceImages:images,referenceAudio:audio,referenceVideo:video});
  const guard=await db().query("UPDATE video_runs SET status='submitting',submission_started_at=now(),provider_snapshot=$3,updated_at=now() WHERE id=$1 AND lease_token=$2 RETURNING id",[run.id,run.lease_token,JSON.stringify({uploads:uploaded,providerInput:input})]);if(!guard.rowCount)return;
  submissionStarted=true;
  const result=await provider.create(s.prompt,s.seconds,s.aspectRatio,images,audio,video);
  // If this persistence fails, the lease recovery places the job in unknown; it never resubmits.
  await db().query("UPDATE video_runs SET provider_job_id=$3,status='queued',lease_token=NULL,lease_expires_at=NULL,error=NULL,next_poll_at=now()+interval '180 seconds',updated_at=now() WHERE id=$1 AND lease_token=$2",[run.id,run.lease_token,result.id]);
 }catch(e){const uncertain=submissionStarted&&(!(e instanceof GatewayError)||e.status>=500||e.status===408||e.responseCode==='NETWORK_UNCONFIRMED');await finish(run,uncertain?'submission_unknown':'failed',safeReason(e),{submissionError:safeProviderError(e)});}
}
export async function persistVideoTake(run:Run,bytes:Uint8Array,remote?:unknown){
 const existing=await db().query('SELECT id FROM video_takes WHERE run_id=$1',[run.id]);if(existing.rowCount){await finish(run,'completed',null,remote);return;}
 const media=await saveVideoOutput(bytes,'H3-'+run.id+'.mp4');let committed=false;
 try{
  const qa=await probeMedia(media.storagePath);if(!qa.video)throw new Error('Video stream required');
  await transaction(async c=>{const owned=await c.query('SELECT id FROM video_runs WHERE id=$1 AND lease_token=$2 AND lease_expires_at>now() FOR UPDATE',[run.id,run.lease_token]);if(!owned.rowCount)return;const previous=await c.query('SELECT id FROM video_takes WHERE run_id=$1',[run.id]);if(previous.rowCount)return;
   await c.query('INSERT INTO media_files(id,filename,mime,bytes,sha256,storage_path,width,height,technical_qa) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[media.id,media.filename,media.mime,media.bytes,media.sha256,media.storagePath,qa.width,qa.height,JSON.stringify(qa)]);
   await c.query("INSERT INTO video_takes(id,run_id,media_id,qa_status) VALUES($1,$2,$3,'needs_review')",[randomUUID(),run.id,media.id]);
   await c.query("UPDATE video_runs SET status='completed',lease_token=NULL,lease_expires_at=NULL,error=NULL,provider_snapshot=COALESCE(provider_snapshot,'{}')||$3::jsonb,updated_at=now() WHERE id=$1 AND lease_token=$2",[run.id,run.lease_token,JSON.stringify({remote:remote??null,mediaQA:qa})]);committed=true;
  });
 }catch(e){await finish(run,'media_failed',safeReason(e),remote);}
 finally{if(!committed)await rm(media.storagePath,{force:true});}
}
export async function pollVideo(run:Run,provider:VideoProvider=live){
 if(!run.provider_job_id)return finish(run,'submission_unknown','Remote ID missing');
 try{
  const remote=run.status==='awaiting_media'?undefined:await provider.query(run.provider_job_id);
  if(remote?.status==='failed')return finish(run,'failed','Provider generation failed',remote);
  if(!remote||remote.status==='completed'){
   let bytes:Uint8Array;try{bytes=await provider.download(run.provider_job_id)}catch(e){return finish(run,'awaiting_media',safeReason(e),remote);}
   return persistVideoTake(run,bytes,remote);
  }
  await finish(run,remote.status,null,remote);
 }catch(e){await finish(run,run.status,safeReason(e));}
}
export async function videoTick(provider:VideoProvider=live){
 await recoverExpiredJobs();const submit=await claimVideoJob(true);if(submit)await withJobHeartbeat('video_runs',submit.id,submit.lease_token,()=>submitVideo(submit,provider));
 for(let i=0;i<5;i++){const run=await claimVideoJob(false);if(!run)break;await withJobHeartbeat('video_runs',run.id,run.lease_token,()=>pollVideo(run,provider));}
}
