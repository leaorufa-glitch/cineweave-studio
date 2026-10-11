import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {compileH3} from '../src/lib/h3-compiler.ts';
import {watchmakerInputs} from '../test/fixtures/h3-watchmaker-six.mjs';

const directory=resolve('../../output/h3-recovery-20261012/six-clips-offline');
await mkdir(directory,{recursive:true});
const manifest=[];
for(const [index,item] of watchmakerInputs.entries()){
 const result=compileH3(item.input),name=String(index+1).padStart(2,'0');
 await writeFile(resolve(directory,`${name}-compiled-prompt.txt`),result.prompt+'\n');
 manifest.push({clip:item.title,clipId:item.input.source.clipId,legacyDirectorBrief:item.legacy,mode:item.input.mode,rulesVersion:result.rulesVersion,hash:result.hash,formatValid:result.formatValid,submitEligible:result.submitEligible,referenceMap:result.referenceMap.map(r=>({assetId:r.assetId,revisionId:r.revisionId,mediaId:r.mediaId,sha256:r.sha256,label:r.label,subjects:r.subjects.map(s=>s.label),role:r.role,uploadIndex:r.uploadIndex})),issues:result.issues,directorConflict:item.directorConflict,promptFile:`${name}-compiled-prompt.txt`});
}
await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({directory,clips:manifest.map(x=>({clip:x.clip,formatValid:x.formatValid,submitEligible:x.submitEligible,hash:x.hash,directorConflict:!!x.directorConflict}))},null,2));
