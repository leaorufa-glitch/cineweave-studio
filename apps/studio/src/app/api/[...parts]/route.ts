import { workspaceDispatch } from "@/lib/workspaces";
import { NextRequest } from "next/server";
import { dispatch, HttpError } from "@/lib/api";
import { modelDispatch } from "@/lib/models";
import { productionDispatch } from "@/lib/production";
import { reviewDispatch } from "@/lib/review";
import { GatewayError } from "@/lib/providers";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(req:NextRequest,ctx:{params:Promise<{parts:string[]}>}){
 try{
  const host=req.headers.get('host')??'',origin=req.headers.get('origin');
  if(!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))return Response.json({error:'Local access only; account authorization required before public deployment'},{status:403});
  if(req.method!=='GET'&&(req.headers.get('sec-fetch-site')==='cross-site'||origin&&new URL(origin).host!==host))return Response.json({error:'Cross-origin mutation blocked'},{status:403});
  const {parts}=await ctx.params;const workspace=await workspaceDispatch(req,parts);if(workspace)return workspace;const model=await modelDispatch(req,parts);if(model)return model;const review=await reviewDispatch(req,parts);if(review)return review;const production=await productionDispatch(req,parts);if(production)return production;return await dispatch(req,parts);}
 catch(e){const error=e as Error & {code?:string};const code=(e instanceof HttpError||e instanceof GatewayError)?e.status:error.code==="23505"?409:error.code==="23503"?404:500;return Response.json({error:code===500?"Internal error":error.message},{status:code});}
}
export {handle as GET,handle as POST};
