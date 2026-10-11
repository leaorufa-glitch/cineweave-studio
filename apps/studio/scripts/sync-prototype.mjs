import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve(process.cwd(),'../../design/approved-ui-2026'),dest=resolve(process.cwd(),'public/approved');
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});await cp(source,dest,{recursive:true});
const html=await readFile(resolve(dest,'index.html'),'utf8');
await writeFile(resolve(dest,'index.html'),html.replace('</body>','<script defer src="/workspace.js"></script></body>'));
// Compile only shared approved icons/helpers. Demo data, listeners and simulated
// production actions are excluded from the served runtime. Never edit originals.
const app=await readFile(resolve(dest,'app.js'),'utf8'),boundary=app.indexOf('const projects=');
if(boundary<0)throw Error('Approved runtime boundary changed; review compilation before continuing');
await writeFile(resolve(dest,'app.js'),app.slice(0,boundary)+'\n/* Production views and persistence: /workspace.js */\n');
console.log('Copied approved visual resources; compiled production workspace runtime.');
