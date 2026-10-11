/* Functional sidecar for the user-approved prototype. Does not rewrite the original HTML. */
(()=>{
const s={project:null,unit:null,asset:null,proposal:null};
const el=document.createElement("div");el.id="cw-real-workspace";
el.innerHTML=`
<button id="cw-toggle" type="button">◆ 工程数据</button>
<section id="cw-panel" hidden>
 <div class="cw-head"><strong>CineWeave · 真实工程</strong><button id="cw-close" aria-label="关闭">×</button></div>
 <small>本面板保存到 PostgreSQL；其他未接入按钮仍为演示原型。Mock AI 不使用付费模型。</small>
 <h4>① 影视工程</h4>
 <div class="cw-line"><input id="cw-project-name" placeholder="作品名称"><button id="cw-new-project">创建工程</button></div>
 <div class="cw-line"><select id="cw-project-select"><option value="">选择已有工程</option></select><button id="cw-refresh">刷新</button></div>
 <h4>② 剧本·正式版本</h4>
 <div class="cw-line"><input id="cw-unit-title" placeholder="场景标题"><button id="cw-new-scene">新建场景</button></div>
 <div class="cw-line"><select id="cw-unit-select"><option value="">选择场景</option></select><button id="cw-load">载入</button></div>
 <textarea id="cw-script" placeholder="场景动作、对白、情感节奏……" rows="4"></textarea>
 <div class="cw-line"><button id="cw-save-script">保存新版本</button><button id="cw-mock">获取 Mock AI 建议</button></div>
 <div id="cw-proposal" hidden><div id="cw-proposal-text"></div><div class="cw-line"><button id="cw-adopt">采纳</button><button id="cw-reject">拒绝</button></div></div>
 <h4>③ 角色 / 美术 / 声音资产</h4>
 <div class="cw-line"><select id="cw-kind"><option value="character">角色 Look 四宫格</option><option value="location">场景 1+3 图板</option><option value="hero_prop">重要道具 1+3 图板</option><option value="voice">声音样本</option></select><input id="cw-asset-name" placeholder="资产名称"></div>
 <div class="cw-line"><input id="cw-variant" value="默认" placeholder="Look/环境状态"><button id="cw-new-asset">建资产</button></div>
 <div class="cw-line"><select id="cw-asset-select"><option value="">选择资产</option></select><input type="file" id="cw-file" accept="image/png,image/jpeg,image/webp,audio/*"></div>
 <div class="cw-line"><button id="cw-upload">上传候选并采用正式版本</button></div>
 <div id="cw-preview"></div>
 <div id="cw-status" role="status">请选择已有工程或创建工程。</div>
</section>`;
const css=document.createElement("style");css.textContent=`
#cw-real-workspace{position:fixed;right:18px;bottom:18px;z-index:999999;font:13px/1.5 system-ui,sans-serif;color:#eff1f8}
#cw-real-workspace *{box-sizing:border-box}
#cw-toggle{background:#dba45e;color:#101522;border:0;padding:12px 20px;border-radius:24px;font-weight:700;box-shadow:0 4px 24px #0008;cursor:pointer}
#cw-panel{background:#101824f5;border:1px solid #384659;border-radius:13px;box-shadow:0 10px 48px #000b;width:min(440px,calc(100vw - 28px));max-height:min(82vh,740px);overflow:auto;padding:17px}
#cw-panel[hidden]{display:none}
#cw-panel h4{font-size:13px;font-weight:700;margin:18px 0 8px;color:#efbb82}
#cw-panel small{color:#aebccd;display:block;margin:8px 0}
#cw-panel button{background:#2b3b50;border:1px solid #546177;color:#eff5ff;padding:7px 9px;border-radius:6px;cursor:pointer}
#cw-panel button:hover{background:#435773}
#cw-panel input,#cw-panel select,#cw-panel textarea{background:#172334;border:1px solid #445167;border-radius:6px;color:white;padding:8px;min-width:0;flex:1}
#cw-panel textarea{display:block;width:100%;resize:vertical}
#cw-panel .cw-line{display:flex;gap:7px;margin:7px 0;align-items:center}
#cw-panel .cw-head{display:flex;justify-content:space-between;align-items:center}
#cw-proposal-text{white-space:pre-wrap;max-height:145px;overflow:auto;background:#202d3c;padding:10px;border-radius:7px}
#cw-status{margin-top:12px;padding:9px;border-radius:7px;background:#1a2938;color:#bad1ee;white-space:pre-wrap}
#cw-preview img{max-height:150px;max-width:100%;object-fit:contain}
@media(max-width:520px){#cw-real-workspace{right:8px;bottom:8px}}
`;
document.head.append(css);document.body.append(el);
const $=id=>document.getElementById(id);
const status=txt=>{$("cw-status").textContent=txt};
const api=async(path,method="GET",data)=>{const init={method};if(data instanceof FormData)init.body=data;else if(data!==undefined){init.headers={"Content-Type":"application/json"};init.body=JSON.stringify(data)}
 const response=await fetch("/api"+path,init);let result=await response.json().catch(()=>({error:"Invalid response"}));if(!response.ok)throw new Error(result.error||response.statusText);return result};
const task=fn=>async()=>{try{await fn()}catch(e){status("操作失败："+e.message)}};
$("cw-toggle").onclick=()=>{$("cw-panel").hidden=!$("cw-panel").hidden};
$("cw-close").onclick=()=>{$("cw-panel").hidden=true};
const loadProjects=async()=>{
 const projects=await api("/projects"),sel=$("cw-project-select");sel.innerHTML='<option value="">选择已有工程</option>';
 projects.forEach(p=>{const o=new Option(p.name,p.id);o.dataset.film=p.film_id;sel.add(o)});
 if(s.project)sel.value=s.project.id;
};
const loadUnits=async()=>{const sel=$("cw-unit-select");sel.innerHTML='<option value="">选择场景</option>';if(!s.project)return;
 const arr=await api("/films/"+s.project.filmId+"/units");arr.forEach(u=>{const o=new Option(u.title+" · v"+u.version,u.id);sel.add(o)});if(s.unit)sel.value=s.unit.id;};
const loadAssets=async()=>{const sel=$("cw-asset-select");sel.innerHTML='<option value="">选择资产</option>';if(!s.project)return;
 const arr=await api("/films/"+s.project.filmId+"/assets");arr.forEach(a=>{const o=new Option(a.kind+" / "+a.name+" ["+a.variant+"] v"+a.version,a.id);sel.add(o)});if(s.asset)sel.value=s.asset.id;};
$("cw-refresh").onclick=task(async()=>{await loadProjects();status("已刷新项目列表")});
$("cw-new-project").onclick=task(async()=>{const name=$("cw-project-name").value.trim();if(!name)throw Error("填写工程名称");s.project=await api("/projects","POST",{name});s.unit=s.asset=null;await loadProjects();await loadUnits();await loadAssets();status("已创建工程 "+name)});
$("cw-project-select").onchange=task(async()=>{const id=$("cw-project-select").value;if(!id)return;s.project={id,filmId:$("cw-project-select").selectedOptions[0].dataset.film};s.unit=s.asset=null;await loadUnits();await loadAssets();status("已打开工程 "+$("cw-project-select").selectedOptions[0].text)});
$("cw-new-scene").onclick=task(async()=>{if(!s.project)throw Error("先选工程");const title=$("cw-unit-title").value.trim();if(!title)throw Error("填写场景标题");s.unit=await api("/films/"+s.project.filmId+"/units","POST",{kind:"scene",title,content:$("cw-script").value});await loadUnits();status("场景已创建并持久保存 v1")});
$("cw-load").onclick=task(async()=>{const id=$("cw-unit-select").value;if(!id)throw Error("先选场景");s.unit=await api("/units/"+id);$("cw-script").value=s.unit.content;status("已载入 "+s.unit.title+" v"+s.unit.version)});
$("cw-save-script").onclick=task(async()=>{if(!s.unit)throw Error("先载入场景");const rev=await api("/units/"+s.unit.id+"/revisions","POST",{expectedVersion:s.unit.version,content:$("cw-script").value});s.unit.version=rev.version;await loadUnits();status("正式剧本 v"+rev.version+" 已保存，旧版仍可追溯")});
$("cw-mock").onclick=task(async()=>{if(!s.unit)throw Error("先载入场景");s.proposal=await api("/units/"+s.unit.id+"/proposals","POST",{direction:"让场景的选择与人物动机更鲜明"});$("cw-proposal-text").textContent=s.proposal.suggestion;$("cw-proposal").hidden=false;status("Mock AI 提案已保存，尚未改动正式剧本")});
$("cw-adopt").onclick=task(async()=>{const result=await api("/proposals/"+s.proposal.id+"/adopt","POST",{expectedVersion:s.unit.version});s.unit.version=result.version;$("cw-script").value=s.proposal.suggestion;$("cw-proposal").hidden=true;await loadUnits();status("已采纳 Mock 建议，正式剧本 v"+result.version)});
$("cw-reject").onclick=task(async()=>{await api("/proposals/"+s.proposal.id+"/reject","POST",{});$("cw-proposal").hidden=true;status("已拒绝提案，正式剧本未改变")});
$("cw-new-asset").onclick=task(async()=>{if(!s.project)throw Error("先选工程");const kind=$("cw-kind").value,name=$("cw-asset-name").value.trim(),variant=$("cw-variant").value.trim();s.asset=await api("/films/"+s.project.filmId+"/assets","POST",{kind,name,variant});await loadAssets();status("资产已创建，等候候选媒体")});
$("cw-asset-select").onchange=task(async()=>{const assets=await api("/films/"+s.project.filmId+"/assets");s.asset=assets.find(a=>a.id===$("cw-asset-select").value);status(s.asset?"当前资产："+s.asset.name+" v"+s.asset.version:"请选择资产")});
$("cw-upload").onclick=task(async()=>{if(!s.asset)throw Error("请选择资产");const file=$("cw-file").files[0];if(!file)throw Error("请选择文件");
 const form=new FormData();form.append("file",file);const uploaded=await api("/media","POST",form);
 const rev=await api("/assets/"+s.asset.id+"/revisions","POST",{expectedVersion:s.asset.version,mediaId:uploaded.id,description:"用户上传的正式整板/声音样本"});s.asset.version=rev.version;await loadAssets();
 $("cw-preview").innerHTML="";const e=document.createElement(uploaded.mime.startsWith("image/")?"img":"audio");e.src=uploaded.url;if(e.tagName==="AUDIO")e.controls=true;$("cw-preview").append(e);
 status("已采用正式版本 v"+rev.version+"，QA 状态："+rev.qaStatus+"。版本历史保留。");});
loadProjects().catch(e=>status("数据库未连接："+e.message));
})();