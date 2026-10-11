import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {createReviewFixture} from './review-fixture.mjs';
const exec=promisify(execFile),url=process.env.CINEWEAVE_TEST_DATABASE_URL;
test('actual worker process kill/restart preserves unknown submission and recovers local rendering',{skip:!url},async()=>{
 const fixture=await createReviewFixture(),pool=fixture.pool,run=randomUUID(),render=randomUUID(),token=randomUUID();
 try{
  await pool.query("INSERT INTO video_runs(id,clip_id,intent_key,status,lease_token,lease_expires_at,submission_started_at) VALUES($1,$2,$3,'waiting_submit',$4,now()+interval '5 minutes',NULL)",[run,fixture.clipId,'crash-'+run,token]);
  const source=(await pool.query('SELECT m.id,m.sha256 FROM media_files m WHERE m.id=$1',[fixture.mediaIds[0]])).rows[0];await pool.query("UPDATE video_takes SET adopted=true,qa_status='accepted' WHERE id=$1",[fixture.takeIds[0]]);
  await pool.query("INSERT INTO renders(id,film_id,intent_key,status,lease_token,lease_expires_at,settings) VALUES($1,$2,$3,'rendering',$4,now()+interval '5 minutes',$5)",[render,fixture.filmId,'render-crash-'+render,token,JSON.stringify({width:1280,height:720,fps:24,snapshotSegments:[{id:randomUUID(),take_id:fixture.takeIds[0],media_id:source.id,sha256:source.sha256,adopted:true,source_in_seconds:0,source_out_seconds:2}]})]);
  await pool.query("UPDATE video_runs SET lease_token=NULL,lease_expires_at=NULL,input_snapshot=$2 WHERE id=$1",[run,JSON.stringify({prompt:'fixture',seconds:4,aspectRatio:'16:9',referenceMediaIds:[]})]);
  const crashCode="const {claimVideoJob,submitVideo,withJobHeartbeat}=await import('./src/lib/jobs.ts');const job=await claimVideoJob(true);if(!job)throw Error('No fixture job');await withJobHeartbeat('video_runs',job.id,job.lease_token,()=>submitVideo(job,{upload:async()=>{},create:async()=>{console.log('worker-ready');await new Promise(()=>{});},query:async()=>{},download:async()=>{}}));";
  const child=spawn(process.execPath,['--experimental-strip-types','--input-type=module','-e',crashCode],{env:{...process.env,DATABASE_URL:url,DARL_API_KEY:''},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',resolve)});child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));
  await pool.query("UPDATE video_runs SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[run]);await pool.query("UPDATE renders SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[render]);
  const code="const {recoverExpiredJobs,claimVideoJob}=await import('./src/lib/jobs.ts');const {renderOneIfWaiting}=await import('./src/lib/render-worker.ts');const {db}=await import('./src/lib/db.ts');await recoverExpiredJobs();const p=await claimVideoJob(true);if(p)throw Error('Unexpected paid resubmit');await renderOneIfWaiting();await db().end();";
  await exec(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{env:{...process.env,DATABASE_URL:url,DARL_API_KEY:'',MEDIA_ROOT:fixture.directory},timeout:60000});
  assert.equal((await pool.query('SELECT status FROM video_runs WHERE id=$1',[run])).rows[0].status,'submission_unknown');const output=(await pool.query('SELECT status,output_media_id FROM renders WHERE id=$1',[render])).rows[0];assert.equal(output.status,'completed');assert.ok(output.output_media_id);
 }finally{await fixture.dispose()}
});
