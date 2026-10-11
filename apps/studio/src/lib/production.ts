import {randomUUID} from "node:crypto";
import { db,ensureDb,transaction } from "./db";
import {probeMedia} from "./media-qa";
import {GatewayError} from "./providers";
const id=(v:string)=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw new GatewayError("Invalid ID",400);return v;};
const fail=(s:number,m:string):never=>{throw new GatewayError(m,s);};
const response=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{"Cache-Control":"no-store"}});
const json=async(req:Request):Promise<Record<string,unknown>>=>{try{return await req.json() as Record<string,unknown>}catch{return fail(400,"Invalid JSON");}};
const required=(v:unknown,n:string):string=>typeof v==="string"&&v.trim()?v.trim():fail(400,n+" required");
async function filmExists(film:string){const r=await db().query("SELECT id FROM films WHERE id=$1",[film]);if(!r.rowCount)fail(404,"Film not found");}
const ratioOptions=["16:9","9:16","1:1","2:3","3:2","3:4","4:3","21:9"];
export async function productionDispatch(req:Request,parts:string[]):Promise<Response|null>{
 if(!["films","clips","runs","takes","renders"].includes(parts[0]))return null;
 await ensureDb();
 const method=req.method;
 if(parts[0]==="films"&&parts.length===3&&parts[2]==="shots"){
  const film=id(parts[1]);
  if(method==="GET")return response((await db().query("SELECT * FROM director_shots WHERE film_id=$1 ORDER BY sequence_number,created_at",[film])).rows);
  if(method==="POST"){
   const b=await json(req),shotId=randomUUID(),title=required(b.title,"Shot title");
   await filmExists(film);
   const scene=b.sceneUnitId?id(String(b.sceneUnitId)):null;
   if(scene){const parent=await db().query("SELECT id FROM script_units WHERE id=$1 AND film_id=$2 AND kind='scene'",[scene,film]);if(!parent.rowCount)fail(400,"Scene belongs to another film");}
   await transaction(async client=>{const s=(await client.query("INSERT INTO director_shots(id,film_id,scene_unit_id,title,description,sequence_number) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[shotId,film,scene,title,String(b.description||""),Number(b.sequenceNumber)||0])).rows[0];await client.query('INSERT INTO shot_revisions(id,shot_id,revision_number,snapshot) VALUES($1,$2,1,$3)',[randomUUID(),shotId,JSON.stringify(s)]);});
   return response({id:shotId,filmId:film,title,version:1},201);
  }
 }
 if(parts[0]==="films"&&parts.length===3&&parts[2]==="clips"){
  const film=id(parts[1]);
  if(method==="GET")return response((await db().query("SELECT c.*,t.media_id AS adopted_media_id FROM generation_clips c LEFT JOIN video_takes t ON t.id=c.adopted_take_id WHERE film_id=$1 ORDER BY created_at",[film])).rows);
  if(method==="POST"){
   const b=await json(req),clipId=randomUUID(),title=required(b.title,"Clip title"),prompt=required(b.prompt,"Clip prompt");
   const seconds=Number(b.seconds);
   if(!Number.isInteger(seconds)||seconds<4||seconds>15)fail(400,"Clip length must be an integer 4–15 seconds");
   const ratio=String(b.aspectRatio||"16:9");if(!ratioOptions.includes(ratio))fail(400,"Invalid aspect ratio");
   const refsInput:unknown=b.referenceMediaIds??[];
   if(!Array.isArray(refsInput)||refsInput.length>10||refsInput.some(x=>typeof x!=="string"))fail(400,"Invalid references");
   const refs=refsInput as string[];
   await filmExists(film);
   const scene=b.sceneUnitId?id(String(b.sceneUnitId)):null;
   if(scene){const p=await db().query("SELECT id FROM script_units WHERE id=$1 AND film_id=$2 AND kind='scene'",[scene,film]);if(!p.rowCount)fail(400,"Scene belongs to another film");}
   const parent=b.continuationParentClipId?id(String(b.continuationParentClipId)):null;
   if(parent){const p=await db().query("SELECT id FROM generation_clips WHERE id=$1 AND film_id=$2",[parent,film]);if(!p.rowCount)fail(400,"Continuation parent belongs to another film");}
   if(refs.length){const found=await db().query("SELECT id FROM media_files WHERE id=ANY($1::uuid[])",[refs.map(x=>id(x))]);if(found.rowCount!==refs.length)fail(400,"Reference media not found");}
   await db().query("INSERT INTO generation_clips(id,film_id,scene_unit_id,title,prompt,seconds,aspect_ratio,reference_media_ids,continuation_parent_clip_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[clipId,film,scene,title,prompt,seconds,ratio,JSON.stringify(refs),parent]);
   return response({id:clipId,filmId:film,title,prompt,seconds,aspectRatio:ratio,continuationParentClipId:parent,version:1},201);
  }
 }
 if(parts[0]==="clips"&&parts.length===3&&parts[2]==="shots"&&method==="GET"){
  return response((await db().query("SELECT l.*,s.title,s.description FROM clip_shots l JOIN director_shots s ON s.id=l.shot_id WHERE l.clip_id=$1 ORDER BY clip_start_seconds",[id(parts[1])])).rows);
 }
 if(parts[0]==="clips"&&parts.length===3&&parts[2]==="shots"&&method==="POST"){
  const clip=id(parts[1]),b=await json(req),shot=id(required(b.shotId,"Shot ID"));
  const start=Number(b.clipStartSeconds),end=Number(b.clipEndSeconds);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)fail(400,"Invalid Shot interval");
  await transaction(async client=>{
   const pair=await client.query("SELECT c.film_id,c.seconds,c.version,s.film_id AS shot_film FROM generation_clips c CROSS JOIN director_shots s WHERE c.id=$1 AND s.id=$2 FOR UPDATE OF c",[clip,shot]);
   if(!pair.rowCount)fail(404,"Clip or Shot not found");if(pair.rows[0].film_id!==pair.rows[0].shot_film||end>pair.rows[0].seconds)fail(400,"Shot belongs to another film or exceeds Clip");if(b.expectedVersion!=null&&Number(b.expectedVersion)!==pair.rows[0].version)fail(409,'Clip changed');
   await client.query("INSERT INTO clip_shots(clip_id,shot_id,clip_start_seconds,clip_end_seconds) VALUES($1,$2,$3,$4)",[clip,shot,start,end]);
   const current=(await client.query('UPDATE generation_clips SET version=version+1 WHERE id=$1 RETURNING *',[clip])).rows[0];const links=(await client.query('SELECT * FROM clip_shots WHERE clip_id=$1 ORDER BY clip_start_seconds',[clip])).rows;
   await client.query('INSERT INTO clip_revisions(id,clip_id,revision_number,snapshot) VALUES($1,$2,$3,$4)',[randomUUID(),clip,current.version,JSON.stringify({...current,shots:links})]);
  });
  return response({clipId:clip,shotId:shot,start,end},201);
 }
 if(parts[0]==="clips"&&parts.length===3&&parts[2]==="runs"){
  const clip=id(parts[1]);
  if(method==="GET")return response((await db().query("SELECT r.*,t.id AS take_id,t.media_id FROM video_runs r LEFT JOIN video_takes t ON t.run_id=r.id WHERE r.clip_id=$1 ORDER BY r.created_at DESC",[clip])).rows);
  if(method==="POST"){
   const b=await json(req),key=required(req.headers.get("Idempotency-Key")??b.intentKey,"Idempotency-Key");
   if(key.length<8||key.length>128)fail(400,"Idempotency-Key must contain 8–128 characters");
   const outcome=await transaction(async client=>{
    const c=(await client.query("SELECT * FROM generation_clips WHERE id=$1 FOR UPDATE",[clip])).rows[0];if(!c)fail(404,"Clip not found");
    const previous=(await client.query("SELECT * FROM video_runs WHERE clip_id=$1 AND intent_key=$2",[clip,key])).rows[0];if(previous)return {result:previous,created:false};
    if((await client.query("SELECT id FROM video_runs WHERE clip_id=$1 AND status IN ('waiting_submit','preparing','submitting','submission_unknown','queued','in_progress','awaiting_media','media_failed')",[clip])).rowCount)fail(409,'Resolve the existing submission or retrieve its media before creating another paid Run');
    if(c.continuation_parent_clip_id)fail(409,"This Clip requires native Motion Context continuation. RunningHub does not support it.");
    const mediaIds=c.reference_media_ids as string[];
    const selectedRevisions=Array.isArray(c.plan?.referenceRevisionIds)?c.plan.referenceRevisionIds:[];
    const references=(await client.query("SELECT DISTINCT ON (m.id) m.id AS media_id,m.sha256,m.mime,r.id AS revision_id,r.revision_number,r.content_qa,a.id AS asset_id,COALESCE(r.metadata->>'name',a.name) AS name,a.kind,COALESCE(r.metadata->>'variant',a.variant) AS variant,r.description,COALESCE((r.metadata->>'baselineRate')::numeric,a.baseline_rate) AS baseline_rate FROM asset_revisions r JOIN assets a ON a.id=r.asset_id JOIN media_files m ON m.id=r.media_id WHERE a.film_id=$1 AND r.media_id=ANY($2::uuid[]) AND (cardinality($3::uuid[])=0 OR r.id=ANY($3::uuid[])) ORDER BY m.id,r.created_at DESC",[c.film_id,mediaIds,selectedRevisions])).rows;
    if(mediaIds.some(id=>!references.some(r=>r.media_id===id)))fail(400,"Reference must be a formal media version in this Film");
    if(references.some(r=>r.content_qa?.status==='needs_changes'))fail(409,"Reference asset needs changes");
    if(references.filter(r=>r.mime.startsWith('image/')).length>6||references.filter(r=>r.mime.startsWith('audio/')).length>3)fail(400,"RunningHub supports up to six images and three audio references");
    const shots=(await client.query("SELECT l.*,s.version,s.title,s.description,s.design FROM clip_shots l JOIN director_shots s ON s.id=l.shot_id WHERE clip_id=$1 ORDER BY clip_start_seconds",[clip])).rows;
    const script=(await client.query("SELECT u.id,u.title,u.version,u.adopted_revision_id,r.content FROM script_units u LEFT JOIN script_revisions r ON r.id=u.adopted_revision_id WHERE u.film_id=$1 ORDER BY position",[c.film_id])).rows;
    const snap={clipId:clip,clipVersion:c.version,filmId:c.film_id,prompt:c.prompt,seconds:c.seconds,aspectRatio:c.aspect_ratio,referenceMediaIds:mediaIds,references,shots,script,plan:c.plan,model:"runninghub-minimax-h3",routeRole:'temporary_test',nativeContinuation:false,preferences:{targetResolution:'480P',steps:20},routeParameters:{megapixels:0.4,upscale:1,stepsExposed:false}};
    const result=(await client.query("INSERT INTO video_runs(id,clip_id,provider,intent_key,input_snapshot) VALUES($1,$2,'runninghub',$3,$4) RETURNING *",[randomUUID(),clip,key,JSON.stringify(snap)])).rows[0];return {result,created:true};
   });
   const {result,created}=outcome;
   return response({id:result.id,clipId:clip,status:result.status,providerJobId:result.provider_job_id,alreadyExists:!created},created?201:200);
  }
 }
 if(parts[0]==="runs"&&parts.length===2&&method==="GET"){
  const run=id(parts[1]);
  const r=await db().query("SELECT r.*,c.title AS clip_title,c.seconds,t.id AS take_id,t.media_id FROM video_runs r JOIN generation_clips c ON c.id=r.clip_id LEFT JOIN video_takes t ON t.run_id=r.id WHERE r.id=$1",[run]);
  if(!r.rowCount)fail(404,"Run not found");
  return response(r.rows[0]);
 }
 if(parts[0]==="runs"&&parts.length===3&&parts[2]==="takes"&&method==="GET"){
  const run=id(parts[1]);return response((await db().query("SELECT t.*,m.filename,m.mime,m.bytes FROM video_takes t JOIN media_files m ON m.id=t.media_id WHERE t.run_id=$1",[run])).rows);
 }
 if(parts[0]==="takes"&&parts.length===3&&parts[2]==="adopt"&&method==="POST"){
  const take=id(parts[1]),b=await json(req),version=Number(b.expectedClipVersion);
  if(!Number.isInteger(version)||version<1)fail(400,"expectedClipVersion is required");
  return response(await transaction(async client=>{
   const owner=await client.query("SELECT r.clip_id FROM video_takes t JOIN video_runs r ON r.id=t.run_id WHERE t.id=$1",[take]);
   if(!owner.rowCount)fail(404,"Take not found");
   const clip=owner.rows[0].clip_id;
   // Serialize competing Take adoption by Clip before touching its Take rows.
   await client.query("SELECT id FROM generation_clips WHERE id=$1 FOR UPDATE",[clip]);
   const res=await client.query("SELECT t.id,t.qa_status FROM video_takes t WHERE t.id=$1 FOR UPDATE OF t",[take]);
   if(!res.rowCount)fail(404,"Take not found");
   if(res.rows[0].qa_status==='needs_changes')fail(409,"Take needs changes; finish review before adopting");
   const updated=await client.query("UPDATE generation_clips SET adopted_take_id=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING version",[take,clip,version]);
   if(!updated.rowCount)fail(409,"Clip modified elsewhere, refresh before adopting");
   await client.query("UPDATE video_takes SET adopted=(id=$1) WHERE run_id IN(SELECT id FROM video_runs WHERE clip_id=$2)",[take,clip]);
   return {takeId:take,clipId:clip,version:updated.rows[0].version,adopted:true};
  }));
 }
 if(parts[0]==="films"&&parts.length===3&&parts[2]==="timeline"){
  const film=id(parts[1]);
  if(method==="GET")return response((await db().query("SELECT l.*,m.id AS media_id,m.mime,m.filename,c.title AS clip_title FROM timeline_segments l JOIN video_takes t ON t.id=l.take_id JOIN media_files m ON m.id=t.media_id LEFT JOIN generation_clips c ON c.id=l.clip_id WHERE l.film_id=$1 ORDER BY position_index",[film])).rows);
  if(method==="POST"){
   const b=await json(req),take=id(required(b.takeId,"Take ID")),pos=Number(b.positionIndex);if(!Number.isInteger(pos)||pos<0)fail(400,'Invalid position');
   const result=await transaction(async client=>{
    const f=(await client.query('SELECT * FROM films WHERE id=$1 FOR UPDATE',[film])).rows[0];if(!f)fail(404,'Film not found');if(b.expectedTimelineVersion!=null&&Number(b.expectedTimelineVersion)!==f.timeline_version)fail(409,'Timeline changed');
    const t=(await client.query('SELECT t.*,r.clip_id,c.film_id,m.storage_path,m.technical_qa FROM video_takes t JOIN video_runs r ON r.id=t.run_id JOIN generation_clips c ON c.id=r.clip_id JOIN media_files m ON m.id=t.media_id WHERE t.id=$1 FOR SHARE OF t',[take])).rows[0];
    if(!t||t.film_id!==film)fail(400,'Take does not belong to Film');if(!t.adopted||t.qa_status==='needs_changes')fail(409,'Only adopted non-rejected Takes can enter timeline');
    const qa=t.technical_qa??await probeMedia(t.storage_path),start=Number(b.sourceInSeconds??0),end=Number(b.sourceOutSeconds??qa.duration);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>Number(qa.duration)+.1)fail(400,'Invalid source trim');const segment=randomUUID();
    await client.query('INSERT INTO timeline_segments(id,film_id,clip_id,take_id,position_index,source_in_seconds,source_out_seconds) VALUES($1,$2,$3,$4,$5,$6,$7)',[segment,film,t.clip_id,take,pos,start,end]);await client.query('UPDATE films SET timeline_version=timeline_version+1 WHERE id=$1',[film]);
    const snapshot=(await client.query('SELECT * FROM timeline_segments WHERE film_id=$1 ORDER BY position_index,created_at',[film])).rows;await client.query('INSERT INTO timeline_revisions(id,film_id,revision_number,snapshot) VALUES($1,$2,$3,$4)',[randomUUID(),film,f.timeline_version+1,JSON.stringify(snapshot)]);return {id:segment,filmId:film,takeId:take,positionIndex:pos,version:f.timeline_version+1};
   });return response(result,201);
  }
 }
 if(parts[0]==="films"&&parts.length===3&&parts[2]==="renders"){
  const film=id(parts[1]);
  if(method==="GET")return response((await db().query("SELECT id,film_id,intent_key,status,output_media_id,error,created_at,updated_at FROM renders WHERE film_id=$1 ORDER BY created_at DESC",[film])).rows);
  if(method==="POST"){
   const b=await json(req);
   const intent=required(req.headers.get("Idempotency-Key")??b.intentKey,"Idempotency-Key");
   if(intent.length<8||intent.length>128)fail(400,"Invalid Render intent key");
   const outcome=await transaction(async client=>{
    const f=(await client.query('SELECT * FROM films WHERE id=$1 FOR UPDATE',[film])).rows[0];if(!f)fail(404,'Film not found');
    const existing=(await client.query('SELECT * FROM renders WHERE film_id=$1 AND intent_key=$2',[film,intent])).rows[0];if(existing)return {result:existing,created:false};
    const segments=(await client.query("SELECT l.id,l.position_index,l.take_id,l.source_in_seconds,l.source_out_seconds,l.volume,l.fade_in_seconds,l.fade_out_seconds,m.id AS media_id,m.sha256,m.mime,m.technical_qa,t.adopted,t.qa_status FROM timeline_segments l JOIN video_takes t ON t.id=l.take_id JOIN media_files m ON m.id=t.media_id WHERE l.film_id=$1 ORDER BY l.position_index FOR SHARE OF t",[film])).rows;
    if(!segments.length)fail(409,"Timeline has no adopted video segments");if(segments.some(s=>!s.adopted||s.mime!=="video/mp4"||s.qa_status==='needs_changes'))fail(409,"Timeline includes an unadopted or rejected Take");
    const settings={format:'mp4',width:1280,height:720,fps:24,timelineVersion:f.timeline_version,qualityStatus:segments.every(s=>s.qa_status==='accepted')?'reviewed':'needs_review',snapshotSegments:segments};
    const result=(await client.query('INSERT INTO renders(id,film_id,intent_key,settings) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),film,intent,JSON.stringify(settings)])).rows[0];return {result,created:true};
   });
   return response({id:outcome.result.id,status:outcome.result.status,filmId:film,alreadyExists:!outcome.created},outcome.created?201:200);
  }
 }
 if(parts[0]==="renders"&&parts.length===2&&method==="GET"){
  const render=id(parts[1]);const r=await db().query("SELECT id,film_id,status,settings,output_media_id,error,created_at,updated_at FROM renders WHERE id=$1",[render]);
  if(!r.rowCount)fail(404,"Render not found");
  const value=r.rows[0];
  return response({...value,outputUrl:value.output_media_id?"/api/media/"+value.output_media_id+"/file":null});
 }
 return null;
}
