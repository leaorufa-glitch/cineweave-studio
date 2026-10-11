import { randomUUID } from "node:crypto";
import { db,ensureDb,transaction } from "./db";
import { saveUpload,assetImageQA } from "./storage";
import { generateStorySuggestion,generateImageBoard,GatewayError } from "./providers";

function bad(status:number,message:string):never{throw new GatewayError(message,status);}
function checkUUID(s:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))bad(400,"Invalid ID");return s;}
async function parse(req:Request){try{return await req.json() as Record<string,unknown>;}catch{bad(400,"Malformed JSON request");}}
function reply(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
function extractDraft(text:string){
 const match=text.match(/【(?:改写|场景改写|剧本改写)】\s*([\s\S]*)/);
 const pre=text.match(/【(?:诊断|建议|问题)】\s*([\s\S]*?)(?=【(?:改写|场景改写|剧本改写)】|$)/);
 return {suggestion:match?.[1]?.trim()||text.trim(),explanation:pre?.[1]?.trim()||"请仔细对比人物目标、冲突、行动和台词，确认后再采纳此 AI 草稿。"};
}
export async function modelDispatch(req:Request,parts:string[]):Promise<Response|null>{
 if(parts[0]!=="ai"&&parts[2]!=="ai-proposals"&&parts[2]!=="generate"&&parts[2]!=="candidates")return null;
 await ensureDb();
 if(parts[0]==="ai"&&parts[1]==="status"&&req.method==="GET"){
  return reply({textConfigured:!!process.env.DARL_API_KEY,imageConfigured:!!process.env.DARL_API_KEY,videoConfigured:!!process.env.DARL_API_KEY,productionH3:"awaiting_self_hosted_server",testH3:"runninghub-minimax-h3"});
 }
 if(parts[0]==="ai"&&parts[1]==="chat"&&req.method==="POST"){
  const b=await parse(req),message=String(b.message||"").trim().slice(0,3000),context=String(b.context||"").trim().slice(0,18000);
  if(!message)bad(400,"Message required");
  const result=await generateStorySuggestion(context,message);
  const film=b.filmId?checkUUID(String(b.filmId)):null;
  if(film){await db().query("INSERT INTO ai_history(id,film_id,model,instruction,answer,usage,input_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)",[randomUUID(),film,result.model,message,result.text,JSON.stringify(result.usage),JSON.stringify({context,message})]);}
  return reply({answer:result.text,model:result.model,usage:result.usage,real:true});
 }
 if(parts[0]==="units"&&parts[2]==="ai-proposals"&&parts.length===3&&req.method==="POST"){
  const unit=checkUUID(parts[1]),b=await parse(req);
  const script=await db().query("SELECT u.film_id,u.version,r.content FROM script_units u JOIN script_revisions r ON r.id=u.adopted_revision_id WHERE u.id=$1",[unit]);
  if(!script.rowCount)bad(404,"Script unit not found");
  const row=script.rows[0],instruction=String(b.direction||"请提高场景的戏剧张力、行动和潜台词").slice(0,3000);
  const context=(await db().query("SELECT u.title,r.content FROM script_units u LEFT JOIN script_revisions r ON r.id=u.adopted_revision_id WHERE u.film_id=$1 ORDER BY position",[row.film_id])).rows;
  const generated=await generateStorySuggestion(JSON.stringify({currentUnit:unit,currentContent:row.content,filmScript:context}),instruction);
  const text=extractDraft(generated.text),id=randomUUID();
  await db().query("INSERT INTO ai_proposals(id,unit_id,base_version,suggestion,explanation,model,usage,input_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[id,unit,row.version,text.suggestion,text.explanation,generated.model,JSON.stringify(generated.usage),JSON.stringify({currentUnit:unit,currentVersion:row.version,currentContent:row.content,filmScript:context,instruction})]);
  return reply({id,status:"pending",baseVersion:row.version,suggestion:text.suggestion,explanation:text.explanation,model:generated.model,real:true},201);
 }
 if(parts[0]==="assets"&&parts.length===3&&parts[2]==="candidates"&&req.method==="GET"){
  const asset=checkUUID(parts[1]);
  const rs=await db().query("SELECT c.*,m.filename,m.mime,m.width,m.height FROM asset_candidates c JOIN media_files m ON m.id=c.media_id WHERE c.asset_id=$1 ORDER BY c.created_at DESC",[asset]);
  return reply(rs.rows);
 }
 if(parts[0]==="assets"&&parts.length===3&&parts[2]==="generate"&&req.method==="POST"){
  const asset=checkUUID(parts[1]),b=await parse(req);
  const rs=await db().query("SELECT * FROM assets WHERE id=$1",[asset]);
  if(!rs.rowCount)bad(404,"Asset not found");
  const a=rs.rows[0];
  if(a.kind==="voice")bad(400,"Voice Identity requires an authorized audio sample; image model is not applicable");
  const desc=String(b.prompt||a.description||a.name).trim();
  if(!desc)bad(400,"Asset prompt missing");
  const generated=await generateImageBoard(a.name+"; "+a.variant+"; "+desc,a.kind);
  const uploaded=await saveUpload(new File([new Uint8Array(generated.bytes)],a.kind+"-board.png",{type:generated.mime}));
  const candidateId=randomUUID(),qa=assetImageQA(a.kind,uploaded.width,uploaded.height);
  await transaction(async c=>{
   await c.query("INSERT INTO media_files(id,filename,mime,bytes,sha256,storage_path,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[uploaded.id,uploaded.filename,uploaded.mime,uploaded.bytes,uploaded.sha256,uploaded.storagePath,uploaded.width,uploaded.height]);
   await c.query("INSERT INTO asset_candidates(id,asset_id,media_id,provider,prompt,qa_status,input_snapshot,provider_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[candidateId,asset,uploaded.id,generated.model,desc,qa,JSON.stringify(generated.inputSnapshot),JSON.stringify({revisedPrompt:generated.revisedPrompt,usage:generated.usage})]);
  });
  return reply({id:candidateId,assetId:asset,mediaId:uploaded.id,url:"/api/media/"+uploaded.id+"/file",width:uploaded.width,height:uploaded.height,qaStatus:qa,adopted:false,provider:generated.model},201);
 }
 return null;
}
