import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const origin=process.env.CINEWEAVE_TEST_BASE_URL;
const integration=Boolean(origin);
async function api(route,method="GET",body){
 const options={method};
 if(body instanceof FormData)options.body=body;
 else if(body!==undefined){options.headers={"content-type":"application/json"};options.body=JSON.stringify(body);}
 const res=await fetch(origin+"/api"+route,options);
 const data=await res.json();
 return {status:res.status,data};
}

test("persistent film, immutable scripts, Mock review, and adopted media", {skip:!integration&&"Set CINEWEAVE_TEST_BASE_URL to a running app with an isolated PostgreSQL database"},async()=>{
 const filmName="CW02 integration "+randomUUID();
 const p=await api("/projects","POST",{name:filmName,idea:"一场关于选择的戏"});
 assert.equal(p.status,201);assert.ok(p.data.filmId);
 const projects=await api("/projects");assert.equal(projects.status,200);assert.ok(projects.data.some(x=>x.id===p.data.id));
 const u=await api("/films/"+p.data.filmId+"/units","POST",{kind:"scene",title:"深夜告别",content:"角色走进雨里"});
 assert.equal(u.status,201);assert.equal(u.data.version,1);
 const updated=await api("/units/"+u.data.id+"/revisions","POST",{expectedVersion:1,content:"雨夜，角色缓慢打开门。"});
 assert.equal(updated.status,201);assert.equal(updated.data.version,2);
 const stale=await api("/units/"+u.data.id+"/revisions","POST",{expectedVersion:1,content:"不应覆盖的内容"});
 assert.equal(stale.status,409);
 const proposal=await api("/units/"+u.data.id+"/proposals","POST",{direction:"加强人物内心矛盾"});
 assert.equal(proposal.status,201);assert.equal(proposal.data.mock,true);
 const beforeAdopt=await api("/units/"+u.data.id);assert.equal(beforeAdopt.data.version,2);
 const adopt=await api("/proposals/"+proposal.data.id+"/adopt","POST",{expectedVersion:2});
 assert.equal(adopt.status,200);assert.equal(adopt.data.version,3);
 const again=await api("/proposals/"+proposal.data.id+"/adopt","POST",{expectedVersion:2});
 assert.equal(again.status,409);
 const revisions=await api("/units/"+u.data.id+"/revisions");
 assert.equal(revisions.data.length,3);
 assert.equal(revisions.data[0].source,"creator");
 assert.equal(revisions.data[2].source,"mock_ai_adopted");
 const png=await sharp({create:{width:100,height:150,channels:3,background:"#747474"}}).png().toBuffer();
 const f=new FormData();f.append("file",new File([png],"character-look.png",{type:"image/png"}));
 const upload=await api("/media","POST",f);assert.equal(upload.status,201);assert.equal(upload.data.width,100);
 const asset=await api("/films/"+p.data.filmId+"/assets","POST",{kind:"character",name:"主角",variant:"Look A"});
 assert.equal(asset.status,201);
 const rev=await api("/assets/"+asset.data.id+"/revisions","POST",{expectedVersion:0,mediaId:upload.data.id,description:"整张四宫格候选"});
 assert.equal(rev.status,201);assert.equal(rev.data.qaStatus,"needs_grid_review");
 const assetStale=await api("/assets/"+asset.data.id+"/revisions","POST",{expectedVersion:0,mediaId:upload.data.id,description:"旧版本"});
 assert.equal(assetStale.status,409);
 const adopted=await api("/assets/"+asset.data.id+"/revisions");
 assert.equal(adopted.status,200);assert.equal(adopted.data.length,1);
 const file=await fetch(origin+upload.data.url);assert.equal(file.status,200);assert.equal((await file.arrayBuffer()).byteLength,png.length);
});
