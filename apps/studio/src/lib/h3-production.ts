import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {db,transaction} from './db.ts';
import {GatewayError} from './providers.ts';
import {compileH3,H3_ROUTES,type AudiovisualExecutionPlan,type H3Mode,type CompileInput,type FormalReference} from './h3-compiler.ts';

const fail=(status:number,message:string):never=>{throw new GatewayError(message,status);};
const modes: H3Mode[]=['T2VA','I2VA','FL2VA','L2VA','Ref2VA'];
export const h3Mode=(value:unknown):H3Mode=>typeof value==='string'&&modes.includes(value as H3Mode)?value as H3Mode:fail(400,'Choose a valid H3 generation mode');
export const h3Provider=(value:unknown):string=>typeof value==='string'&&value in H3_ROUTES?value:fail(400,'Choose a known H3 route');
type Queryable=Pick<PoolClient,'query'>;

export async function loadCompileInput(client:Queryable,clipId:string,mode:H3Mode,provider:string):Promise<CompileInput>{
 const clip=(await client.query('SELECT * FROM generation_clips WHERE id=$1',[clipId])).rows[0];
 if(!clip)fail(404,'Clip not found');
 const mediaIds=Array.isArray(clip.reference_media_ids)?clip.reference_media_ids as string[]:[];
 const revisionIds=Array.isArray(clip.plan?.referenceRevisionIds)?clip.plan.referenceRevisionIds as string[]:[];
 if(new Set(mediaIds).size!==mediaIds.length||new Set(revisionIds).size!==revisionIds.length||mediaIds.length!==revisionIds.length)fail(409,'Select one distinct formal asset revision per media reference');
 const rows=revisionIds.length?(await client.query("SELECT r.id AS revision_id,r.media_id,m.sha256,m.mime,a.id AS asset_id,a.kind AS asset_kind,COALESCE(r.metadata->>'name',a.name) AS asset_name,r.description,r.content_qa FROM asset_revisions r JOIN assets a ON a.id=r.asset_id JOIN media_files m ON m.id=r.media_id WHERE a.film_id=$1 AND r.id=ANY($2::uuid[])",[clip.film_id,revisionIds])).rows:[];
 const byId=new Map(rows.map(row=>[row.revision_id,row]));
 if(rows.length!==revisionIds.length)fail(409,'A selected formal asset revision is missing');
 const references:FormalReference[]=revisionIds.map((revisionId,index)=>{
  const r=byId.get(revisionId);
  if(!r||r.media_id!==mediaIds[index])fail(409,'Asset revision and MediaFile selection differ');
  if(r.content_qa?.status==='needs_changes')fail(409,'Selected formal asset needs changes');
  return {assetId:r.asset_id,revisionId:r.revision_id,mediaId:r.media_id,sha256:r.sha256,mime:r.mime,assetKind:r.asset_kind,assetName:r.asset_name,description:r.description};
 });
 const shotSpans=(await client.query('SELECT l.shot_id,l.clip_start_seconds,l.clip_end_seconds,s.version,s.title,s.description,s.design FROM clip_shots l JOIN director_shots s ON s.id=l.shot_id AND s.film_id=$2 WHERE l.clip_id=$1 ORDER BY l.clip_start_seconds,l.shot_id',[clipId,clip.film_id])).rows.map(s=>({shotId:s.shot_id,startSeconds:Number(s.clip_start_seconds),endSeconds:Number(s.clip_end_seconds),version:s.version,title:s.title,description:s.description,design:s.design}));
 const scriptRevisions=(await client.query('SELECT adopted_revision_id AS id,version FROM script_units WHERE film_id=$1 AND adopted_revision_id IS NOT NULL ORDER BY position,id',[clip.film_id])).rows;
 const plan=clip.plan?.executionPlan;
 if(!plan||typeof plan!=='object'||Array.isArray(plan))fail(409,'Save the Audiovisual Execution Plan in workspace 4');
 return {mode,seconds:clip.seconds,plan:plan as AudiovisualExecutionPlan,references,shotSpans,source:{clipId,clipVersion:clip.version,filmId:clip.film_id,scriptRevisions,continuationParentClipId:clip.continuation_parent_clip_id},provider};
}

export async function previewH3(clipId:string,mode:unknown,provider:unknown){
 return compileH3(await loadCompileInput(db(),clipId,h3Mode(mode),h3Provider(provider)));
}

export async function freezeH3(clipId:string,body:Record<string,unknown>){
 const mode=h3Mode(body.mode),provider=h3Provider(body.provider);
 if(typeof body.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(body.previewHash))fail(400,'Review a current compiler preview before freezing');
 if(!Number.isInteger(body.expectedClipVersion)||Number(body.expectedClipVersion)<1)fail(400,'Expected Clip version required');
 return transaction(async client=>{
  const clip=(await client.query('SELECT version FROM generation_clips WHERE id=$1 FOR UPDATE',[clipId])).rows[0];
  if(!clip)fail(404,'Clip not found');
  if(clip.version!==body.expectedClipVersion)fail(409,'Clip changed; preview again');
  const input=await loadCompileInput(client,clipId,mode,provider),compiled=compileH3(input);
  if(!compiled.formatValid)fail(409,'Prompt validation failed: '+compiled.issues.filter(i=>i.severity==='error'&&i.scope!=='provider').map(i=>i.code).join(', '));
  if(compiled.hash!==body.previewHash)fail(409,'Source or compiler result changed; preview again');
  const frozen={compileInput:input,compiled};
  return (await client.query('INSERT INTO h3_compilations(id,clip_id,clip_version,mode,provider,rules_version,hash,compiled_prompt,reference_map,source_snapshot,validation,input_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(clip_id,hash) DO UPDATE SET hash=EXCLUDED.hash RETURNING id,clip_id,clip_version,mode,provider,hash,rules_version,validation,created_at',[randomUUID(),clipId,input.source.clipVersion,mode,provider,compiled.rulesVersion,compiled.hash,compiled.prompt,JSON.stringify(compiled.referenceMap),JSON.stringify(compiled.source),JSON.stringify(compiled.issues),JSON.stringify(frozen)])).rows[0];
 });
}

export async function verifiedFrozenInput(client:Queryable,clipId:string,compilationId:string,clipVersion:number){
 const frozen=(await client.query('SELECT * FROM h3_compilations WHERE id=$1 AND clip_id=$2',[compilationId,clipId])).rows[0];
 if(!frozen)fail(409,'Choose a reviewed frozen H3 input for this Clip');
 if(frozen.clip_version!==clipVersion)fail(409,'Clip changed since compilation');
 const input=await loadCompileInput(client,clipId,h3Mode(frozen.mode),h3Provider(frozen.provider));
 const current=compileH3(input);
 if(current.hash!==frozen.hash||current.prompt!==frozen.compiled_prompt||current.rulesVersion!==frozen.rules_version)fail(409,'Shot, script, plan, reference or rules changed; preview and freeze again');
 if(!current.submitEligible||frozen.provider!=='runninghub-minimax-h3')fail(409,'Selected H3 mode and Provider are not verified for submission');
 const saved=frozen.input_snapshot as {compiled?:{hash?:string,prompt?:string}};
 if(saved.compiled?.hash!==current.hash||saved.compiled?.prompt!==current.prompt)fail(409,'Frozen input integrity check failed');
 return {frozen,input,compiled:current};
}
