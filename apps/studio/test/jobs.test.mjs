import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createReviewFixture} from './review-fixture.mjs';
const url=process.env.CINEWEAVE_TEST_DATABASE_URL;
// No live gateway is used: every worker dependency is replaced explicitly.
test('worker leases, crash recovery, unknown paid submissions, media QA and duplicate delivery',{skip:!url},async()=>{
 assert.match(new URL(url).pathname,/_test$/);process.env.DATABASE_URL=url;
 const {db}=await import('../src/lib/db.ts');const {claimVideoJob,submitVideo,persistVideoTake,recoverExpiredJobs}=await import('../src/lib/jobs.ts');const {GatewayError}=await import('../src/lib/providers.ts');
 const fixture=await createReviewFixture();const pool=new pg.Pool({connectionString:url});let submissions=0;
 const fake={upload:async()=>({id:'task_fixture',mediaType:'image'}),create:async()=>{submissions++;throw new GatewayError('uncertain',502,'NETWORK_UNCONFIRMED')},query:async()=>({status:'completed'}),download:async()=>new Uint8Array()};
 try{
  const clip=(await pool.query('SELECT r.clip_id FROM video_takes t JOIN video_runs r ON r.id=t.run_id WHERE t.id=$1',[fixture.takeIds[0]])).rows[0].clip_id;
  const runId=randomUUID();await pool.query("INSERT INTO video_runs(id,clip_id,intent_key,input_snapshot) VALUES($1,$2,$3,$4)",[runId,clip,'fixture-'+runId,JSON.stringify({prompt:'deterministic',seconds:4,aspectRatio:'16:9',referenceMediaIds:[]})]);
  const claims=await Promise.all([claimVideoJob(true),claimVideoJob(true)]);const run=claims.find(r=>r?.id===runId);assert.ok(run);assert.equal(claims.filter(r=>r?.id===runId).length,1);await submitVideo(run,fake);assert.equal(submissions,1);assert.equal((await pool.query('SELECT status FROM video_runs WHERE id=$1',[runId])).rows[0].status,'submission_unknown');await recoverExpiredJobs();assert.equal(await claimVideoJob(true),null);assert.equal(submissions,1);
  const crashed=randomUUID();await pool.query("INSERT INTO video_runs(id,clip_id,intent_key,status,lease_token,lease_expires_at,input_snapshot) VALUES($1,$2,$3,'submitting',$4,now()-interval '1 second',$5)",[crashed,clip,'crash-'+crashed,randomUUID(),JSON.stringify(run.input_snapshot)]);await recoverExpiredJobs();assert.equal((await pool.query('SELECT status FROM video_runs WHERE id=$1',[crashed])).rows[0].status,'submission_unknown');
  const recovered=randomUUID();await pool.query("INSERT INTO video_runs(id,clip_id,intent_key,status,provider_job_id,lease_token,lease_expires_at,input_snapshot) VALUES($1,$2,$3,'submitting','video_fixture',$4,now()-interval '1 second',$5)",[recovered,clip,'known-'+recovered,randomUUID(),JSON.stringify(run.input_snapshot)]);await recoverExpiredJobs();assert.equal((await pool.query('SELECT status FROM video_runs WHERE id=$1',[recovered])).rows[0].status,'queued');
  const token=randomUUID();await pool.query("UPDATE video_runs SET lease_token=$2,lease_expires_at=now()+interval '5 minutes' WHERE id=$1",[recovered,token]);const r={...run,id:recovered,lease_token:token};const m=(await pool.query('SELECT m.storage_path FROM media_files m JOIN video_takes t ON t.media_id=m.id WHERE t.id=$1',[fixture.takeIds[0]])).rows[0];const bytes=await readFile(m.storage_path);
  await persistVideoTake(r,bytes);await persistVideoTake(r,bytes);assert.equal((await pool.query('SELECT count(*)::int AS n FROM video_takes WHERE run_id=$1',[recovered])).rows[0].n,1);assert.equal((await pool.query('SELECT count(*)::int AS n FROM media_files WHERE filename=$1',['H3-'+recovered+'.mp4'])).rows[0].n,1);
  const take=(await pool.query('SELECT m.technical_qa FROM video_takes t JOIN media_files m ON m.id=t.media_id WHERE t.run_id=$1',[recovered])).rows[0];assert.equal(take.technical_qa.status,'decodable');assert.equal(take.technical_qa.audio.length,1);assert.ok(take.technical_qa.sha256);
 }finally{const extra=(await pool.query("SELECT m.id,m.storage_path FROM media_files m JOIN video_takes t ON t.media_id=m.id JOIN video_runs r ON r.id=t.run_id JOIN generation_clips c ON c.id=r.clip_id WHERE c.film_id=$1 AND NOT(m.id=ANY($2::uuid[]))",[fixture.filmId,fixture.mediaIds])).rows;fixture.mediaIds.push(...extra.map(m=>m.id));await fixture.dispose();await pool.end();await db().end();}
});
