import {createHash} from 'node:crypto';

/** Offline MiniMax H3 prompt rules, pinned to the official commit in H3-PROMPT-SPEC.md. */
export const H3_RULES={version:'h3-prompt-d21241f0-cw2',officialCommit:'d21241f0a4b3acbb34c97dae47fa417b7065e438',checkedOn:'2026-10-12'} as const;
export type H3Mode='T2VA'|'I2VA'|'FL2VA'|'L2VA'|'Ref2VA';
export type ReferenceRole='subject'|'first_frame'|'last_frame'|'storyboard'|'video_structure'|'video_edit'|'video_continue'|'audio_voice'|'audio_reuse'|'audio_reference'|'audio_ambience'|'audio_music';
export type VisibleRetention='fully_preserved'|'partially_preserved'|'attribute_transfer'|'weak_reference';
export type AudioRetention='fully_copy'|'partially_copy'|'reference'|'weak_reference';
export type Dialogue={speakerId:string;speakerDescription:string;language:string;text:string;delivery?:string;performanceRate?:number;pauseSeconds?:number;voiceover?:boolean;crossCut?:'before'|'after';cutoff?:boolean};
export type ExecutionBeat={id:string;shotId:string;startSeconds:number;endSeconds:number;composition:string;action:string;camera:string;cause?:string;effect?:string;performance?:string;lighting?:string;sound?:string;endState?:string;transition?:'cut'|'cross-dissolve'|'fade'|'wipe';visibleText?:string[];dialogue?:Dialogue[]};
export type ReferenceSubject={key:string;description:string;retention?:VisibleRetention;shotIds?:string[];speakerId?:string};
export type ReferenceUse={revisionId:string;role:ReferenceRole;description:string;retention?:VisibleRetention|AudioRetention;shotIds?:string[];subjects?:ReferenceSubject[];speakerId?:string};
/** Workspace 4 owns this model-independent plan. It is never itself an H3 prompt. */
export type AudiovisualExecutionPlan={version:1;style:string;opening:string;beats:ExecutionBeat[];soundscape:string;music:string;silenceRequested?:boolean;directorConstraints?:string[];referenceUses:ReferenceUse[]};
export type FormalReference={assetId:string;revisionId:string;mediaId:string;sha256:string;mime:string;assetKind:string;assetName:string;description:string};
export type ShotSpan={shotId:string;startSeconds:number;endSeconds:number;version:number;title:string;description:string;design:unknown};
export type CompileInput={mode:H3Mode;seconds:number;plan:AudiovisualExecutionPlan;references:FormalReference[];shotSpans:ShotSpan[];source:{clipId:string;clipVersion:number;filmId:string;scriptRevisions:Array<{id:string;version:number}>;continuationParentClipId:string|null};provider:string};
export type Issue={code:string;message:string;path:string;scope:'format'|'source'|'provider';severity:'error'|'warning'};
export type SubjectMap={key:string;label:string;description:string;retention:VisibleRetention;shotNumbers:number[];speakerId?:string};
export type ReferenceMapEntry=FormalReference&{role:ReferenceRole;label:string;description:string;retention:VisibleRetention|AudioRetention;shotNumbers:number[];subjects:SubjectMap[];uploadIndex:number;speakerId?:string};
export type Compilation={mode:H3Mode;rulesVersion:string;provider:string;prompt:string;referenceMap:ReferenceMapEntry[];issues:Issue[];source:CompileInput['source']&{shotVersions:Array<{id:string;version:number}>};hash:string;formatValid:boolean;submitEligible:boolean};

