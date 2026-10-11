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
 let reviewLoad=0;
 const qaLabel=value=>({needs_review:"待人工审片",needs_changes:"待返工",accepted:"人工审片通过"}[value]||value);
 function reviewElement(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;if(["input","select","textarea"].includes(tag))node.classList.add("input");return node;}
 function reviewField(label,input){const wrapper=reviewElement("label",label,"vstack");wrapper.append(input);return wrapper;}
 async function showTakeReviews(selectedClip,selectedTake,comparisonTake){
  if(!s.project)throw Error("请先选择真实工程");
  const film=s.project.filmId,load=++reviewLoad;
  const takes=await api("/films/"+film+"/takes");
  if(load!==reviewLoad||s.project?.filmId!==film||proto.state.page!==6)return;
  document.getElementById("cw-take-review")?.remove();
  const section=document.querySelector(".review-layout > section");
  if(!section)return;
  const card=reviewElement("div",null,"card");card.id="cw-take-review";card.style.margin="16px 0";
  const heading=reviewElement("h2","真实 Take 对比与审片");card.append(heading);
  const message=reviewElement("p","人工结论与时间码反馈会保存到当前工程。生成完成不会自动通过审片。","text-note");card.append(message);
  const feedback=reviewElement("p");feedback.setAttribute("role","status");feedback.id="cw-review-status";card.append(feedback);
  section.insertBefore(card,section.querySelector(".timeline"));
  if(!takes.length){feedback.textContent="当前工程尚无真实 Take。生成完成并保存媒体后，可在此审片。";return;}
  const clips=[...new Map(takes.map(t=>[t.clip_id,t.clip_title])).entries()];
  const clipId=clips.some(x=>x[0]===selectedClip)?selectedClip:clips[0][0];
  const options=takes.filter(t=>t.clip_id===clipId);
  const chosen=options.find(t=>t.id===selectedTake)||options[0];
  const clipSelect=reviewElement("select");clipSelect.id="cw-review-clip";
  clips.forEach(([key,title])=>clipSelect.add(new Option(title,key)));clipSelect.value=clipId;
  const takeSelect=reviewElement("select");takeSelect.id="cw-review-take";
  options.forEach(t=>takeSelect.add(new Option(t.id.slice(0,8)+" · "+qaLabel(t.qa_status)+(t.adopted?" · 已采用":""),t.id)));takeSelect.value=chosen.id;
  const compareSelect=reviewElement("select");compareSelect.id="cw-review-compare";compareSelect.add(new Option("不对比",""));
  options.filter(t=>t.id!==chosen.id).forEach(t=>compareSelect.add(new Option("Take "+t.id.slice(0,8),t.id)));
  compareSelect.value=options.some(t=>t.id===comparisonTake&&t.id!==chosen.id)?comparisonTake:"";
  const selectors=reviewElement("div",null,"grid three");selectors.append(reviewField("生成 Clip",clipSelect),reviewField("审片 Take",takeSelect),reviewField("同 Clip 对比 Take",compareSelect));card.append(selectors);
  const operate=fn=>async()=>{
   if(card.dataset.busy)return;
   card.dataset.busy="true";card.querySelectorAll("button,input,textarea,select").forEach(e=>e.disabled=true);
   try{if(s.project?.filmId!==film||!card.isConnected)throw Error("工程已切换，请重新打开审片");await fn();}
   catch(e){feedback.textContent="操作失败："+(e?.message||String(e));}
   finally{delete card.dataset.busy;card.querySelectorAll("button,input,textarea,select").forEach(e=>e.disabled=false);}
  };
  clipSelect.onchange=operate(()=>showTakeReviews(clipSelect.value));
  takeSelect.onchange=operate(()=>showTakeReviews(clipId,takeSelect.value));
  compareSelect.onchange=operate(()=>showTakeReviews(clipId,chosen.id,compareSelect.value));
  let detail,issues;
  try{[detail,issues]=await Promise.all([api("/takes/"+chosen.id),api("/takes/"+chosen.id+"/issues")]);}
  catch(e){feedback.textContent="无法审片："+(e?.message||String(e));return;}
  if(load!==reviewLoad||s.project?.filmId!==film||!card.isConnected)return;
  const players=reviewElement("div",null,"grid two");players.style.margin="14px 0";
  const video=reviewElement("video");video.id="cw-review-video";video.src=detail.mediaUrl;video.controls=true;video.playsInline=true;video.preload="metadata";video.style.width="100%";
  const first=reviewElement("div");first.append(reviewElement("p","审片 Take "+chosen.id.slice(0,8)+" · "+detail.durationSeconds.toFixed(2)+" 秒 · "+qaLabel(detail.qa_status),"small"),video);players.append(first);
  if(compareSelect.value){
   const other=options.find(t=>t.id===compareSelect.value),v=reviewElement("video");v.id="cw-compare-video";v.src="/api/media/"+other.media_id+"/file";v.controls=true;v.playsInline=true;v.preload="metadata";v.style.width="100%";
   video.onplay=()=>v.pause();v.onplay=()=>video.pause();
   const second=reviewElement("div");second.append(reviewElement("p","对比 Take "+other.id.slice(0,8)+" · "+qaLabel(other.qa_status),"small"),v);players.append(second);
  }card.append(players);
  const time=reviewElement("input");time.id="cw-review-time";time.type="number";time.min="0";time.max=String(detail.durationSeconds);time.step="0.01";time.value="0";
  const capture=reviewElement("button","使用当前播放时间","btn sm");capture.type="button";capture.onclick=()=>{time.value=video.currentTime.toFixed(2);};
  const target=reviewElement("select");target.id="cw-review-target";target.add(new Option("Clip · "+detail.clip_title,"clip:"+detail.clip_id));
  detail.shots.forEach(sh=>target.add(new Option("Shot · "+sh.title,"shot:"+sh.id)));
  detail.assets.forEach(a=>target.add(new Option("资产 · "+a.name+" / "+a.variant,"asset:"+a.id)));
  const reason=reviewElement("textarea");reason.id="cw-review-reason";reason.rows=2;reason.maxLength=4000;reason.placeholder="例如：钥匙变形、人物站位跳变或对白语速不符";
  const row=reviewElement("div",null,"grid two");row.append(reviewField("问题时间（Take 源视频秒）",time),reviewField("返工对象",target));card.append(row,capture,reviewField("问题与返工原因",reason));
  const save=reviewElement("button","保存时间码问题","btn");save.id="cw-review-save";save.type="button";
  save.onclick=operate(async()=>{
   const [kind,id]=target.value.split(":");
   await api("/takes/"+chosen.id+"/issues","POST",{expectedTakeVersion:detail.review_version,timeSeconds:Number(time.value),reason:reason.value,targetKind:kind,targetId:id});
   await showTakeReviews(clipId,chosen.id,compareSelect.value);
  });card.append(save);
  const issueList=reviewElement("div");issueList.id="cw-review-issues";card.append(issueList);
  for(const issue of issues){
   const item=reviewElement("div",null,"qa-item");item.dataset.issueId=issue.id;
   const label=issue.target_kind==="asset"?detail.assets.find(a=>a.id===issue.target_id)?.name:issue.target_kind==="shot"?detail.shots.find(sh=>sh.id===issue.target_id)?.title:detail.clip_title;
   item.append(reviewElement("strong",Number(issue.time_seconds).toFixed(2)+" 秒 · "+(label||issue.target_kind)+" · "+(issue.status==="open"?"待处理":"已解决")),reviewElement("p",issue.reason));
   const seek=reviewElement("button","定位播放时间","btn sm");seek.type="button";seek.onclick=()=>{video.currentTime=Number(issue.time_seconds);video.pause();video.scrollIntoView({block:"center"});};item.append(seek);
   const go=reviewElement("button","返回返工工作区","btn sm");go.type="button";go.onclick=operate(async()=>{
    const asset=detail.assets.find(a=>a.id===issue.target_id);
    if(asset){s.asset=(await api("/films/"+film+"/assets")).find(a=>a.id===asset.id);await loadAssets();}
    proto.turnPage(issue.target_kind==="asset"?2:issue.target_kind==="shot"?3:4);
    const preview=el("cw-preview");preview.replaceChildren(reviewElement("h4","正式返工对象 · "+(label||issue.target_kind)),reviewElement("p","ID："+issue.target_id),reviewElement("p","来源 Take："+chosen.id+" / "+Number(issue.time_seconds).toFixed(2)+" 秒"),reviewElement("p",issue.reason));
    notify("已返回对应工作区。正式对象和时间码问题已载入工程面板；原型示例不代表该正式对象。");
   });item.append(go);
   if(issue.status==="open"){
    const resolution=reviewElement("input");resolution.placeholder="填写处理结果或重新核对的依据";resolution.maxLength=4000;resolution.setAttribute("aria-label","问题处理结果");
    const resolve=reviewElement("button","标记已解决","btn sm");resolve.type="button";
    resolve.onclick=operate(async()=>{await api("/review-issues/"+issue.id+"/resolve","POST",{expectedVersion:issue.version,resolution:resolution.value});await showTakeReviews(clipId,chosen.id,compareSelect.value);});item.append(resolution,resolve);
   }else item.append(reviewElement("p","处理结果："+issue.resolution,"text-note"));
   issueList.append(item);
  }
  const note=reviewElement("textarea");note.id="cw-review-note";note.rows=2;note.maxLength=4000;note.placeholder="填写音画、连续性、表演与节奏的人工审片结论";card.append(reviewField("审片结论",note));
  const decisions=reviewElement("div",null,"flex");
  for(const [state,label] of [["accepted","人工审片通过"],["needs_changes","标记待返工"]]){
   const button=reviewElement("button",label,"btn sm");button.type="button";button.dataset.reviewState=state;
   button.onclick=operate(async()=>{await api("/takes/"+chosen.id+"/review","POST",{expectedTakeVersion:detail.review_version,qaStatus:state,note:note.value});await showTakeReviews(clipId,chosen.id,compareSelect.value);});decisions.append(button);
  }
  const adopt=reviewElement("button","采用此 Take","btn sm");adopt.id="cw-review-adopt";adopt.type="button";
  adopt.onclick=operate(async()=>{const clips=await api("/films/"+film+"/clips"),current=clips.find(c=>c.id===clipId);await api("/takes/"+chosen.id+"/adopt","POST",{expectedClipVersion:current.version});await showTakeReviews(clipId,chosen.id,compareSelect.value);});decisions.append(adopt);card.append(decisions);
  const history=reviewElement("details");history.append(reviewElement("summary","审片历史（"+detail.decisions.length+" 条）"));
  detail.decisions.forEach(d=>history.append(reviewElement("p","v"+d.review_version+" · "+qaLabel(d.qa_status)+" · "+d.note,"text-note")));card.append(history);
  feedback.textContent="当前："+qaLabel(detail.qa_status)+" · "+issues.filter(i=>i.status==="open").length+" 个未解决问题 · "+(detail.adopted?"已采用":"未采用");
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
    addButton(document.querySelector("[data-action='export']"),"审片真实 Take","review-takes");
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
    "real-export":renderRealMovie,"show-timeline":showTimeline,"show-renders":showRenders,"review-takes":()=>showTakeReviews(),
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
