import {db} from '../src/lib/db.ts';
import {videoTick,safeReason} from '../src/lib/jobs.ts';
import {renderOneIfWaiting} from '../src/lib/render-worker.ts';
let stopped=false;const controller=new AbortController();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopped=true;controller.abort()});
console.log('[cineweave-worker] starting',process.argv.includes('--once')?'once':'continuous');
do {
 try{await videoTick();await renderOneIfWaiting();}catch(e){console.error('[cineweave-worker]',safeReason(e));}
 if(process.argv.includes('--once'))break;
 if(stopped)break;await new Promise<void>(resolve=>{const onAbort=()=>{clearTimeout(timer);resolve()};const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',onAbort);resolve()},5000);controller.signal.addEventListener('abort',onAbort,{once:true});});
}while(!stopped);
await db().end();console.log('[cineweave-worker] stopped');
