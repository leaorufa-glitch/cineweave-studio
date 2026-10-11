import {spawn} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
import assert from "node:assert/strict";

const port=32781, base="http://127.0.0.1:"+port;
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{cwd:process.cwd(),stdio:"ignore"});
let started=false;
try{
 for(let n=0;n<60;n++){
  if(server.exitCode!==null)throw new Error("Next process exited before listening");
  try{const r=await fetch(base+"/",{redirect:"manual",signal:AbortSignal.timeout(1500)});if(r.status===307||r.status===308){assert.match(r.headers.get("location")??"",/\/approved\/index\.html/);started=true;break;}}catch{}
  await delay(250);
 }
 assert.ok(started,"Next server did not serve redirect");
 for(const path of ["/approved/index.html","/approved/style.css","/approved/app.js","/bridge.js","/approved/media/hero.jpg"]){
  const r=await fetch(base+path);
  assert.equal(r.status,200,path+" status");assert.ok(Number(r.headers.get("content-length")??0)>0||((await r.arrayBuffer()).byteLength>0),path+" empty");
 }
 console.log("PASS HTTP smoke: homepage redirect, approved HTML/CSS/JS, media, persistence bridge.");
}finally{
 server.kill("SIGTERM");
 await Promise.race([new Promise(resolve=>server.once("exit",resolve)),delay(3000)]);
}
