import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import pg from 'pg';
const base=process.env.CINEWEAVE_TEST_BASE_URL,url=process.env.CINEWEAVE_TEST_DATABASE_URL;
const api=async(path,body)=>{const response=await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,value:await response.json()};};
const plan=(shotId,referenceUses=[])=>({version:1,style:'Restrained live action at a warm workbench',opening:'A watchmaker pauses over a stopped watch',beats:[{id:'beat-one',shotId,startSeconds:0,endSeconds:12,composition:'A stable medium close view holds the watchmaker and the watch',cause:'The hand has stopped moving',action:'She lifts the watch, listens and lowers it',effect:'She decides to try the repair again',camera:'The camera holds without a cut',performance:'Her expression shifts from doubt to resolve',sound:'A faint metal tap follows a long silence'}],soundscape:'Room tone and a soft metal tap.',music:'N/A',referenceUses});

test('historical formal asset freeze and Run lineage remain immutable; idempotency protects unknown submissions',{skip:!base||!url},async()=>{
 assert.match(new URL(url).pathname,/_test$/);const pool=new pg.Pool({connectionString:url});let projectId;
 try{
  const project=(await api('projects',{name:'lineage '+randomUUID()})).value;projectId=project.id;const film=project.filmId;
  const unit=(await api(`films/${film}/units`,{kind:'scene',title:'Opening',content:'Original adopted screenplay'})).value;
  const asset=(await api(`films/${film}/assets`,{kind:'character',name:'Watchmaker',variant:'Look A'})).value;
  const png=await sharp({create:{width:100,height:150,channels:3,background:'#222333'}}).png().toBuffer(),form=new FormData();form.append('file',new File([png],'whole-board.png',{type:'image/png'}));
  const media=(await fetch(base+'/api/media',{method:'POST',body:form}).then(r=>r.json()));
  const revision=(await api(`assets/${asset.id}/revisions`,{expectedVersion:0,mediaId:media.id,description:'Complete formal character board'})).value;
  await api(`assets/${asset.id}/edit`,{expectedVersion:1,name:'Renamed watchmaker',variant:'Look A',description:'Later identity edit'});
  const shot=(await api(`films/${film}/shots`,{title:'Original Director Shot',description:'One held composition'})).value;
  const clip=(await api(`films/${film}/clips`,{title:'Original Clip',prompt:'Historical brief',seconds:12})).value;
  const referenceUses=[{revisionId:revision.id,role:'subject',description:'The complete character board',subjects:[{key:'watchmaker',description:'the watchmaker in a blue grey work coat'}]}];
  const edited=await api(`clips/${clip.id}/edit`,{expectedVersion:1,title:'Original Clip',prompt:'Historical brief',seconds:12,referenceMediaIds:[media.id],shots:[{shotId:shot.id,start:0,end:12}],plan:{referenceRevisionIds:[revision.id],executionPlan:plan(shot.id,referenceUses)}});assert.equal(edited.status,200,JSON.stringify(edited.value));
  const refPreview=await api(`clips/${clip.id}/h3-preview`,{mode:'Ref2VA',provider:'runninghub-minimax-h3'});assert.equal(refPreview.value.formatValid,true,JSON.stringify(refPreview.value.issues));assert.equal(refPreview.value.submitEligible,false);
  const refFreeze=await api(`clips/${clip.id}/h3-freeze`,{mode:'Ref2VA',provider:'runninghub-minimax-h3',previewHash:refPreview.value.hash,expectedClipVersion:edited.value.version});assert.equal(refFreeze.status,201);
  const frozenRef=(await api(`clips/${clip.id}/h3-compilations`)).value[0];assert.equal(frozenRef.reference_map[0].revisionId,revision.id);assert.equal(frozenRef.reference_map[0].mediaId,media.id);assert.equal(frozenRef.reference_map[0].assetName,'Watchmaker');
  assert.equal((await api(`clips/${clip.id}/runs`,{intentKey:'blocked-ref-'+randomUUID(),compiledInputId:refFreeze.value.id})).status,409);
  const textEdit=await api(`clips/${clip.id}/edit`,{expectedVersion:edited.value.version,title:'Original Clip',prompt:'Historical brief',seconds:12,referenceMediaIds:[],shots:[{shotId:shot.id,start:0,end:12}],plan:{referenceRevisionIds:[],executionPlan:plan(shot.id)}});assert.equal(textEdit.status,200);
  const preview=(await api(`clips/${clip.id}/h3-preview`,{mode:'T2VA',provider:'runninghub-minimax-h3'})).value;
  const freeze=await api(`clips/${clip.id}/h3-freeze`,{mode:'T2VA',provider:'runninghub-minimax-h3',previewHash:preview.hash,expectedClipVersion:textEdit.value.version});assert.equal(freeze.status,201);
  const intent='fixed-intent-'+clip.id;const created=await api(`clips/${clip.id}/runs`,{intentKey:intent,compiledInputId:freeze.value.id});assert.equal(created.status,201,JSON.stringify(created.value));const runId=created.value.id;
  await pool.query("UPDATE video_runs SET status='submission_unknown' WHERE id=$1",[runId]);
  await api(`units/${unit.id}/revisions`,{expectedVersion:1,content:'Later screenplay change'});await api(`shots/${shot.id}/edit`,{expectedVersion:1,title:'New Shot title',description:'New camera position',design:{}});
  const saved=(await api('runs/'+runId)).value;assert.equal(saved.compiled_input_id,freeze.value.id);assert.equal(saved.input_snapshot.script[0].content,'Original adopted screenplay');assert.equal(saved.input_snapshot.shots[0].title,'Original Director Shot');assert.equal(saved.input_snapshot.prompt,preview.prompt);assert.equal(saved.input_snapshot.compilationHash,preview.hash);
  const same=await api(`clips/${clip.id}/runs`,{intentKey:intent,compiledInputId:freeze.value.id});assert.equal(same.status,200);assert.equal(same.value.id,runId);assert.equal((await api(`clips/${clip.id}/runs`,{intentKey:'different-'+clip.id,compiledInputId:freeze.value.id})).status,409);
  for(const status of ['waiting_submit','preparing','submitting','queued','in_progress','awaiting_media','media_failed']){await pool.query('UPDATE video_runs SET status=$2 WHERE id=$1',[runId,status]);assert.equal((await api(`clips/${clip.id}/runs`,{intentKey:intent,compiledInputId:freeze.value.id})).value.id,runId);assert.equal((await api(`clips/${clip.id}/runs`,{intentKey:'another-'+status+'-'+clip.id,compiledInputId:freeze.value.id})).status,409,status);}
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM video_runs WHERE clip_id=$1',[clip.id])).rows[0].n,1);
 }finally{if(projectId){await pool.query('DELETE FROM video_runs WHERE clip_id IN(SELECT id FROM generation_clips WHERE film_id IN(SELECT id FROM films WHERE project_id=$1))',[projectId]);await pool.query('DELETE FROM h3_compilations WHERE clip_id IN(SELECT id FROM generation_clips WHERE film_id IN(SELECT id FROM films WHERE project_id=$1))',[projectId]);await pool.query('DELETE FROM projects WHERE id=$1',[projectId]);}await pool.end();}
});
