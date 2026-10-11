import {createHash} from "node:crypto";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import { db,ensureDb,transaction } from "./db.ts";
import {saveVideoOutput} from "./storage.ts";

const exec=promisify(execFile);
const safe=(e:unknown)=>e instanceof Error?(e.message.slice(0,450)):String(e).slice(0,450);
type SnapshotSegment={id:string,position_index:number,take_id:string,source_in_seconds:string,source_out_seconds:string|null,media_id:string,sha256:string,mime:string,adopted:boolean};
type RenderJob={id:string,settings:{width:number,height:number,fps:number,snapshotSegments:SnapshotSegment[]}};
async function normalize(segment:SnapshotSegment,output:string,settings:RenderJob["settings"]){
 const res=await db().query("SELECT m.storage_path,m.mime,m.sha256,t.qa_status FROM media_files m JOIN video_takes t ON t.media_id=m.id WHERE m.id=$1 AND t.id=$2",[segment.media_id,segment.take_id]);
 const m=res.rows[0];if(!m||m.mime!=="video/mp4")throw new Error("Media missing or not MP4");
 if(m.qa_status==='needs_changes')throw new Error("Take was marked for changes after render submission");
 if(!segment.adopted)throw new Error("Render cannot include an unadopted Take");
 const input=await readFile(m.storage_path);
 if(createHash("sha256").update(input).digest("hex")!==segment.sha256)throw new Error("Source media hash changed after timeline submission");
 const probe=await exec("ffprobe",["-v","error","-show_entries","format=duration:stream=codec_type,codec_name","-of","json",m.storage_path],{timeout:30000});
 const details=JSON.parse(probe.stdout) as {streams:Array<{codec_type:string}>,format:{duration:string}};
 const duration=Number(details.format.duration),start=Number(segment.source_in_seconds),end=segment.source_out_seconds===null?duration:Number(segment.source_out_seconds);
 if(!Number.isFinite(duration)||start<0||end>duration+0.15||end-start<0.08)throw new Error("Invalid segment duration/trim");
 const hasAudio=details.streams.some(s=>s.codec_type==="audio");
 const audio=hasAudio?["-map","0:a:0"]:["-map","1:a:0"];
 const args=["-hide_banner","-loglevel","error","-nostdin","-y",
  "-ss",start.toFixed(3),"-i",m.storage_path,
  ...(!hasAudio?["-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000"]:[]),
  "-t",(end-start).toFixed(3),"-map","0:v:0",...audio,
  "-vf",`scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease,pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${settings.fps},format=yuv420p`,
  "-c:v","libx264","-preset","veryfast","-crf","22","-c:a","aac","-b:a","128k","-ar","48000","-ac","2",
  "-movflags","+faststart","-shortest",output
 ];
 await exec("ffmpeg",args,{timeout:180000,maxBuffer:100000});
}
export async function renderOneIfWaiting():Promise<string|null>{
 await ensureDb();
 const take=await db().query(`WITH picked AS (
  SELECT id FROM renders WHERE status='waiting_render' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
 ) UPDATE renders SET status='rendering',updated_at=now()
 WHERE id IN(SELECT id FROM picked) RETURNING *`);
 if(!take.rowCount)return null;
 const job=take.rows[0] as RenderJob;
 const work=await mkdtemp(join(tmpdir(),"cineweave-render-"));
 try{
  const snapshots=job.settings?.snapshotSegments;
  if(!Array.isArray(snapshots)||!snapshots.length)throw new Error("Render snapshot has no media");
  if(snapshots.length>200)throw new Error("Too many segments in V1 render");
  const files:string[]=[];
  for(const [idx,seg] of snapshots.entries()){
   const output=join(work,"s"+String(idx).padStart(4,"0")+".mp4");
   await normalize(seg,output,job.settings);
   files.push(output);
  }
  const concatPath=join(work,"concat.txt");
  await writeFile(concatPath,files.map(f=>"file '"+f.replaceAll("'","'\\''")+"'").join("\n")+"\n");
  const resultPath=join(work,"movie.mp4");
  await exec("ffmpeg",["-hide_banner","-loglevel","error","-nostdin","-y","-f","concat","-safe","0","-i",concatPath,"-c","copy","-movflags","+faststart",resultPath],{timeout:180000,maxBuffer:100000});
  const movie=await saveVideoOutput(await readFile(resultPath),"cineweave-render-"+job.id+".mp4");
  await transaction(async c=>{
   await c.query("INSERT INTO media_files(id,filename,mime,bytes,sha256,storage_path) VALUES($1,$2,$3,$4,$5,$6)",[movie.id,movie.filename,movie.mime,movie.bytes,movie.sha256,movie.storagePath]);
   await c.query("UPDATE renders SET status='completed',output_media_id=$2,error=NULL,updated_at=now() WHERE id=$1",[job.id,movie.id]);
  });
  console.log("[cineweave-render] completed",job.id,"segments",files.length,"bytes",movie.bytes);
 }catch(e){
  await db().query("UPDATE renders SET status='failed',error=$2,updated_at=now() WHERE id=$1",[job.id,safe(e)]);
  console.error("[cineweave-render] failed",job.id,safe(e));
 }finally{await rm(work,{recursive:true,force:true});}
 return job.id;
}
