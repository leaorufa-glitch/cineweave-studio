import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import sharp from 'sharp';import pg from 'pg';
const base=process.env.CINEWEAVE_TEST_BASE_URL,url=process.env.CINEWEAVE_TEST_DATABASE_URL;
const api=async(p,b)=>{const r=await fetch(base+'/api/'+p,{method:b===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});return {status:r.status,value:await r.json()}};
test('Run freezes selected historical asset, same Shot and script; idempotency survives later changes',{skip:!base||!url},async()=>{
 assert.match(new URL(url).pathname,/_test$/);const pool=new pg.Pool({connectionString:url});const project=(await api('projects',{name:'lineage '+randomUUID()})).value,film=project.filmId;
 try{
  const unit=(await api(`films/${film}/units`,{kind:'scene',title:'初场景',content:'原正式剧本'})).value,asset=(await api(`films/${film}/assets`,{kind:'character',name:'主角',variant:'Look A'})).value;
  const png=await sharp({create:{width:100,height:150,channels:3,background:'#222333'}}).png().toBuffer(),form=new FormData();form.append('file',new File([png],'whole-board.png',{type:'image/png'}));const media=await fetch(base+'/api/media',{method:'POST',body:form}).then(r=>r.json());const revision=(await api(`assets/${asset.id}/revisions`,{expectedVersion:0,mediaId:media.id,description:'完整图板'})).value;
  await api(`assets/${asset.id}/edit`,{expectedVersion:1,name:'改名后身份',variant:'Look A',description:'更新设定'});
  const shot=(await api(`films/${film}/shots`,{title:'镜头原意图',description:'固定机位'})).value,clip=(await api(`films/${film}/clips`,{title:'原Clip',prompt:'冻结输入',seconds:12})).value;
  const edited=await api(`clips/${clip.id}/edit`,{expectedVersion:1,title:'原Clip',prompt:'冻结输入',seconds:12,referenceMediaIds:[media.id],shots:[{shotId:shot.id,start:0,end:12}],plan:{referenceRevisionIds:[revision.id]}});assert.equal(edited.status,200);
  const run=(await api(`clips/${clip.id}/runs`,{intentKey:'fixed-intent-'+clip.id})).value;await pool.query("UPDATE video_runs SET status='submission_unknown' WHERE id=$1",[run.id]);
  await api(`units/${unit.id}/revisions`,{expectedVersion:1,content:'后来修改的剧本'});await api(`shots/${shot.id}/edit`,{expectedVersion:1,title:'新镜头',description:'新机位',design:{}});
  const frozen=(await api('runs/'+run.id)).value.input_snapshot;assert.equal(frozen.script[0].content,'原正式剧本');assert.equal(frozen.shots[0].title,'镜头原意图');assert.equal(frozen.references[0].revision_id,revision.id);assert.equal(frozen.references[0].revision_number,1);assert.equal(frozen.references[0].name,'主角');assert.equal(frozen.referenceMediaIds[0],media.id);assert.ok(frozen.references[0].sha256);
  const same=await api(`clips/${clip.id}/runs`,{intentKey:'fixed-intent-'+clip.id});assert.equal(same.status,200);assert.equal(same.value.id,run.id);assert.equal(same.value.status,'submission_unknown');assert.equal((await api(`clips/${clip.id}/runs`,{intentKey:'different-intent-'+clip.id})).status,409);
  for(const status of ['waiting_submit','preparing','submitting','queued','in_progress','awaiting_media','media_failed']){
   await pool.query('UPDATE video_runs SET status=$2 WHERE id=$1',[run.id,status]);
   const replay=await api(`clips/${clip.id}/runs`,{intentKey:'fixed-intent-'+clip.id});assert.equal(replay.status,200);assert.equal(replay.value.id,run.id);
   assert.equal((await api(`clips/${clip.id}/runs`,{intentKey:'another-'+status+'-'+clip.id})).status,409,status);
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM video_runs WHERE clip_id=$1',[clip.id])).rows[0].n,1);
 }finally{await pool.query('DELETE FROM projects WHERE id=$1',[project.id]);await pool.end()}
});
