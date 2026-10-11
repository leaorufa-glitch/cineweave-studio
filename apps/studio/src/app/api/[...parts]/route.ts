import { NextRequest } from "next/server";
import { dispatch, HttpError } from "@/lib/api";
import { modelDispatch } from "@/lib/models";
import { productionDispatch } from "@/lib/production";
import { GatewayError } from "@/lib/providers";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(req:NextRequest,ctx:{params:Promise<{parts:string[]}>}){
 try{const {parts}=await ctx.params;const model=await modelDispatch(req,parts);if(model)return model;const production=await productionDispatch(req,parts);if(production)return production;return await dispatch(req,parts);}
 catch(e){const error=e as Error & {code?:string};const code=(e instanceof HttpError||e instanceof GatewayError)?e.status:error.code==="23505"?409:error.code==="23503"?404:500;return Response.json({error:code===500?"Internal error":error.message},{status:code});}
}
export {handle as GET,handle as POST};
