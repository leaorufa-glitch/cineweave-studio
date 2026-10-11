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

test("director Shot↔Generation Clip many-to-many, duration rules, genuine continuation gating", {skip:!integration&&"Requires isolated PostgreSQL and a running local application"}, async()=>{
 const project=await api("/projects","POST",{name:"CW03 test "+randomUUID(),idea:"肖像、镜头与 Clip 分离"});
 assert.equal(project.status,201);
 const film=project.data.filmId;
 const scene=await api("/films/"+film+"/units","POST",{kind:"scene",title:"场景一",content:"演员提起钥匙，保持连续表演"});
 assert.equal(scene.status,201);
 const shot=await api("/films/"+film+"/shots","POST",{sceneUnitId:scene.data.id,title:"长镜头跨 Clip",description:"绝不剪切",sequenceNumber:1});
 assert.equal(shot.status,201);
 const longClip=await api("/films/"+film+"/clips","POST",{title:"非法 16 秒",prompt:"不允许",seconds:16,aspectRatio:"16:9"});
 assert.equal(longClip.status,400);
 const first=await api("/films/"+film+"/clips","POST",{title:"12 秒前段",prompt:"演员从口袋拿出钥匙",seconds:12,aspectRatio:"16:9"});
 const second=await api("/films/"+film+"/clips","POST",{title:"10 秒后段",prompt:"真正 Motion Context 待自有 H3",seconds:10,aspectRatio:"16:9",continuationParentClipId:first.data.id});
 assert.equal(first.status,201);assert.equal(second.status,201);
 const link1=await api("/clips/"+first.data.id+"/shots","POST",{shotId:shot.data.id,clipStartSeconds:0,clipEndSeconds:12});
 const link2=await api("/clips/"+second.data.id+"/shots","POST",{shotId:shot.data.id,clipStartSeconds:0,clipEndSeconds:10});
 assert.equal(link1.status,201);assert.equal(link2.status,201);
 const shots1=await api("/clips/"+first.data.id+"/shots");
 const shots2=await api("/clips/"+second.data.id+"/shots");
 assert.equal(shots1.data[0].shot_id,shot.data.id);
 assert.equal(shots2.data[0].shot_id,shot.data.id);
 const blocked=await fetch(origin+"/api/clips/"+second.data.id+"/runs",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"native-continuation-no-fake-run"},body:"{}"});
 assert.equal(blocked.status,409);
 const blockedMessage=await blocked.json();assert.match(blockedMessage.error,/Motion Context/);
 const emptyRender=await fetch(origin+"/api/films/"+film+"/renders",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"no-timeline-render-guard"},body:"{}"});
 assert.equal(emptyRender.status,409);
});
