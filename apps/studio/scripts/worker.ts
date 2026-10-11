import { randomUUID } from "node:crypto";
import { ensureDb,db,transaction } from "../src/lib/db.ts";
import { loadMedia,saveVideoOutput } from "../src/lib/storage.ts";
import {renderOneIfWaiting} from "../src/lib/render-worker.ts";
import { createRunningHubVideo,downloadRunningHubVideo,queryRunningHubVideo,uploadRunningHubReference,GatewayError } from "../src/lib/providers.ts";

type Run={id:string,clip_id:string,status:string,provider_job_id:string|null,input_snapshot:{
 prompt:string,seconds:number,aspectRatio:string,referenceMediaIds:string[]
}};
const log=(...v:unknown[])=>console.log("[cineweave-worker]",new Date().toISOString(),...v);
function safeReason(e:unknown){
 return e instanceof GatewayError?e.message.slice(0,250):e instanceof Error?e.name+": "+e.message.slice(0,160):"Unknown worker error";
}
async function storeStatus(runId:string,status:string,snapshot?:unknown,error?:string){
 await db().query("UPDATE video_runs SET status=$2,provider_snapshot=COALESCE($3::jsonb,provider_snapshot),error=$4,updated_at=now() WHERE id=$1",[runId,status,snapshot===undefined?null:JSON.stringify(snapshot),error||null]);
}
async function submit(run:Run){
 log("submitting",run.id);
 try{
  const refs=run.input_snapshot.referenceMediaIds??[];
  const img:string[]=[],audio:string[]=[];let video:string|undefined;
  const uploaded:Array<{mediaId:string,uploadId:string,type:string}>=[];
  for(const mediaId of refs){
   const m=(await db().query("SELECT * FROM media_files WHERE id=$1",[mediaId])).rows[0];
   if(!m)throw new Error("Input media not found: "+mediaId);
   const bytes=await loadMedia(m.storage_path);
   const up=await uploadRunningHubReference(bytes,m.filename,m.mime);
   uploaded.push({mediaId,uploadId:up.id,type:m.mime});
   if(m.mime.startsWith("image/"))img.push(up.id);
   else if(m.mime.startsWith("audio/"))audio.push(up.id);
   else if(m.mime.startsWith("video/")){if(video)throw new Error("RunningHub only accepts one reference video");video=up.id;}
  }
  const s=run.input_snapshot;
  const result=await createRunningHubVideo(s.prompt,s.seconds,s.aspectRatio,img,audio,video);
  await db().query("UPDATE video_runs SET provider_job_id=$2,status=$3,provider_snapshot=$4,error=NULL,updated_at=now() WHERE id=$1",[run.id,result.id,result.status==="queued"?"queued":"in_progress",JSON.stringify({uploads:uploaded,providerInput:result.input})]);
  log("submitted",run.id,"provider_job_id",result.id);
 }catch(e){
  const uncertain=e instanceof GatewayError && e.responseCode==="NETWORK_UNCONFIRMED";
  await storeStatus(run.id,uncertain?"submission_unknown":"failed",undefined,safeReason(e));
  log("submission_error",run.id,uncertain?"requires_review":"failed");
 }
}
async function poll(run:Run){
 if(!run.provider_job_id)return storeStatus(run.id,"submission_unknown",undefined,"Remote ID missing");
 try{
  if(run.status==="awaiting_media"){
   // Avoid submitting a second paid task. Retry only result retrieval.
   return await persistTake(run,run.provider_job_id);
  }
  const remote=await queryRunningHubVideo(run.provider_job_id);
  if(remote.status==="failed")return await storeStatus(run.id,"failed",remote,"Provider generation failed");
  if(remote.status==="completed")return await persistTake(run,run.provider_job_id,remote);
  return await storeStatus(run.id,remote.status,remote);
 }catch(e){
  // A transient status-query failure does not prove the video is completed.
  await storeStatus(run.id,run.status,undefined,safeReason(e));
  log("poll_error",run.id,safeReason(e));
 }
}
async function persistTake(run:Run,providerId:string,remote?:unknown){
 try{
  const bytes=await downloadRunningHubVideo(providerId);
  const media=await saveVideoOutput(bytes,"H3-"+run.id+".mp4");
  const takeId=randomUUID();
  await transaction(async c=>{
   await c.query("INSERT INTO media_files(id,filename,mime,bytes,sha256,storage_path,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[media.id,media.filename,media.mime,media.bytes,media.sha256,media.storagePath,null,null]);
   await c.query("INSERT INTO video_takes(id,run_id,media_id,qa_status) VALUES($1,$2,$3,'needs_review') ON CONFLICT(run_id) DO NOTHING",[takeId,run.id,media.id]);
   await c.query("UPDATE video_runs SET status='completed',provider_snapshot=COALESCE($2::jsonb,provider_snapshot),error=NULL,updated_at=now() WHERE id=$1",[run.id,remote===undefined?null:JSON.stringify(remote)]);
  });
  log("take_saved",run.id,"bytes",bytes.length);
 }catch(e){
  await storeStatus(run.id,"awaiting_media",remote,safeReason(e));
  log("media_error",run.id,safeReason(e));
 }
}
async function tick(){
 await ensureDb();
 const claim=await db().query(`WITH to_submit AS (
  SELECT id FROM video_runs WHERE status='waiting_submit' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
 ) UPDATE video_runs SET status='submitting',attempts=attempts+1,updated_at=now()
 WHERE id IN(SELECT id FROM to_submit) RETURNING *`);
 if(claim.rows.length)await submit(claim.rows[0] as Run);
 const running=(await db().query("SELECT * FROM video_runs WHERE status IN ('queued','in_progress','awaiting_media') AND updated_at < now()-interval '8 seconds' ORDER BY updated_at LIMIT 5")).rows as Run[];
 for(const run of running)await poll(run);
 await renderOneIfWaiting();
}
let stopped=false;process.on("SIGTERM",()=>{stopped=true});process.on("SIGINT",()=>{stopped=true});
log("starting",process.argv.includes("--once")?"once":"continuous");
do {
 try{await tick()}catch(e){log("tick_error",safeReason(e))}
 if(process.argv.includes("--once"))break;
 await new Promise(resolve=>setTimeout(resolve,7500));
}while(!stopped);
log("stopped");
