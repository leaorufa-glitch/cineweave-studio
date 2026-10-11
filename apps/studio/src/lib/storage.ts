import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import {probeMedia} from "./media-qa.ts";
export class MediaValidationError extends Error {}
/** A private storage adapter. Future S3 implementations must preserve immutable keys and hashes. */
export interface PrivateMediaStore {kind:string;put(key:string,bytes:Uint8Array):Promise<string>;read(locator:string):Promise<Buffer>;remove(locator:string):Promise<void>}
export function createLocalMediaStore(directory:string):PrivateMediaStore {return {kind:"local",async put(key,bytes){if(!/^[a-zA-Z0-9.-]+$/.test(key))throw new MediaValidationError("Invalid storage key");await mkdir(directory,{recursive:true});const locator=join(/*turbopackIgnore: true*/ directory,key);await writeFile(locator,bytes,{flag:"wx"});return locator;},read:locator=>readFile(locator),remove:locator=>rm(locator,{force:true})};}
export const maxUpload=25*1024*1024;
const root=process.env.MEDIA_ROOT ?? join(process.cwd(),".local-media");
const store=createLocalMediaStore(root);
const supported=new Set(["image/png","image/jpeg","image/webp","audio/wav","audio/mpeg","audio/mp4","audio/ogg"]);
export async function saveUpload(file:File){
 if(!supported.has(file.type)) throw new MediaValidationError("Unsupported media MIME");
 if(file.size<1||file.size>maxUpload) throw new MediaValidationError("Media file size exceeds limit");
 const bytes=Buffer.from(await file.arrayBuffer());
 const magic=bytes.subarray(0,12);
 let width:number|undefined,height:number|undefined;
 if(file.type.startsWith("image/")){
  const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata().catch(()=>{throw new MediaValidationError("Corrupt image data");});
  width=metadata.width;height=metadata.height;
  if(!width||!height)throw new MediaValidationError("Image dimensions missing");
 } else {
  const looksAudio=magic.toString("ascii",0,4)==="RIFF"&&magic.toString("ascii",8,12)==="WAVE"||magic.toString("ascii",0,3)==="ID3"||magic.toString("ascii",4,8)==="ftyp"||magic[0]===0xff||(magic.toString("ascii",0,4)==="OggS");
  if(!looksAudio) throw new MediaValidationError("Invalid audio signature");
 }
 const id=randomUUID(),hash=createHash("sha256").update(bytes).digest("hex");
 const ext=({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","audio/wav":"wav","audio/mpeg":"mp3","audio/mp4":"m4a","audio/ogg":"ogg"} as Record<string,string>)[file.type];
 const filePath=await store.put(id+"."+ext,bytes);
 let technicalQA=null;if(file.type.startsWith("audio/")){try{technicalQA=await probeMedia(filePath);if(!technicalQA.audio.length)throw new Error();}catch{await store.remove(filePath);throw new MediaValidationError("Audio sample cannot be decoded");}}
 return {id,filename:file.name,mime:file.type,bytes:bytes.length,sha256:hash,storagePath:filePath,width,height,technicalQA};
}
export async function loadMedia(path:string){ return store.read(path); }

/** Store a provider-returned MP4 as a real, durable local media file. */
export async function saveVideoOutput(bytes:Uint8Array,name="generation.mp4"){
 if(bytes.byteLength<1024||bytes.byteLength>200*1024*1024)throw new Error("Invalid generated video size");
 if(Buffer.from(bytes.subarray(4,8)).toString("ascii")!=="ftyp")throw new Error("Video output has no MP4 ftyp header");
 const id=randomUUID(),hash=createHash("sha256").update(bytes).digest("hex");
 const filePath=await store.put(id+".mp4",bytes);
 return {id,filename:name,mime:"video/mp4",bytes:bytes.byteLength,sha256:hash,storagePath:filePath,width:null,height:null};
}

export function assetImageQA(kind:string,width?:number|null,height?:number|null){
 if(kind==="voice")return "sample_ready";
 if(!width||!height)return "needs_manual_review";
 if(kind==="character")return Math.abs(width/height-2/3)<0.08 ? "needs_grid_review":"wrong_aspect";
 return "needs_board_review";
}
