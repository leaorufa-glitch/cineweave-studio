/* Approved UI runtime integration. Source design/approved-ui-2026 remains unmodified. */
(()=>{
 const proto=window.CWPrototype, runtime=window.CWRuntime;
 if(!proto||!runtime)return;
 const {s,api,status,showPanel,el,loadProjects,loadUnits,loadAssets}=runtime;
 let busy=false; s.realClipIdsByDemo={};
 const notify=(message)=>{status(message);showPanel();};
 function demoAssetInfo(){
  const a=proto.getAsset();
  const type=proto.state.assetCategory;
  const kind=type==="roles"?"character":type==="scenes"?"location":"hero_prop";
  const variant=type==="roles"?(a.looks?.[proto.state.lookSelected]?.[0]||"Look 01"):type==="scenes"?(a.env?.[0]||"默认环境"):"默认状态";
  return {kind,name:a.name,variant,description:a.desc||a.detail||""};
 }
 async function ensureDemoAsset(){
  if(!s.project)throw Error("请先从首页创建正式工程，或在工程面板选择已有工程");
  const detail=demoAssetInfo(), all=await api("/films/"+s.project.filmId+"/assets");
  let asset=all.find(a=>a.kind===detail.kind&&a.name===detail.name&&a.variant===detail.variant);
  if(!asset){
   const created=await api("/films/"+s.project.filmId+"/assets","POST",detail);
   asset={...detail,...created};
  }
  s.asset=asset;await loadAssets();return asset;
 }
 function candidatePreview(candidate){
  const preview=el("cw-preview");
  preview.textContent="";
  const img=document.createElement("img");img.src=candidate.url;img.alt="真实 AI 图板候选，尚未采用";preview.append(img);
  const msg=document.createElement("p");msg.textContent="真实生成候选 · "+candidate.width+"×"+candidate.height+" · "+candidate.qaStatus+"。请逐格核对，再决定是否采用。";preview.append(msg);
  const button=document.createElement("button");button.textContent="我已核对，采用此候选为正式资产版本";
  button.onclick=run(async()=>{
   if(!s.asset)throw Error("请先选择资产");
   const r=await api("/assets/"+s.asset.id+"/revisions","POST",{expectedVersion:s.asset.version,mediaId:candidate.mediaId,description:"用户审阅并手动采用 GPT Image 2 候选"});
   s.asset.version=r.version;await loadAssets();
   notify("已人工采用图板正式版本 v"+r.version+"。自动视觉 QA 仍需人工确认，不冒充已通过内容审片。");
   button.disabled=true;
  });preview.append(button);
 }
 const run=fn=>async()=>{if(busy){notify("当前任务正在处理，请勿重复提交。");return;}busy=true;try{await fn()}catch(e){notify("操作失败："+(e?.message||String(e)))}finally{busy=false}};
 async function createRealProject(){
  const idea=document.getElementById("home-idea")?.value?.trim()||"";
  const name=el("cw-project-name")?.value?.trim()|| (idea?idea.slice(0,18):"新影视工程 "+new Date().toLocaleDateString("zh-CN"));
  s.project=await api("/projects","POST",{name,idea});
  localStorage.setItem("cineweave:active-project",s.project.id);
  s.unit=null;s.asset=null;
  await Promise.all([loadProjects(),loadUnits(),loadAssets()]);
  proto.state.project=name;proto.state.idea=idea;proto.turnPage(1);
  notify("正式工程《"+name+"》已保存到 PostgreSQL。可创建第一场剧本，并使用真实 AI 提案。页面中的故事示例仍标注为模板。");
 }
 async function openRealProjectList(){
  await loadProjects();showPanel();
  el("cw-project-select")?.focus();
  notify("真实工程列表已刷新；在右下角工程面板选择项目。主页演示项目卡不是数据库记录。");
 }
 function selectedScriptContext(){
  return el("cw-script")?.value||proto.state.idea||"请围绕当前影片的故事目标进行专业影视创作建议。";
 }
 async function realChat(message){
  message=(message||document.getElementById("chat-input")?.value||"").trim();
  if(!message)return;
  proto.state.chat.push({role:"user",text:message});
  proto.state.chat.push({role:"bot",text:"正在调用 DeepSeek V4.1 Flash，生成可审阅的专业影视建议……"});
  proto.state.assistantOpen=true;proto.renderApp(false);
  try{
   const r=await api("/ai/chat","POST",{filmId:s.project?.filmId||null,context:selectedScriptContext(),message});
   proto.state.chat[proto.state.chat.length-1]={role:"bot",text:r.answer+"\n\n【真实 AI 建议，尚未自动修改正式剧本】"};
   notify("DeepSeek 已完成真实建议。要形成正式剧本版本，请在工程面板先审阅提案，再点击采纳。");
  }catch(e){proto.state.chat[proto.state.chat.length-1]={role:"bot",text:"模型调用失败："+(e?.message||String(e))};notify("模型请求失败，不会改变正式数据。")}
  proto.renderApp(false);
 }
 async function proposeRealScript(){
  if(!s.unit)throw Error("请在右下角工程面板创建并载入真实场景后再生成正式剧本提案");
  notify("正在生成真实 AI 改写候选。正式剧本不会被覆盖，请等待……");
  const p=await api("/units/"+s.unit.id+"/ai-proposals","POST",{direction:"请从人物目标、冲突升级、潜台词、演员可执行动作和自然音画出发，给出专业改写稿"});
  s.proposal=p;
  el("cw-proposal-text").textContent=(p.explanation||"")+"\n\n【候选剧本】\n"+p.suggestion;
  el("cw-proposal").hidden=false;showPanel();
  notify("真实 AI 待审提案已存档（"+p.model+"）。正式剧本仍是 v"+s.unit.version+"；可以采纳或拒绝。");
 }
 async function generateRealAsset(){
  const a=await ensureDemoAsset();
  notify("正在通过 GPT Image 2 生成《"+a.name+"》完整图板。预计可能需要一分钟；候选不会自动采用。");
  const candidate=await api("/assets/"+a.id+"/generate","POST",{prompt:a.description});
  candidatePreview(candidate);
  notify("已生成真实图板候选，QA："+candidate.qaStatus+"。请检查四格/1+3 内容后人工采用。");
 }
 async function uploadRealAsset(){
  const a=await ensureDemoAsset();s.asset=a;
  proto.state.uploadIntent="real-asset";
  document.getElementById("hidden-upload")?.click();
  notify("请选择完整图板或适用的声音素材。上传后保存真实媒体；点击采用前请确认版本。");
 }
 async function handleUploadedFile(file){
  if(!s.asset)return notify("还没有选定正式资产");
  const form=new FormData();form.append("file",file);
  const media=await api("/media","POST",form);
  const candidate={...media,mediaId:media.id,qaStatus:"manual_upload_needs_review"};
  candidatePreview(candidate);
  notify("已真正上传 "+media.name+"（"+media.bytes+" 字节）。媒体文件已持久保存，尚未采用，请人工确认。");
 }
 async function buildClipForDemo(demo){
  const existing=await api("/films/"+s.project.filmId+"/clips");
  const title=demo.id+" · "+demo.title;
  let clip=existing.find(c=>c.title===title);
  if(clip)return clip;
  let text=[demo.brief,...demo.shots.map(sh=>sh.from+"："+sh.desc)].join("\n");
  const result=await api("/films/"+s.project.filmId+"/clips","POST",{
   title,prompt:text,seconds:demo.sec,aspectRatio:"16:9",continuationParentClipId:null,
   referenceMediaIds:s.asset?.media_id?[s.asset.media_id]:[]
  });
  const allShots=await api("/films/"+s.project.filmId+"/shots");
  for(let i=0;i<demo.shots.length;i++){
   const shot=demo.shots[i],shotTitle=demo.scene+" · Shot "+shot.id;
   let formal=allShots.find(a=>a.title===shotTitle);
   if(!formal){formal=await api("/films/"+s.project.filmId+"/shots","POST",{title:shotTitle,description:shot.desc,sequenceNumber:i+1});allShots.push(formal);}
   const [from,to]=shot.from.split(/[–—-]/).map(x=>x.trim());
   const convert=x=>{const seg=x.split(":").map(Number);return seg.length===2?seg[0]*60+seg[1]:Number(x)||0;};
   const offset=convert(from)-convert(demo.shots[0].from.split(/[–—-]/)[0]);
   const end=convert(to)-convert(demo.shots[0].from.split(/[–—-]/)[0]);
   const start=Math.max(0,Math.min(demo.sec,offset)),finish=Math.max(start+0.01,Math.min(demo.sec,end));
   await api("/clips/"+result.id+"/shots","POST",{shotId:formal.id,clipStartSeconds:start,clipEndSeconds:finish});
  }
  return result;
 }
 async function startRealVideo(){
  if(!s.project)throw Error("先在首页建立正式工程");
  const demo=proto.getProd();
  if(demo.continueFrom)throw Error(demo.id+" 依赖真正 Motion Context 原生续接。RunningHub 不具备这项能力，不能伪装成已续接。");
  notify("正在整理 "+demo.id+" 导演 Shot / Clip 并提交真实 H3 任务，请勿重复点击。");
  const clip=await buildClipForDemo(demo);
  const key="native-ui-"+s.project.id+"-"+demo.id+"-take-1";
  const r=await fetch("/api/clips/"+clip.id+"/runs",{method:"POST",headers:{"content-type":"application/json","Idempotency-Key":key},body:"{}"});
  const runData=await r.json();
  if(!r.ok)throw Error(runData.error||"Run 创建失败");
  s.realClipIdsByDemo[demo.id]={clipId:clip.id,runId:runData.id};
  notify("真实 "+demo.id+" Run 已创建，状态："+runData.status+"。Worker 正在提交或轮询 RunningHub；重复点击不重复扣费。");
 }
 async function showRuns(){
  if(!s.project)throw Error("请先选择工程");
  const demo=proto.getProd();
  const clips=await api("/films/"+s.project.filmId+"/clips");
  const clip=clips.find(c=>c.title===demo.id+" · "+demo.title);
  if(!clip)return notify("该 Clip 尚未建立真实任务。请先点击“真实 RunningHub H3 生成”。");
  const runs=await api("/clips/"+clip.id+"/runs");
  const host=el("cw-preview");host.replaceChildren();
  for(const r of runs){
   const div=document.createElement("p");div.textContent="Run "+r.id.slice(0,8)+" · "+r.status+(r.error?" · "+r.error:"");host.append(div);
   if(r.media_id){
    const v=document.createElement("video");v.src="/api/media/"+r.media_id+"/file";v.controls=true;v.playsInline=true;v.style.maxWidth="100%";host.append(v);
    const choose=document.createElement("button");choose.textContent="人工采用此真实 Take";
    choose.onclick=run(async()=>{const c=await api("/films/"+s.project.filmId+"/clips");const current=c.find(x=>x.id===clip.id);const saved=await api("/takes/"+r.take_id+"/adopt","POST",{expectedClipVersion:current.version});notify("正式采用 Take "+r.take_id.slice(0,8)+"，Clip 版本："+saved.version+"，可加入时间线");});
    host.append(choose);
     const add=document.createElement("button");add.textContent="加入正式时间线";
     add.onclick=run(async()=>{
       const currentTimeline=await api("/films/"+s.project.filmId+"/timeline");
       if(currentTimeline.some(x=>x.take_id===r.take_id))return notify("该 Take 已在正式时间线");
       const saved=await api("/films/"+s.project.filmId+"/timeline","POST",{takeId:r.take_id,positionIndex:currentTimeline.length});
       notify("已将真实 Take "+r.take_id.slice(0,8)+" 加入时间线位置 "+(saved.positionIndex+1)+"，可以在审片与成片工作区导出。");
     });host.append(add);
   }
  }
  notify(runs.length?"已刷新 "+demo.id+" 的真实 Run 与 Take":"无真实任务");
 }
 async function showTimeline(){
  if(!s.project)throw Error("先选择真实影视工程");
  const segments=await api("/films/"+s.project.filmId+"/timeline");
  const host=el("cw-preview");host.replaceChildren();
  segments.forEach(seg=>{
   const wrapper=document.createElement("div");wrapper.style.marginBottom="10px";
   const title=document.createElement("p");title.textContent=(seg.position_index+1)+". "+(seg.clip_title||"Clip")+" · Take "+seg.take_id.slice(0,8);wrapper.append(title);
   const video=document.createElement("video");video.src="/api/media/"+seg.media_id+"/file";video.controls=true;video.playsInline=true;video.style.maxWidth="100%";wrapper.append(video);host.append(wrapper);
  });
  notify(segments.length?"正式时间线已载入 "+segments.length+" 段真实视频。演示模板时间线与此不同。":"正式时间线为空，请先到生成制作区人工采用真实 Take 并加入时间线。");
 }
 async function showRenders(){
  if(!s.project)throw Error("先选择真实影视工程");
  const records=await api("/films/"+s.project.filmId+"/renders");
  const host=el("cw-preview");host.replaceChildren();
  for(const job of records){
    const wrapper=document.createElement("div");wrapper.style.marginBottom="14px";
    const title=document.createElement("p");title.textContent="成片 "+job.id.slice(0,8)+" · "+job.status+(job.error?" · "+job.error:"");wrapper.append(title);
    if(job.output_media_id){
      const video=document.createElement("video");video.src="/api/media/"+job.output_media_id+"/file";video.controls=true;video.playsInline=true;video.style.maxWidth="100%";wrapper.append(video);
      if(proto.state.page===6){
        const large=document.getElementById("demo-video");
        if(large){
          large.pause();
          large.poster="";
          large.querySelectorAll("source").forEach(x=>x.remove());
          if(large.src!==video.src){large.src=video.src;large.load();}
          large.setAttribute("aria-label","真实已采用 Take 经 FFmpeg 合成的 MP4");
          const label=document.querySelector("#review-player .player-label");
          if(label)label.textContent="真实 H3 Take → 正式时间线 → FFmpeg 成片 · 未经艺术质量终审";
          const hint=document.querySelector("#review-player + .hint");
          if(hint)hint.textContent="正在预览真实 H3 Take 合成的 MP4，已完成文件与音视频技术检查；下方的剪辑轨道仍是原型布局模板，镜头连续性与故事质量仍需审片确认。";
        }
      }
      const a=document.createElement("a");a.href=video.src;a.download="cineweave-"+job.id.slice(0,8)+".mp4";a.textContent="下载真实 MP4";
      a.style.cssText="display:block;color:#efbd80;margin-top:8px";wrapper.append(a);
    }
    host.append(wrapper);
  }
  notify(records.length?"已载入 "+records.length+" 条真实导出记录（完成后可播放和下载）":"尚无正式成片导出记录。");
 }
 async function renderRealMovie(){
  if(!s.project)throw Error("请先选择真实工程");
  const segments=await api("/films/"+s.project.filmId+"/timeline");
  if(!segments.length)throw Error("正式时间线为空，请先采用 Take 并加入时间线");
  const unique="render-"+s.project.filmId+"-"+segments.map(x=>x.id).join("").slice(0,60);
  const r=await fetch("/api/films/"+s.project.filmId+"/renders",{method:"POST",headers:{"content-type":"application/json","Idempotency-Key":unique},body:"{}"});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||"Render 创建失败");
  await showRenders();
  notify("成片导出已排队："+data.id.slice(0,8)+"（"+data.status+"）。由后台 FFmpeg 真正导出，请稍后刷新查看并下载。");
 }
 function addButton(after,label,action){
  if(!after||after.parentNode.querySelector("[data-cw-action='"+action+"']"))return;
  const b=document.createElement("button");b.className="btn";b.dataset.cwAction=action;b.textContent=label;b.type="button";after.insertAdjacentElement("afterend",b);
 }
 function enhance(){
  const page=proto.state.page;
  if(page===1){
   addButton(document.querySelector("[data-action='assist-story']"),"真实 AI 剧本改写（待审）","real-script");
  }else if(page===2){
   addButton(document.querySelector("[data-action='generate-asset']"),"真实 GPT Image 2 图板","real-image");
  }else if(page===5){
   addButton(document.querySelector("[data-action='simulate-task']"),"真实 RunningHub H3 生成","real-video");
   addButton(document.querySelector("[data-action='compare-takes']"),"查看真实 Run / Take","show-runs");
   }else if(page===6){
    addButton(document.querySelector("[data-action='export']"),"导出正式 MP4","real-export");
    addButton(document.querySelector("[data-action='export']"),"查看真实时间线","show-timeline");
    addButton(document.querySelector("[data-action='export']"),"查看实际成片","show-renders");
  }
 }
 const aRoot=document.getElementById("app");if(aRoot)new MutationObserver(enhance).observe(aRoot,{childList:true,subtree:true});enhance();
 document.addEventListener("click",evt=>{
  const target=evt.target instanceof Element?evt.target.closest("[data-cw-action],[data-action]"):null;
  if(!target)return;
  const action=target.dataset.cwAction||target.dataset.action;
  const intercept={
   "start-project":createRealProject,"project-list":openRealProjectList,
   "real-script":proposeRealScript,"real-image":generateRealAsset,"real-video":startRealVideo,"show-runs":showRuns,
    "real-export":renderRealMovie,"show-timeline":showTimeline,"show-renders":showRenders,
   "upload-asset":uploadRealAsset,
   "script-versions":async()=>{showPanel();if(!s.unit)return notify("先在真实工程面板选择场景");const rev=await api("/units/"+s.unit.id+"/revisions");notify("场景共保存 "+rev.length+" 个正式版本，最近版本："+rev.at(-1)?.revision_number+"。完整版本详情可通过 API 查询。");},
   "confirm-script":async()=>{showPanel();notify(s.unit?"正式剧本当前 v"+s.unit.version+"，如有改动请点击“保存新版本”；演示确认不会修改数据库。":"请在工程面板先建立并编辑真实场景，原型示例不能替代正式剧本。");},
   "chat-send":async()=>realChat(),"chat-quick":async()=>realChat(target.dataset.text),
  };
  if(!intercept[action])return;
  evt.preventDefault();evt.stopImmediatePropagation();
  run(intercept[action])();
 },true);
 document.addEventListener("change",evt=>{
  const target=evt.target;
  if(target?.id!=="hidden-upload"||proto.state.uploadIntent!=="real-asset")return;
  evt.preventDefault();evt.stopImmediatePropagation();
  const file=target.files?.[0];if(file)run(()=>handleUploadedFile(file))();
  proto.state.uploadIntent="";target.value="";
 },true);
})();
