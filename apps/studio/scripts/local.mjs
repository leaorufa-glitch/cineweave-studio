// Local supervisor. PostgreSQL must already be running; creator-authorized sharing uses a separate tunnel.
import {spawn} from 'node:child_process';
const port=process.env.PORT||'32787';if(!/^\d+$/.test(port)||Number(port)<1024||Number(port)>65535)throw Error('Invalid local port');
const children=[];let closing=false;
const start=args=>{const child=spawn(process.execPath,args,{cwd:process.cwd(),env:process.env,stdio:'inherit'});children.push(child);child.once('error',()=>shutdown(1));child.once('exit',code=>{if(!closing)shutdown(code??1)});return child};
function shutdown(code=0){if(closing)return;closing=true;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');const timer=setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL')},20000);timer.unref();Promise.all(children.map(c=>c.exitCode===null?new Promise(r=>c.once('exit',r)):Promise.resolve())).then(()=>{clearTimeout(timer);process.exitCode=code});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>shutdown());
start(['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',port]);
if(process.env.CINEWEAVE_TEST_MODE!=='1')start(['--experimental-strip-types','--env-file-if-exists=.env.local','scripts/worker.ts']);
