import { workspaceDispatch } from "@/lib/workspaces";
import { NextRequest } from "next/server";
import { dispatch, HttpError } from "@/lib/api";
import { modelDispatch } from "@/lib/models";
import { productionDispatch } from "@/lib/production";
import { reviewDispatch } from "@/lib/review";
import {MediaValidationError} from "@/lib/storage";
import { GatewayError } from "@/lib/providers";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(req:NextRequest,ctx:{params:Promise<{parts:string[]}>}){
 try{
  let request:Request=req;
  if(req.method==='POST'&&req.headers.get('content-type')?.includes('application/json')){
   const reader=req.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
   if(reader){while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>128*1024){await reader.cancel();return Response.json({error:'JSON input exceeds 128 KiB'},{status:413});}chunks.push(next.value);}}
   const bytes=Buffer.concat(chunks);try{const value=JSON.parse(bytes.toString());if(!value||Array.isArray(value)||typeof value!=='object')throw Error();}catch{return Response.json({error:'Expected JSON object'},{status:400});}
   request=new Request(req.url,{method:req.method,headers:req.headers,body:bytes});
  }else if(req.method==='POST'&&Number(req.headers.get('content-length'))>26*1024*1024)return Response.json({error:'Upload exceeds limit'},{status:413});
  const {parts}=await ctx.params;const workspace=await workspaceDispatch(request,parts);if(workspace)return workspace;const model=await modelDispatch(request,parts);if(model)return model;const review=await reviewDispatch(request,parts);if(review)return review;const production=await productionDispatch(request,parts);if(production)return production;return await dispatch(request,parts);}
 catch(e){const error=e as Error & {code?:string};const code=(e instanceof HttpError||e instanceof GatewayError)?e.status:e instanceof MediaValidationError?400:error.code==="23505"?409:error.code==="23503"?404:500;return Response.json({error:code===500?"Internal error":error.message},{status:code});}
}
// Creator-approved open access: tunnel hosts and browser origins have the same
// business capabilities. Validation and version/idempotency rules still apply.
function openAccess(response:Response){
 response.headers.set('Access-Control-Allow-Origin','*');
 response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 response.headers.set('Access-Control-Allow-Headers','*');
 response.headers.set('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');
 return response;
}
async function openHandle(req:NextRequest,ctx:{params:Promise<{parts:string[]}>}){
 return openAccess(await handle(req,ctx));
}
export {openHandle as GET,openHandle as POST};
export function OPTIONS(){return openAccess(new Response(null,{status:204}));}
