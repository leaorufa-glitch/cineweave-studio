import test from 'node:test';
import assert from 'node:assert/strict';
import {compileH3} from '../src/lib/h3-compiler.ts';
import {watchmakerInputs} from './fixtures/h3-watchmaker-six.mjs';

test('six historical Clip plans produce deterministic official Ref2VA previews without inventing a Shot or paid capability',()=>{
 assert.equal(watchmakerInputs.length,6);
 for(const [index,item] of watchmakerInputs.entries()){
  const result=compileH3(item.input);
  assert.equal(result.formatValid,true,`${item.title}: ${JSON.stringify(result.issues)}`);
  assert.equal(result.submitEligible,false);
  assert.deepEqual([...result.prompt.matchAll(/^(subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music):/gm)].map(match=>match[1]),['subject_definitions','summary','retention_analysis','detailed_description','overall_soundscape','non_diegetic_music']);
  assert.match(result.prompt,/\[Shot 1\]/);assert.doesNotMatch(result.prompt,/\[Shot 2\]/);
  assert.match(result.prompt,/Within the same uncut shot, from 00:07.000 to 00:14.000/);
  assert.deepEqual(result.referenceMap.map(r=>r.label),['<Picture 1>','<Picture 2>','<Picture 3>']);
  assert.deepEqual(result.referenceMap.flatMap(r=>r.subjects.map(s=>s.label)),['<Subject 1>','<Subject 2>','<Subject 3>']);
  assert.equal(compileH3(item.input).hash,result.hash);
  assert.equal(Boolean(item.directorConflict),index===4);
 }
});
