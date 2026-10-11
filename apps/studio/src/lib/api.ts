import { randomUUID } from "node:crypto";
import { db, ensureDb, transaction } from "./db";
import { assetImageQA,loadMedia,saveUpload } from "./storage";

export class HttpError extends Error { constructor(public status:number,message:string){super(message)} }
function required(v:unknown,name:string){if(typeof v!=="string"||!v.trim())throw new HttpError(400,name+" required");return v.trim()}
function uuid(v:unknown){if(typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw new HttpError(400,"Invalid ID");return v}
function optimistic(version:unknown){if(!Number.isInteger(version)||Number(version)<0)throw new HttpError(400,"Expected integer version");return Number(version)}
async function rows(sql:string,values:unknown[]=[]){return (await db().query(sql,values)).rows}
async function one(sql:string,values:unknown[]=[]){return (await db().query(sql,values)).rows[0]??null}
function assertFound<T>(v:T|null|undefined):T{if(v==null)throw new HttpError(404,"Record not found");return v}
async function jsonBody(req:Request){try{return await req.json() as Record<string,unknown>}catch{throw new HttpError(400,"Invalid JSON")}}
export async function dispatch(req:Request,parts:string[]):Promise<Response>{
 await ensureDb();
 const method=req.method;
 const send=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
 if(parts[0]==="projects"&&parts.length===1&&method==="GET")return send(await rows("SELECT p.*,f.id AS film_id FROM projects p JOIN films f ON f.project_id=p.id ORDER BY p.created_at DESC"));
 if(parts[0]==="projects"&&parts.length===1&&method==="POST"){
  const b=await jsonBody(req), name=required(b.name,"Project name"),idea=typeof b.idea==="string"?b.idea:"";
  const result=await transaction(async c=>{const p=randomUUID(),f=randomUUID();await c.query("INSERT INTO projects(id,name,idea,data_mode) VALUES($1,$2,$3,$4)",[p,name,idea,process.env.CINEWEAVE_TEST_MODE==="1"?"fixture":"production"]);await c.query("INSERT INTO films(id,project_id,title) VALUES($1,$2,$3)",[f,p,name]);return {id:p,filmId:f,name,idea,version:1};});
  return send(result,201);
 }
 if(parts[0]==="projects"&&parts.length===2&&method==="GET"){
  const p=assertFound(await one("SELECT p.*,f.id AS film_id FROM projects p JOIN films f ON f.project_id=p.id WHERE p.id=$1",[uuid(parts[1])]));
  return send(p);
 }
 if(parts[0]==="units"&&parts.length===2&&method==="GET")return send(assertFound(await one("SELECT u.*,r.content FROM script_units u LEFT JOIN script_revisions r ON r.id=u.adopted_revision_id WHERE u.id=$1",[uuid(parts[1])])));
 if(parts[0]==="films"&&parts[2]==="units"&&method==="GET")return send(await rows("SELECT u.*,r.content FROM script_units u LEFT JOIN script_revisions r ON r.id=u.adopted_revision_id WHERE u.film_id=$1 ORDER BY u.position",[uuid(parts[1])]));
 if(parts[0]==="films"&&parts[2]==="units"&&method==="POST"){
  const film=uuid(parts[1]),b=await jsonBody(req);
  const kind=b.kind==="beat"?"beat":b.kind==="scene"?"scene":null;if(!kind)throw new HttpError(400,"kind must be scene or beat");
  const id=randomUUID(),revision=randomUUID(),title=required(b.title,"Title"),content=typeof b.content==="string"?b.content:"",parent=b.parentId?uuid(b.parentId):null;
  await transaction(async c=>{if(parent){const res=await c.query("SELECT id FROM script_units WHERE id=$1 AND film_id=$2 AND kind='scene'",[parent,film]);if(!res.rowCount)throw new HttpError(400,"Invalid parent scene");}
   await c.query("INSERT INTO script_units(id,film_id,kind,parent_id,title,position,adopted_revision_id) VALUES($1,$2,$3,$4,$5,$6,$7)",[id,film,kind,parent,title,Number(b.position)||0,revision]);
   await c.query("INSERT INTO script_revisions(id,unit_id,revision_number,content,source) VALUES($1,$2,1,$3,'creator')",[revision,id,content]);});
  return send({id,kind,title,content,version:1},201);
 }
 if(parts[0]==="units"&&parts[2]==="revisions"&&method==="GET")return send(await rows("SELECT * FROM script_revisions WHERE unit_id=$1 ORDER BY revision_number",[uuid(parts[1])]));
 if(parts[0]==="units"&&parts[2]==="revisions"&&method==="POST"){
  const unit=uuid(parts[1]),b=await jsonBody(req),version=optimistic(b.expectedVersion),content=required(b.content,"Content");
  const data=await transaction(async c=>{const row=await c.query("UPDATE script_units SET version=version+1 WHERE id=$1 AND version=$2 RETURNING id,version",[unit,version]);if(!row.rowCount)throw new HttpError(409,"Stale script version");const revision=randomUUID();await c.query("INSERT INTO script_revisions(id,unit_id,revision_number,content,source,title) VALUES($1,$2,$3,$4,'creator',$5)",[revision,unit,version+1,content,typeof b.title==="string"?b.title:null]);await c.query("UPDATE script_units SET adopted_revision_id=$2,title=COALESCE($3,title) WHERE id=$1",[unit,revision,typeof b.title==="string"?b.title:null]);return {id:revision,version:version+1,content};});
  return send(data,201);
 }
 if(parts[0]==="units"&&parts[2]==="proposals"&&method==="GET")return send(await rows("SELECT * FROM ai_proposals WHERE unit_id=$1 ORDER BY created_at DESC",[uuid(parts[1])]));
 if(parts[0]==="units"&&parts[2]==="proposals"&&method==="POST"){
  const unit=uuid(parts[1]),b=await jsonBody(req),u=assertFound(await one("SELECT u.version,r.content FROM script_units u JOIN script_revisions r ON r.id=u.adopted_revision_id WHERE u.id=$1",[unit]));const kind=typeof b.direction==="string"?b.direction.slice(0,200):"强化戏剧张力";
  // This is deterministic Mock, not a paid LLM or a claim of artistic quality.
  const suggestion=String(u.content)+"\n\n【AI 模拟建议待审】"+kind+"：让人物目标与阻力在该场景中更明确。";
  const id=randomUUID();await db().query("INSERT INTO ai_proposals(id,unit_id,base_version,suggestion,explanation) VALUES($1,$2,$3,$4,$5)",[id,unit,u.version,suggestion,"Mock LLM：不调用真实模型，只演示提案审阅和采纳机制"]);return send({id,baseVersion:u.version,suggestion,status:"pending",mock:true},201);
 }
 if(parts[0]==="proposals"&&parts.length===3&&method==="POST"&&["adopt","reject"].includes(parts[2])){
  const id=uuid(parts[1]),decision=parts[2];const b=await jsonBody(req);
  const result=await transaction(async c=>{
   const q=await c.query("SELECT * FROM ai_proposals WHERE id=$1 FOR UPDATE",[id]);const p=assertFound(q.rows[0]);if(p.status!=="pending")throw new HttpError(409,"Proposal already decided");
   if(decision==="reject"){await c.query("UPDATE ai_proposals SET status='rejected' WHERE id=$1",[id]);return {id,status:"rejected"};}
   if(b.expectedEditVersion!=null&&p.edit_version!==optimistic(b.expectedEditVersion))throw new HttpError(409,'Candidate changed; refresh');
   const revision=randomUUID(),actualVersion=optimistic(b.expectedVersion);if(actualVersion!==p.base_version)throw new HttpError(409,"Proposal based on stale script");
   const u=await c.query("UPDATE script_units SET version=version+1 WHERE id=$1 AND version=$2 RETURNING version",[p.unit_id,p.base_version]);if(!u.rowCount)throw new HttpError(409,"Stale script version");
   await c.query("INSERT INTO script_revisions(id,unit_id,revision_number,content,source) VALUES($1,$2,$3,$4,$5)",[revision,p.unit_id,p.base_version+1,p.suggestion,p.model==="mock"?"mock_ai_adopted":"ai_adopted:"+p.model]);await c.query("UPDATE script_units SET adopted_revision_id=$2 WHERE id=$1",[p.unit_id,revision]);await c.query("UPDATE ai_proposals SET status='adopted' WHERE id=$1",[id]);return {id,status:"adopted",revisionId:revision,version:p.base_version+1};
  });return send(result);
 }
 if(parts[0]==="films"&&parts[2]==="assets"&&method==="GET")return send(await rows("SELECT a.*,m.id AS media_id,m.filename,m.mime FROM assets a LEFT JOIN asset_revisions r ON r.id=a.adopted_revision_id LEFT JOIN media_files m ON m.id=r.media_id WHERE a.film_id=$1 ORDER BY a.created_at",[uuid(parts[1])]));
 if(parts[0]==="films"&&parts[2]==="assets"&&method==="POST"){
  const film=uuid(parts[1]),b=await jsonBody(req);const kind=b.kind;
  if(!["character","location","hero_prop","voice"].includes(String(kind)))throw new HttpError(400,"Invalid asset kind");
  const name=required(b.name,"Asset name"),variant=required(b.variant,"Variant"),id=randomUUID(),rate=b.baselineRate==null?null:Number(b.baselineRate);
  if(rate!=null && (kind!=="voice"||!Number.isFinite(rate)||rate<0.5||rate>2))throw new HttpError(400,"Invalid baseline rate");
  await db().query("INSERT INTO assets(id,film_id,kind,name,variant,description,baseline_rate) VALUES($1,$2,$3,$4,$5,$6,$7)",[id,film,kind,name,variant,typeof b.description==="string"?b.description:"",rate]);return send({id,kind,name,variant,version:0},201);
 }
 if(parts[0]==="assets"&&parts[2]==="revisions"&&method==="GET")return send(await rows("SELECT r.*,m.filename,m.mime,m.width,m.height FROM asset_revisions r LEFT JOIN media_files m ON m.id=r.media_id WHERE r.asset_id=$1 ORDER BY r.revision_number",[uuid(parts[1])]));
 if(parts[0]==="assets"&&parts[2]==="revisions"&&method==="POST"){
  const asset=uuid(parts[1]),b=await jsonBody(req),version=optimistic(b.expectedVersion),media=b.mediaId?uuid(b.mediaId):null,desc=typeof b.description==="string"?b.description:"";
  const result=await transaction(async c=>{
   const a=(await c.query("SELECT * FROM assets WHERE id=$1 FOR UPDATE",[asset])).rows[0];assertFound(a);if(a.version!==version)throw new HttpError(409,"Stale asset version");
   const m=media?(await c.query("SELECT * FROM media_files WHERE id=$1",[media])).rows[0]:null;
   if(media&&!m)throw new HttpError(404,"Media not found");
   if(a.kind!=="voice"&&(!m||!m.mime.startsWith("image/")))throw new HttpError(400,"Image board required");
   if(a.kind==="voice"&&m&&!m.mime.startsWith("audio/"))throw new HttpError(400,"Voice sample must be audio");
   const revision=randomUUID(),qa=assetImageQA(a.kind,m?.width,m?.height);
   await c.query("INSERT INTO asset_revisions(id,asset_id,revision_number,media_id,description,qa_status) VALUES($1,$2,$3,$4,$5,$6)",[revision,asset,version+1,media,desc,qa]);
   await c.query("UPDATE assets SET version=version+1, adopted_revision_id=$2 WHERE id=$1",[asset,revision]);
   return {id:revision,version:version+1,qaStatus:qa,mediaId:media};
  });return send(result,201);
 }
 if(parts[0]==="media"&&parts.length===1&&method==="POST"){
  const data=await req.formData(),file=data.get("file");if(!(file instanceof File))throw new HttpError(400,"file required");
  const m=await saveUpload(file);
  await db().query("INSERT INTO media_files(id,filename,mime,bytes,sha256,storage_path,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[m.id,m.filename,m.mime,m.bytes,m.sha256,m.storagePath,m.width,m.height]);
  return send({id:m.id,name:m.filename,mime:m.mime,bytes:m.bytes,width:m.width,height:m.height,url:"/api/media/"+m.id+"/file"},201);
 }
 if(parts[0]==="media"&&parts[2]==="file"&&method==="GET"){
  const m=assertFound(await one("SELECT * FROM media_files WHERE id=$1",[uuid(parts[1])]));
  const bytes=await loadMedia(m.storage_path);
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":m.mime,"Content-Length":String(bytes.length),"Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});
 }
 throw new HttpError(404,"Unknown route");
}
