import test from 'node:test';
import assert from 'node:assert/strict';
import {compileH3} from '../src/lib/h3-compiler.ts';
import {loadCompileInput,verifiedFrozenInput} from '../src/lib/h3-production.ts';

const clip='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',film='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const shot='cccccccc-cccc-4ccc-8ccc-cccccccccccc',revision='dddddddd-dddd-4ddd-8ddd-dddddddddddd',media='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const basePlan={version:1,style:'Quiet live action',opening:'A watchmaker returns to her bench',beats:[{id:'beat-one',shotId:shot,startSeconds:0,endSeconds:8,composition:'A close view holds on the watchmaker and the open watch',action:'She steadies the movement and turns the winding crown',camera:'The camera remains still',cause:'The watch has stopped',effect:'The second hand moves again',performance:'She exhales after the hand moves',sound:'The first tick emerges from silence'}],soundscape:'One precise watch tick and a soft exhale.',music:'N/A',referenceUses:[]};
function queryable({plan=basePlan,mediaIds=[],revisionIds=[],clipVersion=2,shotVersion=3,frozen}={}){
 const calls=[];
 return {calls,async query(sql,values){calls.push([sql,values]);
  if(sql.startsWith('SELECT * FROM generation_clips'))return {rows:[{id:clip,film_id:film,seconds:8,version:clipVersion,reference_media_ids:mediaIds,plan:{referenceRevisionIds:revisionIds,executionPlan:plan},continuation_parent_clip_id:null}]};
  if(sql.startsWith('SELECT r.id AS revision_id'))return {rows:revisionIds.map(id=>({revision_id:id,media_id:media,sha256:'a'.repeat(64),mime:'image/png',asset_id:'ffffffff-ffff-4fff-8fff-ffffffffffff',asset_kind:'character',asset_name:'Formal board',description:'A complete character board',content_qa:{status:'accepted'}}))};
  if(sql.startsWith('SELECT l.shot_id'))return {rows:[{shot_id:shot,clip_start_seconds:'0',clip_end_seconds:'8',version:shotVersion,title:'Watch repair',description:'',design:{}}]};
  if(sql.startsWith('SELECT adopted_revision_id'))return {rows:[{id:'99999999-9999-4999-8999-999999999999',version:1}]};
  if(sql.startsWith('SELECT * FROM h3_compilations'))return {rows:frozen?[frozen]:[]};
  throw Error('Unexpected SQL: '+sql);
 }};
}

test('compile source loads one real formal MediaFile and adopted versions without using Clip prompt',async()=>{
 const q=queryable({mediaIds:[media],revisionIds:[revision]});
 const input=await loadCompileInput(q,clip,'Ref2VA','offline-mock');
 assert.deepEqual(input.references.map(r=>[r.revisionId,r.mediaId,r.sha256]),[[revision,media,'a'.repeat(64)]]);
 assert.equal(input.source.clipVersion,2);assert.equal(input.shotSpans[0].version,3);
 assert.equal(input.plan.beats[0].shotId,shot);
});

test('mismatched formal revision and selected MediaFile cannot compile',async()=>{
 const q=queryable({mediaIds:['11111111-1111-4111-8111-111111111111'],revisionIds:[revision]});
 await assert.rejects(loadCompileInput(q,clip,'I2VA','offline-mock'),/Asset revision and MediaFile selection differ/);
});

test('frozen input rejects changed Director Shot even when Clip version is unchanged',async()=>{
 const initial=queryable(),input=await loadCompileInput(initial,clip,'T2VA','runninghub-minimax-h3'),compiled=compileH3(input);
 assert.equal(compiled.submitEligible,true,JSON.stringify(compiled.issues));
 const frozen={id:'22222222-2222-4222-8222-222222222222',clip_version:2,mode:'T2VA',provider:'runninghub-minimax-h3',rules_version:compiled.rulesVersion,hash:compiled.hash,compiled_prompt:compiled.prompt,input_snapshot:{compiled:{hash:compiled.hash,prompt:compiled.prompt}}};
 const current=queryable({frozen});assert.equal((await verifiedFrozenInput(current,clip,frozen.id,2)).compiled.hash,compiled.hash);
 const changed=queryable({frozen,shotVersion:4});await assert.rejects(verifiedFrozenInput(changed,clip,frozen.id,2),/changed; preview and freeze again/);
});
