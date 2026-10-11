import test from 'node:test';
import assert from 'node:assert/strict';
import {compileH3,H3_RULES} from '../src/lib/h3-compiler.ts';

const src={clipId:'clip-a',clipVersion:2,filmId:'film-a',scriptRevisions:[{id:'script-rev-a',version:3}],continuationParentClipId:null};
const shots=[{shotId:'director-a',startSeconds:0,endSeconds:4,version:2,title:'Uncut approach',description:'',design:{}},{shotId:'director-b',startSeconds:4,endSeconds:8,version:1,title:'Reaction',description:'',design:{}}];
const beats=[
 {id:'beat-a',shotId:'director-a',startSeconds:0,endSeconds:2,composition:'A medium close view frames a woman beside a wet window',cause:'She notices a folded letter',action:'She raises the letter and opens its first crease',effect:'The paper reveals a handwritten address',camera:'The camera pushes in slowly with small amplitude',performance:'Her gaze tightens before her hand moves',sound:'The paper rustles softly',endState:'The letter is half open',dialogue:[{speakerId:'woman',speakerDescription:'The young woman with a restrained low voice',language:'Chinese',text:'别走。',performanceRate:.85,pauseSeconds:.4}]},
 {id:'beat-b',shotId:'director-a',startSeconds:2,endSeconds:4,composition:'The same hand and letter remain in frame',cause:'The address catches her eye',action:'She traces the last line with one finger',effect:'Her finger stops at the name',camera:'The camera holds its position',performance:'She inhales without speaking',sound:'A distant train passes',endState:'Her finger rests on the name'},
 {id:'beat-c',shotId:'director-b',startSeconds:4,endSeconds:8,transition:'cut',composition:'A reverse close view reveals the person at the doorway',cause:'The train sound masks his arrival',action:'He steps into the light and looks toward the letter',effect:'She lowers the letter but does not turn',camera:'The camera remains static',performance:'He hesitates before speaking',sound:'One shoe scuffs the floor',endState:'They remain separated by the doorway'}
];
const plan={version:1,style:'Live-action with cool window light',opening:'A quiet interior just before a reunion',beats,soundscape:'Rain taps the window while paper rustles and a train passes in the distance.',music:'N/A',directorConstraints:['Do not cut within the first four seconds'],referenceUses:[]};
const image=(assetId,revisionId)=>({assetId,revisionId,mediaId:'media-'+revisionId,sha256:'a'.repeat(64),mime:'image/png',assetKind:'character',assetName:'Formal complete board',description:'A complete visual board'});
const audio={assetId:'voice-a',revisionId:'rev-voice',mediaId:'media-voice',sha256:'b'.repeat(64),mime:'audio/wav',assetKind:'voice',assetName:'Formal voice sample',description:'A calm voice sample'};
const input=(mode='T2VA',changes={})=>({mode,seconds:8,plan:structuredClone(plan),references:[],shotSpans:structuredClone(shots),source:structuredClone(src),provider:'offline-mock',...changes});
const fields=(prompt)=>[...prompt.matchAll(/^(subject_definitions|summary|retention_analysis|detailed_description|integrated_multimodal_description|overall_soundscape|non_diegetic_music):/gm)].map(m=>m[1]);

test('official T2VA fields, one Director Shot across two Beats, Chinese dialogue and causal details',()=>{
 const c=compileH3(input());
 assert.equal(c.formatValid,true,JSON.stringify(c.issues));assert.equal(c.submitEligible,false);
 assert.deepEqual(fields(c.prompt),['integrated_multimodal_description','overall_soundscape','non_diegetic_music']);
 assert.match(c.prompt,/\[Shot 1\]/);assert.match(c.prompt,/Within the same uncut shot, from 00:02.000 to 00:04.000/);
 assert.match(c.prompt,/\[Shot 2\] At 00:04.000, the camera cuts to/);assert.doesNotMatch(c.prompt,/\[Shot 3\]/);
 assert.match(c.prompt,/<d>\[Chinese\] 别走。<\/d>/);assert.match(c.prompt,/0.85 times the baseline speaking rate/);
 assert.match(c.prompt,/The paper reveals a handwritten address/);assert.match(c.prompt,/Preserve these director constraints/);
});

test('I2VA uses the official opening instruction and Picture 1',()=>{
 const first=image('character-a','rev-first');const x=input('I2VA',{references:[first]});x.plan.referenceUses=[{revisionId:first.revisionId,role:'first_frame',description:'The exact opening composition beside the wet window'}];
 const c=compileH3(x);assert.equal(c.formatValid,true,JSON.stringify(c.issues));assert.equal(c.referenceMap[0].label,'<Picture 1>');
 assert.match(c.prompt,/^For the target video, at 0\.00 seconds into the target video, <Picture 1> \(from \[Shot 1\]\) is fully referenced\.\n\nintegrated_multimodal_description:/);
});