/** Transport support and official prompt interpretation are separate facts. */
export const H3_ROUTES={
 'runninghub-minimax-h3':{role:'temporary_test',verifiedModes:['T2VA'] as H3Mode[],maxImages:6,maxAudio:3,maxVideo:1,nativeContinuation:false,canSubmit:true,note:'Text video submission tested; official reference and keyframe mode semantics unverified'},
 'self-hosted-h3':{role:'production',verifiedModes:[] as H3Mode[],maxImages:0,maxAudio:0,maxVideo:0,nativeContinuation:false,canSubmit:false,note:'Awaiting actual self-hosted protocol and server'},
 'offline-mock':{role:'offline',verifiedModes:[] as H3Mode[],maxImages:100,maxAudio:100,maxVideo:100,nativeContinuation:false,canSubmit:false,note:'Compiler preview and tests only'}
} as const;
const issue=(code:string,message:string,path:string,scope:Issue['scope']='format',severity:Issue['severity']='error'):Issue=>({code,message,path,scope,severity});
const text=(value:unknown,path:string,issues:Issue[],required=true)=>{
 const result=typeof value==='string'?value.trim():'';
 if(required&&!result)issues.push(issue('REQUIRED','English descriptive prose is required',path));
 if(result&&/[\u3400-\u9fff]/u.test(result))issues.push(issue('ENGLISH_PROSE','Official descriptive sections are English; preserve original language in dialogue or visible text',path));
 if(/[<>]|\[Shot\s+\d+\]/i.test(result))issues.push(issue('RESERVED_SYNTAX','Do not put official tags in source prose',path));
 return result;
};
const at=(seconds:number)=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms%60000/1000)).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
const sentence=(value:string)=>/[.!?]$/.test(value)?value:value+'.';
const unique=<T>(items:T[])=>[...new Set(items)];
const types=['T2VA','I2VA','FL2VA','L2VA','Ref2VA'];
const visualMarkers=['fully_preserved','partially_preserved','attribute_transfer','weak_reference'];
const audioMarkers=['fully_copy','partially_copy','reference','weak_reference'];
function shotGroups(beats:ExecutionBeat[]){
 const groups:Array<{shotId:string;firstBeat:number;startSeconds:number}>=[];
 for(const [index,beat] of beats.entries())if(index===0||beat.shotId!==beats[index-1].shotId)groups.push({shotId:beat.shotId,firstBeat:index,startSeconds:beat.startSeconds});
 return groups;
}
function referenceMap(input:CompileInput,issues:Issue[]):ReferenceMapEntry[]{
 const uses=input.plan?.referenceUses;
 if(!Array.isArray(uses)){issues.push(issue('REFERENCE_USES','The plan needs a referenceUses array','plan.referenceUses'));return [];}
 const groups=shotGroups(Array.isArray(input.plan?.beats)?input.plan.beats:[]);
 const byRevision=new Map<string,ReferenceUse>();
 for(const [i,use] of uses.entries()){
  if(byRevision.has(use.revisionId))issues.push(issue('DUPLICATE_USE','One reference use per formal revision; define multiple subjects in subjects[]',`plan.referenceUses.${i}`));
  byRevision.set(use.revisionId,use);
  if(!input.references.some(r=>r.revisionId===use.revisionId))issues.push(issue('ORPHAN_USE','Reference use has no selected formal revision',`plan.referenceUses.${i}`,'source'));
 }
 // Picture 1 and Picture 2 are determined by their actual keyframe roles, never checkbox order.
 const priority=(r:FormalReference)=>{const role=byRevision.get(r.revisionId)?.role;return r.mime.startsWith('image/')?(role==='first_frame'?0:role==='last_frame'?1:2):r.mime.startsWith('video/')?3:4;};
 const ordered=[...input.references].sort((a,b)=>priority(a)-priority(b)||a.assetId.localeCompare(b.assetId)||a.revisionId.localeCompare(b.revisionId));
 const counters={Picture:0,Video:0,Audio:0,Subject:0};
 const result:ReferenceMapEntry[]=[];
 for(const [index,ref] of ordered.entries()){
  const use=byRevision.get(ref.revisionId);
  if(!use){issues.push(issue('UNMAPPED_REFERENCE','Selected formal revision lacks a reference role',`references.${index}`,'source'));continue;}
  if(result.some(x=>x.mediaId===ref.mediaId)){issues.push(issue('DUPLICATE_MEDIA','A formal media file is uploaded once; map its subjects within one use',`references.${index}`,'source'));continue;}
  const kind=ref.mime.startsWith('image/')?'Picture':ref.mime.startsWith('video/')?'Video':ref.mime.startsWith('audio/')?'Audio':null;
  if(!kind){issues.push(issue('MEDIA_TYPE','Unsupported reference media type',`references.${index}`,'source'));continue;}
  const valid=kind==='Picture'?['subject','first_frame','last_frame','storyboard'].includes(use.role):kind==='Video'?['video_structure','video_edit','video_continue'].includes(use.role):['audio_voice','audio_reuse','audio_reference','audio_ambience','audio_music'].includes(use.role);
  if(!valid){issues.push(issue('ROLE_MIME','Reference role does not match the media type',`plan.referenceUses.${index}`));continue;}
  const label=`<${kind} ${++counters[kind]}>`;
  const defaultShots=use.role==='first_frame'?[1]:use.role==='last_frame'?[groups.length]:groups.map((_,i)=>i+1);
  const numbers=(ids?:string[])=>ids?.length?unique(ids.flatMap(id=>groups.map((g,i)=>g.shotId===id?i+1:0).filter(Boolean))):defaultShots;
  const defs=use.subjects?.length?use.subjects:use.role==='subject'?[{key:ref.assetId,description:use.description,retention:'fully_preserved' as VisibleRetention,shotIds:use.shotIds}]:[];
  const subjects=defs.map((s,i)=>({key:s.key,label:`<Subject ${++counters.Subject}>`,description:text(s.description,`plan.referenceUses.${index}.subjects.${i}.description`,issues),retention:s.retention??'fully_preserved',shotNumbers:numbers(s.shotIds),speakerId:s.speakerId}));
  const retention=use.retention??(kind==='Audio'?'reference':'fully_preserved');
  if(!(kind==='Audio'?audioMarkers:visualMarkers).includes(retention))issues.push(issue('RETENTION_MARKER','Invalid official retention marker for this media type',`plan.referenceUses.${index}.retention`));
  if(use.role==='audio_reuse'&&!use.retention)issues.push(issue('AUDIO_COPY_RELATION','Copied audio needs an explicit fully_copy or partially_copy relationship',`plan.referenceUses.${index}.retention`));
  result.push({...ref,role:use.role,label,description:text(use.description,`plan.referenceUses.${index}.description`,issues),retention,shotNumbers:numbers(use.shotIds),subjects,uploadIndex:index,speakerId:use.speakerId});
 }
 return result;
}
function validatePlan(input:CompileInput,map:ReferenceMapEntry[],issues:Issue[]){
 const {plan,seconds,mode}=input;
 if(!types.includes(mode))issues.push(issue('MODE','Unknown MiniMax H3 mode','mode'));
 if(!Number.isInteger(seconds)||seconds<4||seconds>15)issues.push(issue('DURATION','Clip duration must be an integer 4–15 seconds','seconds'));
 if(plan?.version!==1)issues.push(issue('PLAN_VERSION','Audiovisual Execution Plan V1 is required','plan.version'));
 text(plan?.style,'plan.style',issues);text(plan?.opening,'plan.opening',issues);text(plan?.soundscape,'plan.soundscape',issues);text(plan?.music,'plan.music',issues);
 if(plan?.soundscape==='N/A'&&!plan.silenceRequested)issues.push(issue('SOUNDSCAPE','N/A is valid only for explicit total silence','plan.soundscape'));
 if(!Array.isArray(plan?.beats)||!plan.beats.length){issues.push(issue('BEATS','At least one timed Beat is required','plan.beats'));return;}
 if(!input.source.scriptRevisions.length)issues.push(issue('SCRIPT_LINEAGE','An adopted screenplay revision is required','source.scriptRevisions','source'));
 if(!input.shotSpans.length)issues.push(issue('SHOT_LINEAGE','Map the Clip to a Director Shot','shotSpans','source'));
 if(plan.beats.length>12)issues.push(issue('BEATS','At most 12 Beats in a 15-second Clip','plan.beats'));
 let end=0;
 for(const [i,beat] of plan.beats.entries()){
  const path=`plan.beats.${i}`;
  if(!beat.id?.trim())issues.push(issue('BEAT_ID','Beat needs its own identity',`${path}.id`,'source'));
  if(!Number.isFinite(beat.startSeconds)||!Number.isFinite(beat.endSeconds)||Math.abs(beat.startSeconds-end)>.001||beat.endSeconds<=beat.startSeconds||beat.endSeconds>seconds+.001)issues.push(issue('BEAT_TIMING','Beats must cover the Clip without gaps, overlaps, or overflow',path));
  end=beat.endSeconds;
  const spans=input.shotSpans.filter(s=>s.shotId===beat.shotId&&beat.startSeconds>=s.startSeconds-.001&&beat.endSeconds<=s.endSeconds+.001);
  if(!spans.length)issues.push(issue('SHOT_SPAN','Beat must fit a mapped Director Shot span',path,'source'));
  for(const field of ['composition','action','camera'] as const)text(beat[field],`${path}.${field}`,issues);
  for(const field of ['cause','effect','performance','lighting','sound','endState'] as const)text(beat[field],`${path}.${field}`,issues,false);
  if(i===0&&beat.transition)issues.push(issue('OPENING_TRANSITION','First Beat cannot introduce a cut',`${path}.transition`));
  if(i>0){const newShot=beat.shotId!==plan.beats[i-1].shotId;if(newShot&&!beat.transition)issues.push(issue('CUT_AUTHORIZATION','A new Director Shot needs an explicit planned transition',`${path}.transition`,'source'));if(!newShot&&beat.transition)issues.push(issue('SPURIOUS_CUT','Beats within one Director Shot cannot add a cut',`${path}.transition`,'source'));}
  for(const [j,d] of (beat.dialogue??[]).entries()){
   if(!d.speakerId?.trim()||!d.language?.trim()||!d.text?.trim())issues.push(issue('DIALOGUE','Speaker ID, language and exact words are required',`${path}.dialogue.${j}`));
   text(d.speakerDescription,`${path}.dialogue.${j}.speakerDescription`,issues);
   text(d.delivery,`${path}.dialogue.${j}.delivery`,issues,false);
   if(/[<>]/.test(d.text??''))issues.push(issue('DIALOGUE_TAG','Spoken words cannot contain official tag syntax',`${path}.dialogue.${j}.text`));
   if(d.performanceRate!==undefined&&(!Number.isFinite(d.performanceRate)||d.performanceRate<.5||d.performanceRate>2))issues.push(issue('SPEECH_RATE','Performance rate must be 0.5–2×',`${path}.dialogue.${j}.performanceRate`));
   if(d.pauseSeconds!==undefined&&(!Number.isFinite(d.pauseSeconds)||d.pauseSeconds<0||d.pauseSeconds>30))issues.push(issue('PAUSE','Pause must be 0–30 seconds',`${path}.dialogue.${j}.pauseSeconds`));
  }
 }
 if(Math.abs(end-seconds)>.001)issues.push(issue('END_TIME','The final Beat must end at the Clip duration','plan.beats'));
 for(const [i,c] of (plan.directorConstraints??[]).entries())text(c,`plan.directorConstraints.${i}`,issues);
 const first=map.filter(r=>r.role==='first_frame'),last=map.filter(r=>r.role==='last_frame');
 if(mode==='T2VA'&&map.length)issues.push(issue('T2VA_REFERENCE','T2VA has no media references','mode'));
 if(mode==='I2VA'&&(first.length!==1||map.length!==1))issues.push(issue('I2VA_FRAME','I2VA needs exactly one first-frame image','mode'));
 if(mode==='FL2VA'&&(first.length!==1||last.length!==1||map.length!==2))issues.push(issue('FL2VA_FRAMES','FL2VA needs one first and one last frame','mode'));
 if(mode==='L2VA'&&(last.length!==1||map.length!==1))issues.push(issue('L2VA_FRAME','L2VA needs exactly one last-frame image','mode'));
 if(mode==='Ref2VA'&&!map.length)issues.push(issue('REF2VA_REFERENCE','Ref2VA needs formal references','mode'));
 if(mode!=='Ref2VA'&&mode!=='T2VA'&&map.some(r=>!['first_frame','last_frame'].includes(r.role)))issues.push(issue('BASE_REFERENCE','Use Ref2VA for non-keyframe references','mode'));
 const shotCount=shotGroups(plan.beats).length;
 const speakers=speakerMap(plan.beats);
 for(const r of map){for(const n of [...r.shotNumbers,...r.subjects.flatMap(s=>s.shotNumbers)])if(!Number.isInteger(n)||n<1||n>shotCount)issues.push(issue('REFERENCE_SHOT','Reference points to an invalid Shot',`referenceMap.${r.label}`));if(r.role==='audio_voice'&&(!r.speakerId||!speakers.has(r.speakerId)))issues.push(issue('VOICE_SPEAKER','Voice reference requires a speaking target with a stable ID',`referenceMap.${r.label}`));}
}
function speakerMap(beats:ExecutionBeat[]){const result=new Map<string,string>();for(const beat of beats)for(const d of beat.dialogue??[])if(!result.has(d.speakerId))result.set(d.speakerId,`(S${result.size+1})`);return result;}
function body(input:CompileInput,map:ReferenceMapEntry[],speakers:Map<string,string>){
 const beats=input.plan.beats,groups=shotGroups(beats);
 return beats.map((beat,i)=>{
  const shotNo=groups.findIndex(g=>g.firstBeat<=i&&(!groups[groups.indexOf(g)+1]||groups[groups.indexOf(g)+1].firstBeat>i))+1;
  const starts=i===0?'[Shot 1] ':beat.shotId!==beats[i-1].shotId?`[Shot ${shotNo}] At ${at(beat.startSeconds)}, ${beat.transition==='cut'?'the camera cuts to':`the shot transitions by ${beat.transition}`} `:`Within the same uncut shot, from ${at(beat.startSeconds)} to ${at(beat.endSeconds)}, `;
  const subjects=map.flatMap(r=>r.subjects.filter(s=>s.shotNumbers.includes(shotNo)));
  const refs=map.filter(r=>!r.subjects.length&&r.shotNumbers.includes(shotNo)).map(r=>r.label);
  const firstInShot=i===0||beat.shotId!==beats[i-1].shotId;
  const sourceDetails=firstInShot?subjects.map(s=>`${s.label}, ${s.description}`):subjects.map(s=>s.label);
  const scene=[i===0&&input.mode!=='Ref2VA'?input.plan.style:null,i===0?input.plan.opening:null,beat.composition,sourceDetails.length||refs.length?`The referenced ${unique([...sourceDetails,...refs]).join(', ')} is visible or audible at this point`:null,beat.lighting,beat.cause,beat.action,beat.effect,beat.performance,beat.camera,beat.sound,beat.endState,i===0&&input.plan.directorConstraints?.length?`Preserve these director constraints: ${input.plan.directorConstraints.join('; ')}`:null].filter(Boolean).map(x=>sentence(String(x).replace(/[. ]+$/,'')));
  for(const visible of beat.visibleText??[])scene.push(`Visible text reads ${JSON.stringify(visible)}.`);
  for(const d of beat.dialogue??[]){
   const speaker=speakers.get(d.speakerId)??'(S?)',voice=map.find(r=>r.role==='audio_voice'&&r.speakerId===d.speakerId);
   const delivery=[d.delivery,d.performanceRate===undefined?null:`at ${d.performanceRate} times the baseline speaking rate`,d.pauseSeconds?`after a ${d.pauseSeconds}-second pause`:null,voice?`using the timbre referenced by ${voice.label}`:null].filter(Boolean).join(', ');
   const spoken=`<d>[${d.language}] ${d.crossCut==='after'?'<scenetrans>':''}${d.text}${d.crossCut==='before'?'<scenetrans>':''}${d.cutoff?'<cutoff>':''}</d>`;
   scene.push(`${d.speakerDescription} ${speaker} ${d.voiceover?'says in an off-screen voiceover':'says'}${delivery?` ${delivery}`:''}: ${spoken}${d.voiceover?' while the corresponding on-screen character’s lips remain completely closed.':'.'}`);
  }
  return starts+scene.join(' ');
 }).join('\n');
}
function refPrompt(input:CompileInput,map:ReferenceMapEntry[],description:string,speakers:Map<string,string>){
 const definitions:string[]=[],retention:string[]=[];
 for(const r of map){
  for(const s of r.subjects){definitions.push(`${s.label} is ${s.description} from ${r.label}.`);retention.push(`${s.label} (appears in ${s.shotNumbers.map(n=>`[Shot ${n}]`).join(', ')}): ${s.retention} - ${s.description}.`);}
  if(!r.subjects.length||['first_frame','last_frame','storyboard','video_edit','video_continue','video_structure'].includes(r.role)){
   let def=`${r.label} is ${r.description}.`;
   if(r.role==='audio_voice'){
    const id=speakers.get(r.speakerId??'');const subject=map.flatMap(x=>x.subjects).find(x=>x.speakerId===r.speakerId);
    def=`${r.label} is the voice-timbre reference for ${subject?`${subject.label} ${id}`:`the target voice ${id??'(S?)'}`}; ${r.description}.`;
   }
   definitions.push(def);
   retention.push(`${r.label}${r.shotNumbers.length&&r.mime.startsWith('image/')?` (appears in ${r.shotNumbers.map(n=>`[Shot ${n}]`).join(', ')})`:''}: ${r.retention} - ${r.description}.`);
  }
 }
 const types:string[]=[];
 if(map.some(r=>r.role==='video_edit'))types.push('video editing');
 if(map.some(r=>r.role==='video_continue'))types.push('video continuation');
 if(map.some(r=>['first_frame','last_frame','storyboard'].includes(r.role)))types.push('keyframe completion');
 if(map.some(r=>['subject','video_structure'].includes(r.role)))types.push('reference generation');
 if(map.some(r=>r.role==='audio_reuse'))types.push('audio reuse');
 if(map.some(r=>['audio_voice','audio_reference','audio_ambience','audio_music'].includes(r.role)))types.push('audio reference');
 if(!types.length)types.push('reference generation');
 const editOpening=map.find(r=>r.role==='video_edit');
 const summary=`[${unique(types).join(' + ')}] ${editOpening?`The target video is an edited version of ${editOpening.label}. `:''}${input.plan.opening}. The ${input.seconds.toFixed(2)}-second target uses ${map.map(r=>r.subjects.length?r.subjects.map(s=>s.label).join(' and '):r.label).join(', ')} in the planned shot sequence.`;
 return `subject_definitions:\n${definitions.join('\n')}\n\nsummary:\n${summary}\n\nretention_analysis:\n${retention.join('\n')}\n\ndetailed_description:\n${sentence(input.plan.style)}\n${description}\n\noverall_soundscape:\n${input.plan.soundscape}\n\nnon_diegetic_music:\n${input.plan.music}`;
}
function basePrompt(input:CompileInput,description:string){
 const last=shotGroups(input.plan.beats).length,seconds=input.seconds.toFixed(2);
 const instruction=input.mode==='I2VA'?'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.':input.mode==='FL2VA'?`How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot ${last}) aligns with the ${seconds}-second mark of the target video.`:input.mode==='L2VA'?`How the reference pictures align with the target video — <Picture 1> (from [Shot ${last}]) aligns with the ${seconds}-second mark of the target video.`:'';
 const anchor=input.mode==='I2VA'?'The opening composition is exactly <Picture 1> at 0.00 seconds. ':input.mode==='FL2VA'?'The action begins from Picture 1 and reaches Picture 2 in the final frame. ':input.mode==='L2VA'?'The action converges to <Picture 1> in the final frame. ':'';
 return `${instruction?instruction+'\n\n':''}integrated_multimodal_description: ${anchor}${description}\n\noverall_soundscape: ${input.plan.soundscape}\n\nnon_diegetic_music: ${input.plan.music}`;
}
function providerIssues(input:CompileInput,map:ReferenceMapEntry[]):Issue[]{
 const route=H3_ROUTES[input.provider as keyof typeof H3_ROUTES];
 if(!route)return [issue('PROVIDER','Unknown H3 route','provider','provider')];
 const issues:Issue[]=[];
 if(!route.canSubmit||!route.verifiedModes.includes(input.mode as never))issues.push(issue('MODE_UNVERIFIED',`${input.mode} has no verified submission contract on ${input.provider}; offline preview only`,'provider','provider'));
 if(input.source.continuationParentClipId&&!route.nativeContinuation)issues.push(issue('NATIVE_CONTINUATION_UNVERIFIED','No verified parent Take/Motion Context contract on this route','source.continuationParentClipId','provider'));
 const images=map.filter(r=>r.mime.startsWith('image/')).length,audio=map.filter(r=>r.mime.startsWith('audio/')).length,video=map.filter(r=>r.mime.startsWith('video/')).length;
 if(images>route.maxImages||audio>route.maxAudio||video>route.maxVideo)issues.push(issue('PROVIDER_LIMIT','Formal reference count exceeds this route’s request contract','references','provider'));
 if(map.some(r=>['video_edit','video_continue'].includes(r.role)))issues.push(issue('VIDEO_MODE_UNVERIFIED','Editing and native continuation require actual provider capability validation','references','provider'));
 return issues;
}
export function compileH3(input:CompileInput):Compilation{
 const issues:Issue[]=[],map=referenceMap(input,issues);
 validatePlan(input,map,issues);
 const validBeats=Array.isArray(input.plan?.beats)&&input.plan.beats.length>0;
 const speakers=speakerMap(validBeats?input.plan.beats:[]);
 const description=validBeats?body(input,map,speakers):'';
 const prompt=validBeats?(input.mode==='Ref2VA'?refPrompt(input,map,description,speakers):basePrompt(input,description)):'';
 issues.push(...providerIssues(input,map));
 const source={...input.source,shotVersions:input.shotSpans.map(s=>({id:s.shotId,version:s.version}))};
 const hash=createHash('sha256').update(JSON.stringify({rules:H3_RULES.version,input,map,prompt})).digest('hex');
 const formatValid=!issues.some(i=>i.severity==='error'&&i.scope!=='provider');
 return {mode:input.mode,rulesVersion:H3_RULES.version,provider:input.provider,prompt,referenceMap:map,issues,source,hash,formatValid,submitEligible:formatValid&&!issues.some(i=>i.severity==='error'&&i.scope==='provider')};
}
