"use strict";
// Holds actual dialogue audio for each saved video ID, not a temporary third-party URL.
(() => {
const DB="studio404-video-dialogue-v1",STORE="clips";
const TYPES=["audio/wav","audio/x-wav","audio/mpeg","audio/mp3","audio/ogg","audio/webm","audio/mp4","audio/x-m4a","application/octet-stream"];
let pending;
function validId(id){
 if(typeof id!=="string"||!(/^[A-Za-z0-9_-]{8,120}$/).test(id))
  throw Error("معرف الفيديو غير صالح");
 return id;
}
function validate(file){
 if(!(file instanceof Blob)||file.size<300||file.size>30*1024*1024)
  throw Error("اختار ملف صوت أقل من 30MB");
 if(!TYPES.includes(file.type)&&!/\.(wav|mp3|ogg|webm|m4a)$/i.test(file.name||""))
  throw Error("الصيغة مش صوت WAV أو MP3 أو WebM");
}
function open(){
 if(!pending)pending=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error("المتصفح لا يدعم حفظ الصوت المحلي"));return}
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"videoId"});
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error("تعذر فتح أصوات الفيديوهات"));
 });
 return pending;
}
async function get(videoId){
 validId(videoId);const database=await open();
 return new Promise((resolve,reject)=>{
  const r=database.transaction(STORE,"readonly").objectStore(STORE).get(videoId);
  r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
 });
}
async function save(videoId,actor,file,{replace=false,source="import",referenceHash=null}={}){
 validId(videoId);validate(file);
 const existing=await get(videoId);
 if(existing&&!replace)throw Error("الفيديو له صوت محفوظ بالفعل؛ يلزم تأكيد الاستبدال.");
 const database=await open();
 const record={videoId,actor:String(actor).slice(0,80),file,name:String(file.name||"dialogue.wav").slice(0,140),
   source:source==="voicetut"?"voicetut":"import",referenceHash:referenceHash||null,
   created_at:new Date().toISOString()};
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).put(record);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("تعذر حفظ صوت الفيديو في الموبايل"));
 });
 return {videoId,name:record.name,created_at:record.created_at};
}
async function remove(videoId){
 validId(videoId);const database=await open();
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(videoId);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
globalThis.Studio404ClipAudio=Object.freeze({get,save,remove});
})();