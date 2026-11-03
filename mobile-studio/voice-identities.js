"use strict";
// Fixed, owner-authorized voice reference per character. A saved reference does not synthesize speech.
// The reference is stored in IndexedDB (same device), never uploaded automatically.
(() => {
const DB="studio404-voice-identities-v1",STORE="references";
const MAX_BYTES=15*1024*1024;
const TYPES=["audio/wav","audio/x-wav","audio/mpeg","audio/mp3","audio/ogg","audio/webm","audio/mp4","audio/x-m4a"];
let pending=null;
function validActor(id){
 if(typeof id!=="string"||!/^(LAYLA|WIDAD|SABER|C_[A-Za-z0-9_-]{4,64})$/.test(id))
  throw Error("الشخصية مش موجودة أو معرّفها غير صالح");
 return id;
}
function checkFile(file){
 if(!(file instanceof Blob)||file.size<300||file.size>MAX_BYTES)
  throw Error("اختار تسجيل صوت واضح بحجم أقل من 15MB");
 if(!TYPES.includes(file.type)&&!/\.(wav|mp3|ogg|webm|m4a)$/i.test(file.name||""))
  throw Error("اختار تسجيل WAV أو MP3 أو WebM");
}
function open(){
 if(!pending)pending=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error("المتصفح لا يدعم حفظ الأصوات"));return}
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:"actor"});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error("تعذر فتح مكتبة الأصوات"));
 });
 return pending;
}
async function digest(file){
 if(!globalThis.crypto?.subtle)throw Error("التحقق من الصوت يتطلب HTTPS");
 const bytes=await file.arrayBuffer();
 const hashed=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(hashed),v=>v.toString(16).padStart(2,"0")).join("");
}
async function get(actor){
 validActor(actor);
 const database=await open();
 return new Promise((resolve,reject)=>{
  const req=database.transaction(STORE,"readonly").objectStore(STORE).get(actor);
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
 });
}
async function save(actor,file,permission,{replace=false}={}){
 validActor(actor);checkFile(file);
 if(permission!==true)throw Error("لازم تكون موافق على استخدام صوت التسجيل في المشروع");
 const hash=await digest(file),existing=await get(actor);
 if(existing&&existing.sha256!==hash&&!replace)
  throw Error("صوت الشخصية متثبت بالفعل. تغيير الصوت يحتاج تأكيد صريح");
 if(existing&&existing.sha256===hash)return {actor,sha256:hash,unchanged:true};
 const record={actor,file,name:(file.name||actor+".wav").slice(0,120),
  mime:file.type||"audio/wav",sha256:hash,permission:true,locked_at:new Date().toISOString()};
 const database=await open();
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");
  tx.objectStore(STORE).put(record);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("مساحة التخزين المحلية لا تكفي للصوت"));
 });
 return {actor,sha256:hash,unchanged:false};
}
async function remove(actor){
 validActor(actor);
 const database=await open();
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");
  tx.objectStore(STORE).delete(actor);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
async function verify(actor){
 const item=await get(actor);
 if(!item)return null;
 if(await digest(item.file)!==item.sha256)throw Error("الملف الصوتي اتغيّر، مش هنستخدمه");
 return item;
}
globalThis.Studio404Voices=Object.freeze({get,save,remove,verify});
})();