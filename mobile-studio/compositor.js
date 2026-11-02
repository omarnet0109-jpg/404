"use strict";
// Local media merger: creates a NEW playable A/V file from two real IndexedDB Blobs.
// This is timeline alignment, NOT AI lip synchronization. No upload, GPU, or paid API.
(() => {
const $=id=>document.getElementById(id);
const names={LAYLA:"ليلى",WIDAD:"الحاجة وداد",SABER:"عم صابر",ensemble:"الحارة"};
const videoVault=()=>globalThis.Studio404Vault;
const audioVault=()=>globalThis.Studio404AudioVault;
const SUPPORTED=[
 "video/webm;codecs=vp8,opus",
 "video/webm;codecs=vp9,opus",
 "video/webm",
 "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
 "video/mp4"
];
let videos=[],audios=[],busy=false,selectedVideoId=null,outputUrl=null;
const node=(tag,content)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;return n};
function message(text,error=false){$("status").textContent=text;$("status").style.color=error?"#ffb6ad":"#a6b8d0"}
function availableType(){
 if(typeof globalThis.MediaRecorder!=="function")return null;
 return SUPPORTED.find(x=>globalThis.MediaRecorder.isTypeSupported(x))||null;
}
function targetSize(w,h){
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1)throw Error("أبعاد الفيديو غير معروفة");
 const factor=Math.min(1,540/w,960/h);
 const even=x=>Math.max(2,Math.floor(x/2)*2);
 return {width:even(w*factor),height:even(h*factor)};
}
function matchingAudio(video){
 return audios.filter(x=>x.actor===video?.actor && x.shot===video?.shot_id);
}
function selectedVideo(){return videos.find(x=>x.id===$("video").value)}
function fillAudio(){
 const video=selectedVideo(),list=$("audio");list.replaceChildren();
 const matches=matchingAudio(video);
 for(const item of matches){
  const o=node("option",(names[item.actor]||item.actor)+" · "+item.shot.toUpperCase()+" · "+item.name);
  o.value=item.id;list.append(o);
 }
 $("combine").disabled=busy||!matches.length||!availableType();
 $("match").textContent=matches.length?
  "✅ لقطة "+video.shot_id.toUpperCase()+" مع صوت نفس الشخصية. النتيجة ملف جديد محفوظ في المكتبة.":
  "⚠️ مفيش صوت محفوظ لنفس الشخصية ورقم اللقطة. افتح استوديو الأصوات وولّد الجملة أو استورد WAV في المكتبة.";
}
function elementReady(el,kind){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>done(Error("تعذر قراءة "+kind+" من متصفح الموبايل")),15000);
  function done(err){
   clearTimeout(timer);el.removeEventListener("loadedmetadata",ok);el.removeEventListener("error",bad);
   if(err)reject(err);else resolve();
  }
  const ok=()=>done(),bad=()=>done(Error("الملف الصوتي أو الفيديو غير قابل للتشغيل"));
  if(el.readyState>=1){done();return}
  el.addEventListener("loadedmetadata",ok,{once:true});
  el.addEventListener("error",bad,{once:true});el.load();
 });
}
function ended(el){
 return new Promise((resolve,reject)=>{
  if(el.ended){resolve();return}
  el.addEventListener("ended",resolve,{once:true});
  el.addEventListener("error",()=>reject(Error("حدث خطأ أثناء تشغيل الملف محليًا")),{once:true});
 });
}
async function mix(){
 if(busy)return;
 const vMeta=selectedVideo();
 if(!vMeta){message("اختار فيديو محفوظ أولًا.",true);return}
 const aMeta=matchingAudio(vMeta).find(x=>x.id===$("audio").value);
 if(!aMeta){message("اختار صوت نفس الشخصية واللقطة أولًا.",true);return}
 const mime=availableType();
 if(!mime||typeof HTMLCanvasElement.prototype.captureStream!=="function"){
  message("المتصفح الحالي مش بيدعم تصدير فيديو بالصوت. جرّب Chrome حديث على أندرويد؛ مش هنطلع ملف صامت ونقول إنه جاهز.",true);return;
 }
 busy=true;$("combine").disabled=true;$("finished").replaceChildren();
 let video=null,audio=null,context=null,recorder=null,videoStream=null,raf=0;
 let vUrl=null,aUrl=null;
 const hidden=node("div");hidden.style.cssText="position:fixed;width:1px;height:1px;overflow:hidden;left:-9999px;top:-9999px";
 document.body.append(hidden);
 try{
  // Resume the audio context within the click handler, before long async I/O.
  const AudioEngine=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioEngine)throw Error("المتصفح لا يدعم دمج الصوت محليًا");
  context=new AudioEngine();
  await context.resume();
  const [vSaved,aSaved]=await Promise.all([videoVault().get(vMeta.id),audioVault().get(aMeta.actor,aMeta.shot)]);
  if(!vSaved?.video||!aSaved?.file)throw Error("ملف الفيديو أو الصوت مش موجود في مكتبتك");
  if(vSaved.actor!==aSaved.actor||vSaved.shot_id!==aSaved.shot)
   throw Error("الصوت لا يخص نفس الشخصية ونفس اللقطة");
  video=node("video");video.muted=true;video.playsInline=true;video.preload="auto";
  audio=node("audio");audio.preload="auto";
  vUrl=globalThis.URL.createObjectURL(vSaved.video);
  aUrl=globalThis.URL.createObjectURL(aSaved.file);
  video.src=vUrl;audio.src=aUrl;hidden.append(video,audio);
  message("جاري تجهيز الفيديو والصوت على الموبايل...");
  await Promise.all([elementReady(video,"الفيديو"),elementReady(audio,"الصوت")]);
  if(!Number.isFinite(video.duration)||!Number.isFinite(audio.duration)||
    video.duration<=0||audio.duration<=0||Math.max(video.duration,audio.duration)>90)
    throw Error("مدة الملف غير صالحة أو تتجاوز 90 ثانية. استخدم لقطة قصيرة.");
  const {width,height}=targetSize(video.videoWidth,video.videoHeight);
  const canvas=node("canvas");canvas.width=width;canvas.height=height;
  const draw=canvas.getContext("2d",{alpha:false});
  if(!draw)throw Error("المتصفح لا يستطيع تجهيز إطار الفيديو");
  draw.drawImage(video,0,0,width,height);
  videoStream=canvas.captureStream(24);
  const source=context.createMediaElementSource(audio);
  const destination=context.createMediaStreamDestination();
  source.connect(destination);
  const audioTrack=destination.stream.getAudioTracks()[0];
  if(!audioTrack)throw Error("ما قدرناش نضيف مسار الصوت للفيديو");
  const combined=new MediaStream([...videoStream.getVideoTracks(),audioTrack]);
  const chunks=[];
  recorder=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:1800000});
  const result=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
   recorder.onerror=e=>reject(e.error||Error("فشل تسجيل الفيديو بالصوت"));
   recorder.onstop=()=>chunks.length?resolve(new Blob(chunks,{type:mime.split(";")[0]})):
     reject(Error("التسجيل انتهى بملف فارغ"));
  });
  function paint(){
   if(!video)return;
   try{draw.drawImage(video,0,0,width,height)}catch{}
   raf=requestAnimationFrame(paint);
  }
  recorder.start(500);
  paint();
  message("جاري تركيب الصوت على الفيديو... خلّي الصفحة مفتوحة أثناء التصدير.");
  // Both media elements play from 0. Freeze the last video frame if audio is longer.
  video.currentTime=0;audio.currentTime=0;
  const videoDone=ended(video),audioDone=ended(audio);
  await Promise.all([video.play(),audio.play()]);
  const timeout=Math.ceil(Math.max(video.duration,audio.duration)*1000)+12000;
  await Promise.race([
    Promise.all([videoDone,audioDone]),
    new Promise((_,reject)=>setTimeout(()=>reject(Error("انتهى وقت دمج الملفات. جرّب مقطع أقصر أو متصفح أحدث.")),timeout))
  ]);
  cancelAnimationFrame(raf);raf=0;
  if(recorder.state!=="inactive")recorder.stop();
  const final=await result;
  if(final.size<2000)throw Error("الفيديو الناتج حجمه صغير جدًا، وتم رفض الحفظ حفاظًا على شغلك");
  const ext=mime.startsWith("video/mp4")?"mp4":"webm";
  const output=new File([final],"404-"+aSaved.actor+"-"+aSaved.shot+"-with-audio."+ext,{type:final.type});
  const saved=await videoVault().saveFile(output,{
   actor:aSaved.actor,shot_id:aSaved.shot,prompt:vMeta.prompt||"",source:"assembled-audio"
  });
  await videoVault().requestPersistence();
  if(outputUrl)globalThis.URL.revokeObjectURL(outputUrl);
  outputUrl=globalThis.URL.createObjectURL(output);
  const player=node("video");player.controls=true;player.playsInline=true;player.src=outputUrl;
  const download=node("a","↓ تنزيل الفيديو بالصوت");download.href=outputUrl;download.download=output.name;
  const gallery=node("a","✅ فتح نسختي المحفوظة");gallery.href="./library.html";
  const note=node("p","✅ تم تركيب المسار الصوتي وحفظ فيديو جديد في مكتبتك. النتيجة مش ليب سينك بالذكاء الاصطناعي.");
  note.className="hint";
  $("finished").append(player,note,download,node("p"),gallery);
  message("✅ نسخة فيديو بصوت اتسجلت واتحفظت فعليًا في مكتبتك. راجع النطق والتوقيت.");
 }catch(e){message("تعذّر تركيب الفيديو: "+(e.message||"مشكلة غير معروفة")+". الملفات الأصلية محفوظة كما هي.",true)}
 finally{
  if(raf)cancelAnimationFrame(raf);
  if(recorder?.state!=="inactive"){try{recorder?.stop()}catch{}}
  video?.pause();audio?.pause();
  videoStream?.getTracks().forEach(t=>t.stop());
  await context?.close().catch(()=>{});
  if(vUrl)globalThis.URL.revokeObjectURL(vUrl);
  if(aUrl)globalThis.URL.revokeObjectURL(aUrl);
  hidden.remove();busy=false;fillAudio();
 }
}
async function boot(){
 if(!availableType()||typeof HTMLCanvasElement.prototype.captureStream!=="function")
  message("المتصفح لا يدعم تصدير الصوت والفيديو بالشكل ده؛ نحتاج Chrome حديث على أندرويد.",true);
 try{
  [videos,audios]=await Promise.all([videoVault().list(),audioVault().list()]);
  const select=$("video"),preferred=new URLSearchParams(location.search).get("video");
  select.replaceChildren();
  for(const v of videos){
   const option=node("option",(v.shot_id||"بدون لقطة")+" · "+(names[v.actor]||v.actor)+" · "+v.name);
   option.value=v.id;select.append(option);
  }
  if(videos.some(v=>v.id===preferred))select.value=preferred;
  else if(videos.length)select.value=videos[0].id;
  select.addEventListener("change",fillAudio);
  fillAudio();
  if(!videos.length)message("مفيش فيديوهات في مكتبتك. ولّد لقطة أو استورد الفيديو أولًا.",true);
 }catch(e){message("تعذر تحميل المكتبة: "+e.message,true);$("combine").disabled=true}
 $("combine").addEventListener("click",mix);
}
document.addEventListener("DOMContentLoaded",boot);
})();