test('FL2VA aligns frame labels and upload order by role even when references are selected backwards',()=>{
 const first=image('z-first','rev-first'),last=image('a-last','rev-last');const x=input('FL2VA',{references:[last,first]});x.plan.referenceUses=[{revisionId:last.revisionId,role:'last_frame',description:'The exact final composition at the doorway'},{revisionId:first.revisionId,role:'first_frame',description:'The exact opening composition beside the wet window'}];
 const c=compileH3(x);assert.equal(c.formatValid,true,JSON.stringify(c.issues));assert.deepEqual(c.referenceMap.map(r=>[r.role,r.label,r.uploadIndex]),[['first_frame','<Picture 1>',0],['last_frame','<Picture 2>',1]]);
 assert.match(c.prompt,/Picture 1 \(from Shot 1\) aligns with the 0\.00-second mark.*Picture 2 \(from Shot 2\) aligns with the 8\.00-second mark/);
});

test('L2VA aligns its single picture with the actual last Shot and two-decimal duration',()=>{
 const last=image('last','rev-last');const x=input('L2VA',{references:[last]});x.plan.referenceUses=[{revisionId:last.revisionId,role:'last_frame',description:'The exact final composition at the doorway'}];
 const c=compileH3(x);assert.equal(c.formatValid,true,JSON.stringify(c.issues));assert.match(c.prompt,/^How the reference pictures align with the target video — <Picture 1> \(from \[Shot 2\]\) aligns with the 8\.00-second mark/);
});

test('Ref2VA six fields, one complete board defining two subjects, voice speaker and retention',()=>{
 const board=image('board-a','rev-board');const x=input('Ref2VA',{references:[audio,board]});x.plan.referenceUses=[{revisionId:board.revisionId,role:'subject',description:'The complete board showing the woman and the room',subjects:[{key:'woman',description:'the woman with dark hair and a grey coat',speakerId:'woman'},{key:'room',description:'the narrow room with a wet window'}]},{revisionId:audio.revisionId,role:'audio_voice',description:'the measured low voice timbre without copied words',speakerId:'woman',retention:'reference'}];
 const c=compileH3(x);assert.equal(c.formatValid,true,JSON.stringify(c.issues));assert.deepEqual(fields(c.prompt),['subject_definitions','summary','retention_analysis','detailed_description','overall_soundscape','non_diegetic_music']);
 assert.equal(c.referenceMap.length,2);assert.deepEqual(c.referenceMap.map(r=>r.label),['<Picture 1>','<Audio 1>']);
 assert.match(c.prompt,/<Subject 1> is the woman with dark hair and a grey coat from <Picture 1>/);assert.match(c.prompt,/<Subject 2> is the narrow room with a wet window from <Picture 1>/);
 assert.match(c.prompt,/<Audio 1> is the voice-timbre reference for <Subject 1> \(S1\)/);assert.match(c.prompt,/<Audio 1>: reference -/);
 assert.match(c.prompt,/summary:\n\[reference generation \+ audio reference\]/);assert.match(c.prompt,/<d>\[Chinese\] 别走。<\/d>/);
});

test('same Shot transition is rejected and cannot create an extra Shot',()=>{
 const x=input();x.plan.beats[1].transition='cut';const c=compileH3(x);assert.equal(c.formatValid,false);assert.ok(c.issues.some(i=>i.code==='SPURIOUS_CUT'));assert.doesNotMatch(c.prompt,/\[Shot 3\]/);
});

test('unverified reference route can preview valid official prompt but cannot submit',()=>{
 const board=image('board','rev-board');const x=input('Ref2VA',{provider:'runninghub-minimax-h3',references:[board]});x.plan.referenceUses=[{revisionId:board.revisionId,role:'subject',description:'the woman in a complete character board'}];const c=compileH3(x);
 assert.equal(c.formatValid,true,JSON.stringify(c.issues));assert.equal(c.submitEligible,false);assert.ok(c.issues.some(i=>i.code==='MODE_UNVERIFIED'));
});

test('native continuation stays offline and source version changes alter the frozen hash',()=>{
 const a=input('T2VA',{provider:'runninghub-minimax-h3'});a.source.continuationParentClipId='parent-clip';const blocked=compileH3(a);assert.equal(blocked.submitEligible,false);assert.ok(blocked.issues.some(i=>i.code==='NATIVE_CONTINUATION_UNVERIFIED'));
 const b=input();const before=compileH3(b);b.shotSpans[0].version++;assert.notEqual(compileH3(b).hash,before.hash);assert.equal(before.rulesVersion,H3_RULES.version);
});
