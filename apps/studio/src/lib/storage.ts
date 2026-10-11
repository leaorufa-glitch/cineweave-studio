import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
export const maxUpload=25*1024*1024;
const root=process.env.MEDIA_ROOT ?? join(process.cwd(),".local-media");
const supported=new Set(["image/png","image/jpeg","image/webp","audio/wav","audio/mpeg","audio/mp4","audio/ogg"]);
export async function saveUpload(file:File){
 if(!supported.has(file.type)) throw new Error("Unsupported media MIME");
 if(file.size<1||file.size>maxUpload) throw new Error("Media file size exceeds limit");
 const bytes=Buffer.from(await file.arrayBuffer());
 const magic=bytes.subarray(0,12);
 let width:number|undefined,height:number|undefined;
 if(file.type.startsWith("image/")){
  const metadata=await sharp(bytes).metadata().catch(()=>{throw new Error("Corrupt image data");});
  width=metadata.width;height=metadata.height;
  if(!width||!height)throw new Error("Image dimensions missing");
 } else {
  const looksAudio=magic.toString("ascii",0,4)==="RIFF"&&magic.toString("ascii",8,12)==="WAVE"||magic.toString("ascii",0,3)==="ID3"||magic.toString("ascii",4,8)==="ftyp"||magic[0]===0xff||(magic.toString("ascii",0,4)==="OggS");
  if(!looksAudio) throw new Error("Invalid audio signature");
 }
 const id=randomUUID(),hash=createHash("sha256").update(bytes).digest("hex");
 const ext=({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","audio/wav":"wav","audio/mpeg":"mp3","audio/mp4":"m4a","audio/ogg":"ogg"} as Record<string,string>)[file.type];
 await mkdir(root,{recursive:true});
 const filePath=join(root,id+"."+ext);
 await writeFile(filePath,bytes,{flag:"wx"});
 return {id,filename:file.name,mime:file.type,bytes:bytes.length,sha256:hash,storagePath:filePath,width,height};
}
export async function loadMedia(path:string){ return readFile(path); }
export function assetImageQA(kind:string,width?:number|null,height?:number|null){
 if(kind==="voice")return "sample_ready";
 if(!width||!height)return "needs_manual_review";
 if(kind==="character")return Math.abs(width/height-2/3)<0.08 ? "needs_grid_review":"wrong_aspect";
 return "needs_board_review";
}
