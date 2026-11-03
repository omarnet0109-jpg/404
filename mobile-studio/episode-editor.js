"use strict";
// Phone-first episode editor: locally stored video Blobs + distinct per-video dialogue Blobs.
// Real-time canvas/WebAudio/MediaRecorder export (not generative lip sync).
(() => {
const $=id=>document.getElementById(id);
const vault=()=>globalThis.Studio404Vault;
const audioVault=()=>globalThis.Studio404ClipAudio;
const actors=()=>globalThis.Studio404Characters;
const voices=()=>globalThis.Studio404Voices;
const KEY="studio404.episode.timeline.v1";
const SPACE_ID="mohammedaly22/VoiceTut-TTS";
const SPACE_HOST="https://mohammedaly22-voicetut-tts.hf.space";
const MAX_CLIPS=16,MAX_LENGTH=90;
const CODECS=["video/webm;codecs=vp8,opus","video/webm;codecs=vp9,opus","video/webm"];
let clips=[],items=[],selected=null,busy=false,actorNames={},audioPreviewURL=null,outputURL=null;
const el=(tag,text)=>{const r=document.createElement(tag);if(text!==undefined)r.textContent=text;return r};
function info(text,bad=false,id="editorStatus"){$(id).textContent=text;$(id).style.color=bad?"#ffb1a7":"#a7b5ca"}
function videoOf(id){return items.find(v=>v.id===id)}
function activeVideo(){return videoOf(selected)}
function revokeAudio(){if(audioPreviewURL){URL.revokeObjectURL(audioPreviewURL);audioPreviewURL=null}}
function saveOrder(){try{localStorage.setItem(KEY,JSON.stringify(clips))}catch{info("تعذر حفظ ترتيب الحلقة محليًا",true)}}
function format(v){return (actorNames[v.actor]||v.actor||"فيديو")+" · "+(v.name||"لقطة")}
function codec(){
 if(typeof MediaRecorder!=="function"||typeof MediaRecorder.isTypeSupported!=="function")return null;
 return CODECS.find(t=>MediaRecorder.isTypeSupported(t))||null;
}
function refreshAdd(){
 const choose=$("availableVideos"),old=choose.value;
 choose.replaceChildren();
 for(const item of items){
  if(clips.includes(item.id))continue;
  const option=el("option",format(item));option.value=item.id;choose.append(option);
 }
 if([...choose.options].some(o=>o.value===old))choose.value=old;
 $("addClip").disabled=busy||!choose.options.length||clips.length>=MAX_CLIPS;
}
function lineButton(label,action,disabled=false){
 const b=el("button",label);b.type="button";b.disabled=busy||disabled;b.addEventListener("click",action);return b;
}
function renderTimeline(){
 const box=$("timeline");box.replaceChildren();
 clips.forEach((id,i)=>{
  const v=videoOf(id);if(!v)return;
  const row=el("div");row.className="editor-row"+(id===selected?" active":"");
  const title=el("span",(i+1)+". "+format(v));
  title.append(el("small","اضغط لاختيار صوت اللقطة"));
  title.addEventListener("click",()=>select(id));title.style.cursor="pointer";
  const up=lineButton("↑",()=>move(i,-1),i===0);up.setAttribute("aria-label","حرّك اللقطة للأعلى");
  const down=lineButton("↓",()=>move(i,1),i===clips.length-1);down.setAttribute("aria-label","حرّك اللقطة للأسفل");
  const remove=lineButton("×",()=>removeClip(id));remove.setAttribute("aria-label","شيل اللقطة من المونتاج");
  row.append(title,up,down,remove);box.append(row);
 });
 refreshAdd();
 $("exportEpisode").disabled=busy||clips.length<2||!codec();
 if(!clips.length)box.append(el("p","أضف لقطة من مكتبتك لبدء المونتاج."));
}
function move(index,direction){
 if(busy)return;
 const target=index+direction;if(target<0||target>=clips.length)return;
 [clips[index],clips[target]]=[clips[target],clips[index]];
 saveOrder();renderTimeline();
}
function removeClip(id){
 if(busy)return;
 clips=clips.filter(v=>v!==id);
 if(selected===id)selected=clips[0]||null;
 saveOrder();renderTimeline();refreshSelected();
}
function addClip(){
 if(busy||clips.length>=MAX_CLIPS)return;
 const id=$("availableVideos").value;
 if(!videoOf(id)||clips.includes(id))return;
 clips.push(id);selected=id;saveOrder();renderTimeline();refreshSelected();
}
function select(id){if(busy||!clips.includes(id))return;selected=id;renderTimeline();refreshSelected()}
async function refreshSelected(){
 const id=selected,v=videoOf(id);revokeAudio();
 $("spokenText").value="";$("referenceTranscript").value="";$("audioConsent").checked=false;
 $("ttsResult").replaceChildren();$("playAudio").hidden=true;$("playAudio").removeAttribute("src");
 $("chosenClip").textContent=v?"اللقطة: "+format(v):"اختار لقطة من الترتيب فوق.";
 $("attachAudio").disabled=busy||!v;$("removeAudio").disabled=busy||!v;
 $("generateDialogue").disabled=busy||!v;
 if(!v){$("voiceProfileStatus").textContent="";info("اختار لقطة فوق علشان تضيف صوتها.",false,"clipAudioStatus");return}
 try{
  const [voice,record]=await Promise.all([
   ["LAYLA","WIDAD","SABER"].includes(v.actor)||v.actor?.startsWith("C_")?voices().verify(v.actor):Promise.resolve(null),
   audioVault().get(v.id)
  ]);
  if(id!==selected)return;
  $("voiceProfileStatus").textContent=voice?
   "🔒 الصوت المرجعي لشخصية "+(actorNames[v.actor]||v.actor)+" مثبت · "+voice.sha256.slice(0,12):
   "⚠️ مفيش صوت مرجعي ثابت للشخصية. ثبّته في «شخصياتي» قبل محاولة توليد صوت جديد.";
  if(record){
   audioPreviewURL=URL.createObjectURL(record.file);
   $("playAudio").src=audioPreviewURL;$("playAudio").hidden=false;
   info("✅ صوت حقيقي محفوظ للّقطة دي. "+(record.source==="voicetut"?"مولّد من المرجع المثبت.":"مستورَد من ملف؛ راجع إن المتحدث الصحيح.")+
     " تغيير الملف يحتاج موافقة.",false,"clipAudioStatus");
  }else info("اللقطة دي لسه صامتة. اختار ملف صوت أو جرّب التوليد من مرجع الشخصية المثبت.",false,"clipAudioStatus");
 }catch(e){info("تعذر تحميل صوت اللقطة: "+e.message,true,"clipAudioStatus")}
}
async function saveSound(file,{source="import",referenceHash=null}={}){
 const id=selected,v=videoOf(id);if(!v)throw Error("اختار لقطة أولًا");
 const existing=await audioVault().get(id);
 if(existing&&!confirm("في صوت محفوظ بالفعل لهذا الفيديو. هل تستبدله بالملف الجديد؟"))return false;
 await audioVault().save(id,v.actor,file,{replace:!!existing,source,referenceHash});
 await refreshSelected();
 return true;
}
async function attachAudio(){
 const file=$("dialogueFile").files?.[0];
 if(!file){info("اختار ملف WAV أو MP3 أولًا.",true,"clipAudioStatus");return}
 $("attachAudio").disabled=true;
 try{
  if(await saveSound(file)){$("dialogueFile").value="";info("✅ الملف الصوتي اتحفظ في نفس الفيديو. تقدر ترجع له في أي وقت.",false,"clipAudioStatus")}
 }catch(e){info("تعذر حفظ الصوت: "+e.message,true,"clipAudioStatus")}
 finally{$("attachAudio").disabled=false}
}
async function removeSound(){
 const v=activeVideo();if(!v)return;
 if(!confirm("حذف ملف الصوت المرتبط باللقطة دي؟ الفيديو الأصلي مش هيتحذف."))return;
 try{await audioVault().remove(v.id);await refreshSelected()}catch(e){info(e.message,true,"clipAudioStatus")}
}
function safeAudio(result){
 let value=result?.data?.[0];if(Array.isArray(value))value=value[0];if(value?.audio)value=value.audio;
 const raw=typeof value==="string"?value:value?.url;
 if(typeof raw!=="string"||!raw)throw Error("الخدمة لم ترجع رابط ملف صوت");
 const url=new globalThis.URL(raw,SPACE_HOST);
 if(url.protocol!=="https:"||!(url.hostname==="huggingface.co"||url.hostname.endsWith(".hf.space")))
  throw Error("رابط ملف الصوت الخارجي غير موثوق");
 return url.href;
}
async function tryTTS(){
 if(busy)return;
 const v=activeVideo();if(!v)return;
 const line=$("spokenText").value.trim(),referenceText=$("referenceTranscript").value.trim();
 if(line.length<2||referenceText.length<4){info("اكتب الجملة المصرية ونص المرجع الصوتي اللي اتقال في التسجيل.",true,"clipAudioStatus");return}
 if(!$("audioConsent").checked){info("لازم توافق على إرسال الصوت والنص للخدمة الخارجية أولًا.",true,"clipAudioStatus");return}
 busy=true;$("generateDialogue").disabled=true;renderTimeline();
 info("محاولة توليد الجملة من صوت الشخصية المثبت، مجانًا حسب حصة VoiceTut...");
 try{
  const identity=await voices().verify(v.actor);
  if(!identity)throw Error("مفيش مرجع صوت ثابت للشخصية. ثبّته في «شخصياتي» الأول");
  const {Client,handle_file}=await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
  const client=await Client.connect(SPACE_ID,{events:["data","status"]});
  const source=new File([identity.file],identity.name,{type:identity.mime});
  const params=[line,"arz","clone","",handle_file(source),referenceText,32,2,1,true];
  const job=client.submit("/synthesize",params);let produced=false;
  for await(const event of job){
   if(event.type==="status"){
    if(event.stage==="error")throw Error(event.message||"خدمة الصوت رفضت الطلب أو انتهت الحصة");
    info(event.position!=null?"في انتظار GPU الصوت؛ ترتيب الطابور: "+event.position:"جاري توليد الصوت المصري...");
   }else if(event.type==="data"){
    const url=safeAudio(event),fileLink=el("a","فتح وتنزيل ملف الصوت");
    fileLink.href=url;fileLink.target="_blank";fileLink.rel="noopener noreferrer";
    const player=el("audio");player.controls=true;player.preload="metadata";player.src=url;
    $("ttsResult").replaceChildren(player,fileLink);produced=true;
    try{
     const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"no-store"});
     if(!response.ok||response.type==="opaque")throw Error("خدمة الصوت منعت تنزيل الملف");
     const blob=await response.blob();
     if(!blob.type.startsWith("audio/")&&blob.type!=="application/octet-stream")throw Error("الملف مش صوت");
     const output=new File([blob],v.actor+"-"+v.id+".wav",{type:blob.type||"audio/wav"});
     if(await saveSound(output,{source:"voicetut",referenceHash:identity.sha256}))
      info("✅ الصوت اتولد من نفس مرجع الشخصية واتحفظ للّقطة. راجع النطق والنبرة قبل اعتمادها.");
    }catch(e){info("الجملة اتولدت، لكن حفظها تلقائيًا فشل: "+e.message+". نزّل WAV واستورده من زر ملف الصوت.",true)}
   }
  }
  if(!produced)throw Error("الخدمة خلصت من غير ملف صوت");
 }catch(e){info("خدمة الصوت المجانية غير متاحة حاليًا: "+(e.message||"مشكلة اتصال")+
  ". تقدر تستورد تسجيلًا جاهزًا بدون ما تضيع فيديوهاتك.",true)}
 finally{busy=false;$("generateDialogue").disabled=false;renderTimeline()}
}
function metadata(element){
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>done(Error("الموبايل ما قدرش يفتح الملف")),18000);
  function done(err){clearTimeout(timeout);element.removeEventListener("loadedmetadata",success);
   element.removeEventListener("error",fail);err?reject(err):resolve()}
  function success(){done()}function fail(){done(Error("ملف الفيديو غير قابل للتشغيل على هذا المتصفح"))}
  if(element.readyState>=1){done();return}
  element.addEventListener("loadedmetadata",success,{once:true});
  element.addEventListener("error",fail,{once:true});element.load();
 });
}
function drawFrame(ctx,video){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);
 if(video.readyState<2)return;
 const width=video.videoWidth,height=video.videoHeight;
 if(!width||!height)return;
 const factor=Math.min(w/width,h/height),dw=width*factor,dh=height*factor;
 try{ctx.drawImage(video,(w-dw)/2,(h-dh)/2,dw,dh)}catch{}
}
function outMime(){
 if(typeof globalThis.MediaRecorder!=="function")return null;
 return CODECS.find(type=>globalThis.MediaRecorder.isTypeSupported(type))||null;
}
async function exportEpisode(){
 if(busy)return;
 if(clips.length<2){info("أضف لقطتين على الأقل علشان تخرج الحلقة.",true);return}
 const mime=outMime();
 if(!mime||typeof HTMLCanvasElement.prototype.captureStream!=="function"){
  info("المتصفح لا يدعم تصدير فيديو بالصوت. استخدم Chrome حديث على أندرويد، مش هنطلع فيديو صامت ونعتبره صحيح.",true);return
 }
 const AudioEngine=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(!AudioEngine){info("المتصفح لا يدعم تسجيل الصوت داخل الفيديو.",true);return}
 busy=true;renderTimeline();$("exportResult").replaceChildren();
 let context=null,recorder=null,canvasStream=null,frameTimer=null,video=null,videoURL=null;
 let source=null,done=null;
 try{
  context=new AudioEngine();
  await context.resume(); // Initiated directly from user press before reading IDB.
  const destination=context.createMediaStreamDestination();
  const canvas=el("canvas");canvas.width=360;canvas.height=640;
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx)throw Error("الموبايل لا يدعم رسم إطارات الفيديو");
  ctx.fillStyle="#000";ctx.fillRect(0,0,360,640);
  canvasStream=canvas.captureStream(12);
  const combined=new MediaStream([...canvasStream.getVideoTracks(),...destination.stream.getAudioTracks()]);
  const chunks=[];
  recorder=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:1350000});
  done=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onerror=e=>reject(e.error||Error("المتصفح فشل في تسجيل الحلقة"));
   recorder.onstop=()=>chunks.length?resolve(new Blob(chunks,{type:mime.split(";")[0]})):
     reject(Error("التسجيل انتهى بملف فارغ"));
  });
  done.catch(()=>{});
  let elapsed=0;
  recorder.start(500);
  for(let i=0;i<clips.length;i++){
   const id=clips[i],record=await vault().get(id);
   if(!record?.video)throw Error("أحد الفيديوهات مش موجود في مكتبتك");
   const voice=await audioVault().get(id);
   let audioBuffer=null;
   if(voice?.file){
    try{audioBuffer=await context.decodeAudioData(await voice.file.arrayBuffer())}
    catch{throw Error("صوت اللقطة "+(i+1)+" مش قابل للتشغيل. جرب WAV أو MP3")}
   }
   if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null}
   if(video){video.pause();video.remove();video=null}
   video=el("video");video.muted=true;video.playsInline=true;video.preload="auto";
   videoURL=URL.createObjectURL(record.video);video.src=videoURL;
   document.body.append(video);video.style.cssText="position:fixed;left:-9999px;width:1px;height:1px;opacity:0";
   await metadata(video);
   const duration=video.duration;
   if(!Number.isFinite(duration)||duration<=0||duration>40)
    throw Error("مدة اللقطة "+(i+1)+" غير صالحة أو طويلة جدًا");
   const seconds=Math.max(duration,audioBuffer?.duration||0);
   if(elapsed+seconds>MAX_LENGTH)throw Error("مجموع اللقطات أطول من 90 ثانية. قسم الحلقة لأجزاء أصغر");
   drawFrame(ctx,video);
   info("جاري تسجيل اللقطة "+(i+1)+" من "+clips.length+" — لا تقفل الصفحة أو تنقل للتطبيقات.");
   await video.play();
   if(audioBuffer){
    source=context.createBufferSource();source.buffer=audioBuffer;
    source.connect(destination);source.start(context.currentTime+0.04);
   }
   let lastPaint=0;
   function paint(t){if(t-lastPaint>=1000/12){drawFrame(ctx,video);lastPaint=t}}
   frameTimer=setInterval(()=>paint(performance.now()),75);
   await new Promise(resolve=>setTimeout(resolve,Math.ceil(seconds*1000)+120));
   clearInterval(frameTimer);frameTimer=null;
   drawFrame(ctx,video);video.pause();
   if(source){try{source.stop()}catch{}source.disconnect();source=null}
   elapsed+=seconds;
  }
  if(recorder.state==="recording")recorder.stop();
  const output=await done;
  if(output.size<2000)throw Error("الملف الناتج صغير جدًا، لن نحفظ فيديو غير صالح");
  const file=new File([output],"404-episode-"+Date.now()+".webm",{type:"video/webm"});
  const saved=await vault().saveFile(file,{actor:"ensemble",source:"episode-montage"});
  await vault().requestPersistence();
  if(outputURL)URL.revokeObjectURL(outputURL);
  outputURL=URL.createObjectURL(file);
  const player=el("video");player.controls=true;player.playsInline=true;player.src=outputURL;
  const link=el("a","↓ تنزيل الحلقة بالصوت");link.href=outputURL;link.download=file.name;
  const gallery=el("a","🎞️ فتح الحلقة المحفوظة");gallery.href="./library.html";
  $("exportResult").append(player,link,gallery);
  info("✅ تم إنشاء ملف حلقة واحد، وحفظه على الموبايل. راجع الصوت وتوقيت اللقطات بنفسك. ده مش AI lip-sync.");
 }catch(e){
  info("تصدير الحلقة لم يكتمل: "+(e.message||"مشكلة غير معروفة")+
    ". الفيديوهات والأصوات الأصلية لم تُحذف.",true);
 }finally{
  if(frameTimer)clearInterval(frameTimer);
  if(source){try{source.stop()}catch{}try{source.disconnect()}catch{}}
  video?.pause();video?.remove();
  if(videoURL)URL.revokeObjectURL(videoURL);
  if(recorder?.state==="recording"){try{recorder.stop()}catch{}}
  canvasStream?.getTracks().forEach(t=>t.stop());
  await context?.close().catch(()=>{});
  busy=false;renderTimeline();
 }
}
async function boot(){
 try{
  items=await vault().list();
  for(const c of await actors().all())actorNames[c.id]=c.name;
  let previous=[];try{previous=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{}
  clips=Array.isArray(previous)?previous.filter(id=>items.some(x=>x.id===id)).slice(0,MAX_CLIPS):[];
  const query=new URLSearchParams(location.search).get("video");
  if(query&&items.some(x=>x.id===query)&&!clips.includes(query)&&clips.length<MAX_CLIPS)clips.push(query);
  selected=query&&clips.includes(query)?query:clips[0]||null;
  saveOrder();renderTimeline();await refreshSelected();
  if(!items.length)info("مكتبتك فاضية. ولّد فيديو في الاستوديو أو استورد واحد من «مكتبتي».",true);
  else if(!outMime())info("المتصفح مش بيدعم التصدير المحلي. استخدم Chrome حديث على أندرويد.",true);
 }catch(e){info("تعذر فتح الفيديوهات المحفوظة: "+e.message,true)}
 $("addClip").addEventListener("click",addClip);
 $("attachAudio").addEventListener("click",attachAudio);
 $("removeAudio").addEventListener("click",removeSound);
 $("generateDialogue").addEventListener("click",tryTTS);
 $("exportEpisode").addEventListener("click",exportEpisode);
}
window.addEventListener("pagehide",revokeAudio);
document.addEventListener("DOMContentLoaded",boot);
})();