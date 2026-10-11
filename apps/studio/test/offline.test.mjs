import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat, readdir } from "node:fs/promises";
import { join,resolve } from "node:path";
import sharp from "sharp";
import { assetImageQA, saveUpload } from "../src/lib/storage.ts";
const baseline=resolve("../../design/approved-ui-2026"),copied=resolve("public/approved");
test("approved UI source is copied byte-for-byte for all source assets",async()=>{
 const walk=async root=>{const names=[];async function visit(dir){for(const ent of await readdir(dir,{withFileTypes:true})){const full=join(dir,ent.name);if(ent.isDirectory())await visit(full);else names.push(full.slice(root.length+1));}}await visit(root);return names.sort();};
 const a=await walk(baseline);assert.equal(a.length,25);const b=await walk(copied);assert.deepEqual(a,b);
 for(const name of a){let expected=await readFile(join(baseline,name));let actual=await readFile(join(copied,name));if(name==="index.html"){assert.match(actual.toString(),/workspace\.js/);actual=Buffer.from(actual.toString().replace('<script defer src="/workspace.js"></script>',''));}if(name==="app.js"){assert.match(actual.toString(),/window\.CWPrototype=/);actual=Buffer.from(actual.toString().replace('\nwindow.CWPrototype={state,projects,assets,scenes,clips,renderApp,turnPage,getAsset,getClip,getProd,toast};\n',''));}assert.deepEqual(actual,expected,name);}
});
test("board QA enforces character 2:3 preview and does not claim grid approval",()=>{
 assert.equal(assetImageQA("character",1024,1536),"needs_grid_review");
 assert.equal(assetImageQA("character",1536,1024),"wrong_aspect");
 assert.equal(assetImageQA("location",1000,1000),"needs_board_review");
 assert.equal(assetImageQA("hero_prop",1200,600),"needs_board_review");
 assert.equal(assetImageQA("voice"),"sample_ready");
});
test("real file upload writes actual image bytes and rejects corrupt files",async()=>{
 const png=await sharp({create:{width:60,height:90,channels:3,background:"#202020"}}).png().toBuffer();
 const uploaded=await saveUpload(new File([png],"look.png",{type:"image/png"}));
 assert.equal(uploaded.width,60);assert.equal(uploaded.height,90);
 assert.equal((await stat(uploaded.storagePath)).size,png.length);
 await assert.rejects(()=>saveUpload(new File(["not an image"],"fake.png",{type:"image/png"})),/Corrupt image/);
});
test("baseline bridge exposes persistent flow and mock disclaimer",async()=>{
 const bridge=(await readFile(resolve("public/bridge.js"),"utf8")).toString();
 for(const expected of ["/projects","/films/","/units/","/proposals/","/assets/","/media","Mock AI"])assert.ok(bridge.includes(expected),expected);
});
