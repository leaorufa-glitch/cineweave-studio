import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {createReviewFixture} from './review-fixture.mjs';

const url=process.env.CINEWEAVE_TEST_DATABASE_URL;
test('Worker uploads snapshot keyframes in compiled Picture order using a Mock Provider', {skip:!url},async()=>{
 assert.match(new URL(url).pathname,/_test$/);process.env.DATABASE_URL=url;
 const {db}=await import('../src/lib/db.ts');const {submitVideo}=await import('../src/lib/jobs.ts');
 const fixture=await createReviewFixture(),uploaded=[];let createdImages;
 try{
  const referenceMediaIds=[],references=[];
  for(const [index,color] of ['#336699','#995533'].entries()){
   const filename=index?'last-frame.png':'first-frame.png',bytes=await sharp({create:{width:32,height:32,channels:3,background:color}}).png().toBuffer(),mediaId=randomUUID(),file=join(fixture.directory,filename),sha256=createHash('sha256').update(bytes).digest('hex');
   await writeFile(file,bytes);fixture.mediaIds.push(mediaId);referenceMediaIds.push(mediaId);references.push({media_id:mediaId,sha256});
   await fixture.pool.query("INSERT INTO media_files(id,filename,mime,bytes,sha256,storage_path) VALUES($1,$2,'image/png',$3,$4,$5)",[mediaId,filename,bytes.length,sha256,file]);
  }
  const id=randomUUID(),token=randomUUID(),snapshot={mode:'FL2VA',prompt:'Offline Mock keyframe order',seconds:4,aspectRatio:'16:9',referenceMediaIds,references,referenceMap:[{label:'<Picture 1>',mediaId:referenceMediaIds[0],role:'first_frame',uploadIndex:0},{label:'<Picture 2>',mediaId:referenceMediaIds[1],role:'last_frame',uploadIndex:1}]};
  await fixture.pool.query("INSERT INTO video_runs(id,clip_id,intent_key,status,lease_token,lease_expires_at,input_snapshot) VALUES($1,$2,$3,'preparing',$4,now()+interval '5 minutes',$5)",[id,fixture.clipId,'upload-order-'+id,token,JSON.stringify(snapshot)]);
  const fake={upload:async(_bytes,filename)=>{uploaded.push(filename);return {id:'task_'+uploaded.length,mediaType:'image'};},create:async(_prompt,_seconds,_ratio,images)=>{createdImages=images;return {id:'mock-video-id'};},query:async()=>{throw Error('No remote query')},download:async()=>{throw Error('No remote download')}};
  await submitVideo({id,clip_id:fixture.clipId,status:'preparing',lease_token:token,provider_job_id:null,input_snapshot:snapshot},fake);
  assert.deepEqual(uploaded,['first-frame.png','last-frame.png']);assert.deepEqual(createdImages,['task_1','task_2']);
  const saved=(await fixture.pool.query('SELECT status,provider_snapshot FROM video_runs WHERE id=$1',[id])).rows[0];assert.equal(saved.status,'queued');assert.deepEqual(saved.provider_snapshot.uploads.map(x=>x.mediaId),referenceMediaIds);
 }finally{await fixture.dispose();await db().end();}
});
