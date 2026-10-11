import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const exec=promisify(execFile);
export async function probeMedia(path:string){
 const result=await exec('ffprobe',['-v','error','-show_format','-show_streams','-of','json',path],{timeout:30000,maxBuffer:1000000});
 const data=JSON.parse(result.stdout),duration=Number(data.format?.duration),streams=data.streams as Array<Record<string,unknown>>;
 if(!Number.isFinite(duration)||duration<=0||!streams.length)throw new Error('Media duration or streams invalid');
 await exec('ffmpeg',['-v','error','-xerror','-nostdin','-i',path,'-f','null','-'],{timeout:180000,maxBuffer:1000000});
 const video=streams.find(s=>s.codec_type==='video'),audio=streams.filter(s=>s.codec_type==='audio');
 return {status:'decodable',duration,width:Number(video?.width)||null,height:Number(video?.height)||null,video:video?{codec:video.codec_name,fps:video.avg_frame_rate}:null,audio:audio.map(a=>({codec:a.codec_name,sampleRate:a.sample_rate,channels:a.channels})),sha256:createHash('sha256').update(await readFile(path)).digest('hex'),checkedAt:new Date().toISOString(),artisticQuality:'needs_creator_review'};
}
