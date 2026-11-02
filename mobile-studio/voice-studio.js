"use strict";
// 404 Studio Voice Lab: 3 immutable actor IDs, local licensed samples, public ZeroGPU TTS.
// Demo speakers are NOT licensed for monetized publishing. Never auto-send audio externally.
(() => {
const SPACE_ID = "mohammedaly22/VoiceTut-TTS";
const SPACE_ORIGIN = "https://mohammedaly22-voicetut-tts.hf.space";
const PROFILE_KEY = "studio404.voice-profiles.v1";
const DB_NAME = "studio404.voice-reference-audio.v1";
const ACTORS = ["LAYLA","WIDAD","SABER"];
const NAMES = {LAYLA:"ليلى",WIDAD:"الحاجة وداد",SABER:"عم صابر"};
const OPTIONS = {LAYLA:["Yasmin","Yara","Hadeer","Rana"],WIDAD:["Hanan","Mariam","Sarah","Yasmin"],SABER:["Shaker","Hassan","Mahmoud","Ahmed"]};
const DEFAULT = {LAYLA:"Yasmin",WIDAD:"Hanan",SABER:"Shaker"};
const $=id=>document.getElementById(id);
let actor="LAYLA",dialogue=[],busy=false,profiles={},lastAudioUrl=null,dbPromise;
const note=(text,error=false)=>{const n=$("status");n.textContent=text;n.style.color=error?"#ffb6ad":"#a8b8ce"};
const node=(tag,content)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;return e};
function loadProfiles(){
 try{
  const parsed=JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}");
  if(parsed && typeof parsed==="object")profiles=parsed;
 }catch{profiles={}}
 for(const id of ACTORS){
  const p=profiles[id];
  if(!p||!["demo","licensed"].includes(p.mode)){
    profiles[id]={mode:"demo",speaker:DEFAULT[id],locked:false};
  }
 }
}
function storeProfiles(){localStorage.setItem(PROFILE_KEY,JSON.stringify(profiles))}
function openDatabase(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error("هذا المتصفح لا يدعم تخزين ملفات الصوت المحلية"));return}
  const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore("clips");
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error("تعذر فتح مساحة الصوت المحلية"));
 });
 return dbPromise;
}
async function readClip(id){
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("clips","readonly"),req=tx.objectStore("clips").get(id);
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
 });
}
async function saveClip(id,ref){
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("clips","readwrite");
  tx.objectStore("clips").put(ref,id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
async function clearClip(id){
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("clips","readwrite");tx.objectStore("clips").delete(id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
async function checksum(file){
 if(!globalThis.crypto?.subtle)throw Error("التحقق من بصمة الصوت يتطلب متصفح HTTPS حديثًا");
 const bytes=await file.arrayBuffer();
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("");
}
function fileAllowed(file){
 const names=[".wav",".mp3",".ogg",".webm",".m4a"];
 const ext=(file?.name||"").toLowerCase();
 return !!file&&file.size>0&&file.size<=15*1024*1024&&names.some(e=>ext.endsWith(e));
}
function speakerOptions(){
 $("speaker").replaceChildren();
 for(const id of OPTIONS[actor]){const option=node("option",id);option.value=id;$("speaker").append(option)}
}
function actorLines(){
 const lines=dialogue.filter(x=>x.speaker===actor);
 $("line").replaceChildren();
 for(const item of lines){
  const option=node("option",item.shot_id.toUpperCase()+" · "+(item.end-item.start)+" ثواني");
  option.value=item.shot_id;$("line").append(option);
 }
 if(lines.length)$("line").value=lines[0].shot_id;
 renderLine();
}
function renderLine(){
 const line=dialogue.find(x=>x.shot_id===$("line").value && x.speaker===actor);
 $("dialogue").textContent=line?.text||"";
}
async function renderProfile(){
 for(const id of ACTORS){
  document.querySelector('[data-actor="'+id+'"]').classList.toggle("active",actor===id);
  $("state-"+id).textContent=profiles[id].mode==="licensed" && profiles[id].locked?"🔒 مرجع مثبت":"تجربة فقط";
 }
 const p=profiles[actor];
 $("actorTitle").textContent="صوت "+NAMES[actor];
 $("actorDesc").textContent="نفس الشخصية والهوية الصوتية في كل الجمل، وليس صوتًا جديدًا لكل لقطة.";
 $("mode").value=p.mode;
 speakerOptions();
 $("speaker").value=OPTIONS[actor].includes(p.speaker)?p.speaker:DEFAULT[actor];
 $("demoArea").hidden=p.mode!=="demo";
 $("licensedArea").hidden=p.mode!=="licensed";
 $("refText").value=p.refText||"";
 $("rights").checked=false;
 $("sendConsent").checked=false;
 $("refAudio").value="";
 $("mode").disabled=!!p.locked;
 $("refAudio").disabled=!!p.locked;
 $("refText").disabled=!!p.locked;
 $("lockVoice").hidden=!!p.locked;
 $("unlockVoice").hidden=!p.locked;
 $("resultArea").replaceChildren();
 if(lastAudioUrl)lastAudioUrl=null;
 if(p.mode==="licensed"){
   try{
    const clip=await readClip(actor);
    $("refState").textContent=clip?.sha256===p.sha256?
      "✅ التسجيل الأصلي محفوظ على الموبايل وبصمته مطابقة":
      "⚠️ لم نجد نسخة التسجيل المعتمدة؛ أعد تثبيته قبل توليد الصوت.";
   }catch(e){$("refState").textContent="تعذر قراءة التسجيل من المتصفح: "+e.message}
 }else{$("refState").textContent="لم يتم حفظ تسجيل لهذه الشخصية."}
 note(p.locked?"الصوت المرجعي مثبت في هذا الجهاز، ويمكن تجربة الجملة الحالية.":"اختار الصوت وجرب الجملة، وبعدها قرر اعتماد صوت مرخّص.");
}
async function changeActor(id){
 if(busy){note("الجملة قيد التوليد. انهي طلب الصوت قبل تغيير الشخصية.");return}
 actor=id;actorLines();await renderProfile();
}
function saveDemo(){
 const value=$("speaker").value;
 if(!OPTIONS[actor].includes(value)){note("صوت التجربة غير موجود.",true);return}
 profiles[actor]={mode:"demo",speaker:value,locked:false};
 storeProfiles();renderProfile();
}
async function lock(){
 if(busy)return;
 const file=$("refAudio").files?.[0];
 const old=profiles[actor];
 if(!fileAllowed(file)&&!(old.mode==="licensed"&&old.refText)){
  note("اختار تسجيل WAV أو MP3 أو WebM صالحًا بحد أقصى 15MB.",true);return
 }
 if(!$("rights").checked){note("لازم تتأكد إن عندك إذن استخدام صوت صاحب التسجيل في المسلسل.",true);return}
 const transcript=$("refText").value.trim();
 if(transcript.length<6){note("اكتب نص الجملة اللي اتقالت في التسجيل الأصلي (6 حروف على الأقل).",true);return}
 try{
  let record,hash;
  if(fileAllowed(file)){
   hash=await checksum(file);
   record={blob:file,name:file.name,type:file.type,sha256:hash};
   await saveClip(actor,record);
  }else{
   record=await readClip(actor);
   if(!record || !record.sha256)throw Error("التسجيل الصوتي مش محفوظ على الجهاز");
   hash=record.sha256;
  }
  profiles[actor]={mode:"licensed",speaker:null,locked:true,sha256:hash,refText:transcript,
    model:SPACE_ID,approved_at:new Date().toISOString(),rights_confirmed:true};
  storeProfiles();
  await renderProfile();
  note("✅ تم تثبيت مرجع صوت "+NAMES[actor]+" ببصمة SHA-256. هنستخدم نفس الملف لكل جمل الشخصية على هذا الجهاز.");
 }catch(e){note("تعذر تثبيت التسجيل: "+e.message,true)}
}
async function unlock(){
 if(busy)return;
 if(!confirm("فتح صوت "+NAMES[actor]+" للتعديل؟ هيتم إلغاء تثبيته، ومش هنغيّر أي أصوات أخرى."))return;
 profiles[actor].locked=false;
 storeProfiles();await renderProfile();
 note("الصوت مفتوح للتعديل؛ لازم تثبته من جديد بعد التغيير.");
}
function safeAudio(event){
 let entry=event?.data?.[0];
 if(Array.isArray(entry))entry=entry[0];
 if(entry?.audio)entry=entry.audio;
 const raw=typeof entry==="string"?entry:entry?.url;
 if(typeof raw!=="string"||!raw.trim())throw Error("الخدمة لم تُرجع ملف صوت قابل للتشغيل.");
 const result=new globalThis.URL(raw,SPACE_ORIGIN);
 if(result.protocol!=="https:"||
   !(result.hostname==="huggingface.co"||result.hostname.endsWith(".hf.space")))
   throw Error("عنوان الصوت الناتج من مصدر غير موثوق.");
 return result.href;
}
async function generate(){
 if(busy)return;
 if(!$("sendConsent").checked){note("لازم توافق على إرسال النص والصوت المرجعي للخدمة الخارجية عند توليد الجملة.",true);return}
 const line=dialogue.find(x=>x.shot_id===$("line").value&&x.speaker===actor);
 if(!line){note("الجملة مش موجودة في سيناريو الحلقة.",true);return}
 const p=profiles[actor];
 if(p.mode==="demo"&&!OPTIONS[actor].includes(p.speaker)){note("الصوت التجريبي غير محدد.",true);return}
 if(p.mode==="licensed"&&!p.locked){note("ثبت التسجيل المرخّص أولًا بزر 🔒 قبل التوليد.",true);return}
 busy=true;$("generate").disabled=true;$("resultArea").replaceChildren();
 note("جارٍ الاتصال بمحرك الصوت المصري المجاني؛ ممكن يكون عليه طابور...");
 try{
  const {Client,handle_file}=await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
  const app=await Client.connect(SPACE_ID,{events:["data","status"]});
  let mode="builtin",speaker=p.speaker,reference=null,referenceText="";
  if(p.mode==="licensed"){
   const clip=await readClip(actor);
   if(!clip || clip.sha256!==p.sha256)throw Error("المرجع الثابت مش موجود على هذا الجهاز أو اتغيّر.");
   const audioFile=new File([clip.blob],clip.name||actor.toLowerCase()+".wav",
     {type:clip.type||"audio/wav"});
   const actual=await checksum(audioFile);
   if(actual!==p.sha256)throw Error("بصمة المرجع المسجل تغيّرت؛ تم رفض تغيير هوية الصوت.");
   mode="clone";speaker="";reference=handle_file(audioFile);referenceText=p.refText;
  }
  // Official VoiceTut Gradio API input order from voicetut_tts/server.py.
  const params=[line.text,"arz",mode,speaker,reference,referenceText,32,2.0,1.0,true];
  const job=app.submit("/synthesize",params);
  let success=false;
  for await(const event of job){
   if(event.type==="status"){
    if(event.stage==="error")throw Error("خدمة الصوت رفضت الطلب أو انتهت الحصة المجانية.");
    if(event.position!=null)note("منتظرين دور الصوت المجاني، مكان المهمة في الطابور: "+event.position);
    else note("المحرك بيجهز الصوت باللهجة المصرية...");
   }else if(event.type==="data"){
    const uri=safeAudio(event);
    const media=node("audio");media.controls=true;media.preload="none";media.src=uri;
    const link=node("a","فتح ملف الصوت WAV وتنزيله");link.href=uri;link.target="_blank";link.rel="noopener noreferrer";
    const details=node("p",p.mode==="demo"?"تجربة فقط — الصوت الجاهز غير مرخّص للنشر التجاري.":"مرجع صوت مرخّص ثابت: "+p.sha256.slice(0,12)+"…");
    details.className="small";
    $("resultArea").replaceChildren(media,link,details);
    note("✅ الجملة اتولدت. اسمع النطق والمدة وقارن بصوت الشخصية قبل الموافقة.");
    success=true;
   }
  }
  if(!success)throw Error("انتهت المحاولة من غير ملف صوت. ربما الحصة المجانية خلصت.");
 }catch(e){note("تعذر توليد الصوت الآن: "+(e?.message||"اتصال بالخدمة فشل")+
   ". يمكنك فتح خدمة VoiceTut الأصلية من الرابط الموجود أسفل الصفحة.",true)}
 finally{busy=false;$("generate").disabled=false}
}
function exportProfiles(){
 const output={series:"الحي 404",version:1,locale:"ar-EG",model:SPACE_ID,
  warning:"Demo voices are NOT commercially licensed. Reference audio files are stored only in this browser, not in this JSON.",
  created_at:new Date().toISOString(),profiles:Object.fromEntries(ACTORS.map(id=>[id,profiles[id]]))};
 const blob=new Blob([JSON.stringify(output,null,2)],{type:"application/json"});
 const url=globalThis.URL.createObjectURL(blob),a=node("a");a.href=url;
 a.download="404-character-voice-profiles.json";document.body.append(a);a.click();a.remove();
 setTimeout(()=>globalThis.URL.revokeObjectURL(url),2000);
 note("تم تنزيل ملف تعريف الأصوات. احتفظ بتسجيلات الممثلين الأصلية منفصلة؛ الملف ده لا يحتوي صوتًا.");
}
async function boot(){
 loadProfiles();
 try{
  const response=await fetch("./data/dialogue.json",{cache:"force-cache"});
  if(!response.ok)throw Error("تعذر تحميل حوار الحلقة.");
  const json=await response.json();dialogue=json.dialogue_only||[];
  if(dialogue.length!==9)throw Error("ملف الحوارات التسعة غير مكتمل.");
  actorLines();await renderProfile();
 }catch(e){note("تعذر تحميل السيناريو: "+e.message,true);$("generate").disabled=true}
 document.querySelectorAll("[data-actor]").forEach(b=>b.addEventListener("click",()=>changeActor(b.dataset.actor)));
 $("line").addEventListener("change",renderLine);
 $("mode").addEventListener("change",async()=>{
  if(profiles[actor].locked){$("mode").value=profiles[actor].mode;return}
  const m=$("mode").value;
  profiles[actor]={mode:m,speaker:m==="demo"?DEFAULT[actor]:null,locked:false};
  storeProfiles();await renderProfile();
 });
 $("speaker").addEventListener("change",saveDemo);
 $("lockVoice").addEventListener("click",lock);
 $("unlockVoice").addEventListener("click",unlock);
 $("generate").addEventListener("click",generate);
 $("exportProfile").addEventListener("click",exportProfiles);
}
document.addEventListener("DOMContentLoaded",boot);
})();
