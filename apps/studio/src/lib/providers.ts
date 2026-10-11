/* Model gateway contracts. Do not send the server's API key to any browser response. */
import { Buffer } from "node:buffer";
export type GatewayErrorFields={status?:number, provider?:string};
export class GatewayError extends Error {
 status:number;
 responseCode?:string;
 constructor(message:string,status=502,responseCode?:string){super(message);this.name="GatewayError";this.status=status;this.responseCode=responseCode;}
}
export function gatewayConfig(){
 const key=process.env.DARL_API_KEY;
 if(!key)throw new GatewayError("Model gateway is not configured. Provide server-side DARL_API_KEY.",503);
 const base=(process.env.DARL_API_BASE_URL||"https://api.darl.cn").replace(/\/+$/,"");
 if(!/^https:\/\//.test(base))throw new GatewayError("Gateway base URL must use HTTPS.",503);
 return {base,key};
}
export async function gatewayFetch(path:string,init:RequestInit={},timeoutMs=90_000){
 const {base,key}=gatewayConfig();
 if(!path.startsWith("/")||path.startsWith("//"))throw new GatewayError("Invalid gateway route",500);
 const headers=new Headers(init.headers);
 headers.set("Authorization","Bearer "+key);
 if(!(init.body instanceof FormData)&&init.body!==undefined)headers.set("Content-Type","application/json");
 let res:Response;
 try{res=await fetch(base+path,{...init,headers,signal:AbortSignal.timeout(timeoutMs),cache:"no-store"});}
 catch(e){throw new GatewayError("Gateway network/timeout: "+(e instanceof Error?e.name:"error"),502,"NETWORK_UNCONFIRMED");}
 return res;
}
export async function gatewayJson(path:string,body?:unknown,method="POST",timeoutMs=120_000){
 const res=await gatewayFetch(path, {method, ...(body===undefined?{}:{body:JSON.stringify(body)})}, timeoutMs);
 const text=await res.text();
 let data:Record<string,unknown>={};
 try{data=JSON.parse(text)}catch{if(res.ok)throw new GatewayError("Provider returned invalid JSON",502,"NETWORK_UNCONFIRMED");}
 if(!res.ok){
  // Never surface upstream untrusted output verbatim, as it may contain sensitive headers.
  throw new GatewayError("Gateway HTTP "+res.status,res.status>499?502:res.status,"HTTP_"+res.status);
 }
 return data;
}
export function validateH3Request(p:{prompt:string,seconds:number,aspectRatio:string,referenceImages?:string[],referenceAudio?:string[],referenceVideo?:string}){
 if(typeof p.prompt!=="string"||!p.prompt.trim())throw new GatewayError("Video prompt required",400);
 if(!Number.isInteger(p.seconds)||p.seconds<4||p.seconds>15)throw new GatewayError("Generation Clip must be 4–15 seconds",400);
 const ratios=["1:1","2:3","3:2","3:4","4:3","9:16","16:9","21:9"];
 if(!ratios.includes(p.aspectRatio))throw new GatewayError("Invalid RunningHub aspect ratio",400);
 const imgs=p.referenceImages??[],aud=p.referenceAudio??[];
 if(imgs.length>6||aud.length>3)throw new GatewayError("Too many reference media",400);
 if([...imgs,...aud,p.referenceVideo].filter(Boolean).some(x=>!/^task_[\w-]+$/.test(x!)))throw new GatewayError("RunningHub needs uploaded material IDs",400);
 return {
  model:"runninghub-minimax-h3" as const,
  prompt:p.prompt.trim(),seconds:p.seconds,
  megapixels:0.2,aspect_ratio:p.aspectRatio,upscale:1,
  reference_images:imgs,reference_audio:aud,
  ...(p.referenceVideo?{reference_video:p.referenceVideo}:{})
 };
}
export async function generateStorySuggestion(context:string,instruction:string){
 const model=process.env.TEXT_MODEL||"deepseek-v4.1-flash";
 const result=await gatewayJson("/v1/chat/completions",{
  model,temperature:0.7,max_tokens:8192,
  messages:[
   {role:"system",content:"你是 CineWeave Studio 的专业影视剧本编辑。以具体人物动机、因果动作、结构冲突、潜台词、场景目标和音画可执行性为标准提供可审阅的修改方案。严格保留用户已经明确的原剧情事实，除非用户要求修改。只输出方案文本，不声称已修改正式剧本。"},
   {role:"user",content:"当前场景剧本：\n"+context.slice(0,18000)+"\n\n创作者要求：\n"+instruction.slice(0,3000)+"\n\n严格使用【诊断】与【改写】两段标题：诊断段给两条具体问题；改写段只写可拍摄场景剧本，保留具体人物动作、对白和停顿。"}
  ]
 }, "POST",120_000);
 const choices=result.choices as Array<{message?:{content?:unknown}}> |undefined;
 const text=choices?.[0]?.message?.content;
 if(typeof text!=="string"||!text.trim())throw new GatewayError("Text model returned no usable content",502);
 return {model,text,usage:result.usage||null};
}
export async function generateImageBoard(prompt:string,kind:"character"|"location"|"hero_prop"){
 if(!prompt.trim()||prompt.length>10000)throw new GatewayError("Invalid image prompt",400);
 const board=kind==="character"
 ?"输出一张严格 2:3 的完整人物美术四宫格：上左为同一人物正面面部近景，上右为同一人物90度侧面面部近景；下左为不露脸的正面完整服饰造型，下右为包含头部的背面全身完整造型。每个格子都属于同一个角色和同一套Look，四格均匀，服装与身份一致，不要文字和拼贴外框。"
 :"输出一张完整的上大下三 1+3 参考图板：上半部一幅大主视角占大部分高度；下方横排三个较小画面依次为背向/反向、关键行动区域、侧向空间或功能细节。必须是同一"+(kind==="location"?"真实物理场景、建筑几何与光线状态":"剧情关键道具的结构、材质、比例")+"，不得变成四个不同对象，不要文字。";
 const size=kind==="character"?"1024x1536":"1536x1024";
 const res=await gatewayJson("/v1/images/generations/",{
  model:process.env.IMAGE_MODEL||"gpt-image-2",
  prompt:board+"\n\n影视美术要求："+prompt,
  size,quality:"medium",output_format:"png",n:1
 },"POST",240_000);
 const data=res.data as Array<{b64_json?:string; revised_prompt?:string}>|undefined;
 if(!data?.[0]?.b64_json)throw new GatewayError("Image model did not return b64_json",502);
 const bytes=Buffer.from(data[0].b64_json,"base64");
 if(bytes.byteLength<1000||bytes.byteLength>60*1024*1024)throw new GatewayError("Image response size invalid",502);
 return {bytes,mime:"image/png" as const,model:process.env.IMAGE_MODEL||"gpt-image-2",revisedPrompt:data[0].revised_prompt||null,usage:res.usage||null,inputSnapshot:{model:process.env.IMAGE_MODEL||"gpt-image-2",prompt:board+"\n\n影视美术要求："+prompt,size,quality:"medium",output_format:"png",n:1}};
}
export async function uploadRunningHubReference(bytes:Uint8Array,filename:string,mime:string){
 const form=new FormData();form.append("model","runninghub-minimax-h3");form.append("file",new Blob([new Uint8Array(bytes)],{type:mime}),filename);
 const r=await gatewayFetch("/runninghub/v1/uploads",{method:"POST",body:form},120_000);
 let data:Record<string,unknown>={};try{data=await r.json()}catch{}
 if(!r.ok)throw new GatewayError("RunningHub reference upload failed: HTTP "+r.status,502);
 if(typeof data.id!=="string"||!data.id.startsWith("task_"))throw new GatewayError("RunningHub did not return upload material id",502);
 return {id:data.id,mediaType:data.media_type};
}
export async function createRunningHubVideo(prompt:string,seconds:number,aspectRatio:string,referenceImages:string[]=[],referenceAudio:string[]=[],referenceVideo?:string){
 const input=validateH3Request({prompt,seconds,aspectRatio,referenceImages,referenceAudio,referenceVideo});
 const r=await gatewayJson("/v1/videos",input,"POST",120_000);
 if(typeof r.id!=="string"||!r.id)throw new GatewayError("Video gateway did not return task ID",502,"NETWORK_UNCONFIRMED");
 return {id:r.id,status:String(r.status||"queued"),input};
}
export async function queryRunningHubVideo(providerId:string){
 if(!/^[\w-]{8,180}$/.test(providerId))throw new GatewayError("Invalid gateway video ID",400);
 const r=await gatewayJson("/v1/videos/"+encodeURIComponent(providerId),undefined,"GET",45_000);
 const status=String(r.status||"unknown");
 const allowed=["queued","in_progress","completed","failed"];
 if(!allowed.includes(status))throw new GatewayError("Unknown RunningHub status: "+status,502);
 return {id:String(r.id||providerId),status,progress:Number(r.progress||0),videoUrl:typeof r.video_url==="string"?r.video_url:null,error:r.error?{message:"Provider generation failed"}:null};
}
export async function downloadRunningHubVideo(providerId:string){
 const res=await gatewayFetch("/v1/videos/"+encodeURIComponent(providerId)+"/content",{method:"GET"},120_000);
 if(!res.ok)throw new GatewayError("Video download returned HTTP "+res.status,502);
 const bytes=new Uint8Array(await res.arrayBuffer());
 if(bytes.length<1000||bytes.length>200*1024*1024||new TextDecoder().decode(bytes.subarray(4,8))!=="ftyp")throw new GatewayError("Downloaded file is not a valid MP4 container",502);
 return bytes;
}
