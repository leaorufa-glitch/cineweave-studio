import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

const base=process.env.CINEWEAVE_TEST_BASE_URL,databaseUrl=process.env.CINEWEAVE_TEST_DATABASE_URL;
const call=async(path,body)=>{const res=await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,value:await res.json()};};
const plan=shotId=>({version:1,style:'Restrained live action with warm workbench light',opening:'A watchmaker examines the stopped watch at a workbench',beats:[{id:'observe',shotId,startSeconds:0,endSeconds:3,composition:'A medium close view holds the woman and her hands',cause:'The watch is silent',action:'She lifts the watch toward her ear',effect:'She hears no ticking',camera:'The camera holds at eye level',performance:'Her eyes narrow before she lowers the watch',sound:'Only quiet room tone remains'},{id:'decide',shotId,startSeconds:3,endSeconds:8,composition:'The same frame holds her hands and the watch',cause:'The silence confirms the failure',action:'She lowers the watch and reaches for her tweezers',effect:'She chooses to attempt the repair again',camera:'The camera makes a slow restrained push',performance:'Her breathing settles into resolve',sound:'The tweezers touch the wood with a small click'}],soundscape:'Quiet room tone, soft breathing and one metal click.',music:'N/A',directorConstraints:['Keep one uncut Director Shot'],referenceUses:[]});

test('API saves the execution plan, shares preview, freezes reviewed input and gates a traceable Run', {skip:!base||!databaseUrl&&'Requires isolated API and test database'},async()=>{
 assert.match(new URL(databaseUrl).pathname,/_test$/);
 const pool=new pg.Pool({connectionString:databaseUrl});let projectId;
 try{
  const project=await call('projects',{name:'H3 chain '+randomUUID(),idea:'A watchmaker chooses to try once more'});assert.equal(project.status,201);projectId=project.value.id;const film=project.value.filmId;
  const unit=await call(`films/${film}/units`,{kind:'scene',title:'Workbench',content:'The watch stops. She chooses to try again.'});assert.equal(unit.status,201);
  const shot=await call(`films/${film}/shots`,{sceneUnitId:unit.value.id,title:'One uncut repair decision',description:'Hold through the failure and decision'});assert.equal(shot.status,201);
  const clip=await call(`films/${film}/clips`,{title:'First eight seconds',prompt:'Historical director brief only',seconds:8});assert.equal(clip.status,201);
  const edit=await call(`clips/${clip.value.id}/edit`,{expectedVersion:1,title:'First eight seconds',prompt:'Historical director brief only',seconds:8,referenceMediaIds:[],shots:[{shotId:shot.value.id,start:0,end:8}],plan:{referenceRevisionIds:[],executionPlan:plan(shot.value.id)}});assert.equal(edit.status,200,JSON.stringify(edit.value));
  const preview=await call(`clips/${clip.value.id}/h3-preview`,{mode:'T2VA',provider:'runninghub-minimax-h3'});assert.equal(preview.status,200,JSON.stringify(preview.value));assert.equal(preview.value.formatValid,true,JSON.stringify(preview.value.issues));assert.equal(preview.value.submitEligible,true);assert.match(preview.value.prompt,/Within the same uncut shot/);assert.doesNotMatch(preview.value.prompt,/\[Shot 2\]/);
  const changed=await call(`shots/${shot.value.id}/edit`,{expectedVersion:1,title:'One uncut repair decision',description:'Keep the decision in a held frame',design:{intent:'Her decision to continue'}});assert.equal(changed.status,200);
  const stale=await call(`clips/${clip.value.id}/h3-freeze`,{mode:'T2VA',provider:'runninghub-minimax-h3',previewHash:preview.value.hash,expectedClipVersion:edit.value.version});assert.equal(stale.status,409);
  const fresh=await call(`clips/${clip.value.id}/h3-preview`,{mode:'T2VA',provider:'runninghub-minimax-h3'});assert.notEqual(fresh.value.hash,preview.value.hash);
  const freeze=await call(`clips/${clip.value.id}/h3-freeze`,{mode:'T2VA',provider:'runninghub-minimax-h3',previewHash:fresh.value.hash,expectedClipVersion:edit.value.version});assert.equal(freeze.status,201,JSON.stringify(freeze.value));
  const listed=await call(`clips/${clip.value.id}/h3-compilations`);assert.equal(listed.value[0].id,freeze.value.id);
  const noFreeze=await call(`clips/${clip.value.id}/runs`,{intentKey:'h3-no-freeze-'+randomUUID()});assert.equal(noFreeze.status,400);
  const intent='h3-frozen-'+randomUUID();const run=await call(`clips/${clip.value.id}/runs`,{intentKey:intent,compiledInputId:freeze.value.id});assert.equal(run.status,201,JSON.stringify(run.value));
  const same=await call(`clips/${clip.value.id}/runs`,{intentKey:intent,compiledInputId:freeze.value.id});assert.equal(same.status,200);assert.equal(same.value.id,run.value.id);
  const saved=await call(`runs/${run.value.id}`);assert.equal(saved.value.compiled_input_id,freeze.value.id);assert.equal(saved.value.input_snapshot.prompt,fresh.value.prompt);assert.equal(saved.value.input_snapshot.compilationHash,fresh.value.hash);assert.equal(saved.value.input_snapshot.referenceMediaIds.length,0);assert.equal(saved.value.input_snapshot.shots.length,1);
 }finally{if(projectId){await pool.query('DELETE FROM video_runs WHERE clip_id IN(SELECT id FROM generation_clips WHERE film_id IN(SELECT id FROM films WHERE project_id=$1))',[projectId]);await pool.query('DELETE FROM h3_compilations WHERE clip_id IN(SELECT id FROM generation_clips WHERE film_id IN(SELECT id FROM films WHERE project_id=$1))',[projectId]);await pool.query('DELETE FROM projects WHERE id=$1',[projectId]);}await pool.end();}
});
