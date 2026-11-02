"use strict";
// 404 Studio private on-device media library. Stores REAL video Blobs in IndexedDB.
// No cloud sync, no password gate, no guarantee against browser data clearing.
(() => {
const DB = "404-studio-videos-v1", STORE = "videos";
const MAX_FILE_BYTES = 240 * 1024 * 1024;
let dbPromise;
function open(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  if(!("indexedDB" in globalThis)){reject(Error("متصفحك لا يدعم تخزين الفيديوهات المحلية"));return}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){
    const store=db.createObjectStore(STORE,{keyPath:"id"});
    store.createIndex("created_at","created_at");
  }};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error("فشل فتح مكتبة الفيديو"));
 });
 return dbPromise;
}
function validateFile(file){
 if(!(file instanceof Blob) || !file.size || file.size>MAX_FILE_BYTES)
   throw Error("ملف الفيديو فارغ أو أكبر من الحد المسموح (240MB)");
 const name=file.name||"";
 const accepted=["video/mp4","video/webm","video/quicktime","video/x-matroska"];
 if(file.type && !accepted.includes(file.type) && !/\.(mp4|webm|mov|mkv)$/i.test(name))
   throw Error("المكتبة تقبل ملفات الفيديو فقط");
}
function safeMeta(meta={}){
 const validShot=/^sh(0[1-9]|1[0-6])$/;
 const shot=validShot.test(meta.shot_id||"")?meta.shot_id:null;
 const allowed=["LAYLA","WIDAD","SABER","ensemble"];
 const actor=allowed.includes(meta.actor)?meta.actor:"ensemble";
 return {shot_id:shot,actor,prompt:String(meta.prompt||"").slice(0,4500),
   source:meta.source==="zerogpu"?"zerogpu":"local-import"};
}
async function saveFile(file,meta={}){
 validateFile(file);
 const db=await open();const now=new Date().toISOString();
 const id=(globalThis.crypto?.randomUUID?.()||"v"+Date.now()+"-"+Math.random().toString(36).slice(2));
 const record={id,created_at:now,name:(file.name||("404-"+(meta.shot_id||"clip")+".mp4")).slice(0,140),
   type:file.type||"video/mp4",size:file.size,video:file,...safeMeta(meta)};
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");
  tx.objectStore(STORE).add(record);
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error||Error("نفدت مساحة التخزين المتاحة على الموبايل"));
  tx.onabort=()=>reject(tx.error||Error("تعذر حفظ الفيديو محليًا"));
 });
 return {id,created_at:now,name:record.name,size:record.size};
}
async function saveRemote(url,meta={}){
 // Third-party CORS is not guaranteed. An opaque response is never saved as a fake video.
 const target=new globalThis.URL(url);
 if(target.protocol!=="https:" ||
   !(target.hostname==="huggingface.co"||target.hostname.endsWith(".hf.space")))
   throw Error("عنوان الفيديو الخارجي غير معتمد");
 let response;
 try{response=await fetch(target.href,{mode:"cors",credentials:"omit",cache:"no-store"})}
 catch{throw Error("الخدمة الخارجية منعت تنزيل الفيديو مباشرة. اضغط تنزيل MP4 ثم استورده في مكتبة فيديوهاتي.")}
 if(!response.ok || response.type==="opaque")throw Error("تعذر تنزيل ملف الفيديو من الخدمة الخارجية");
 const blob=await response.blob();
 if(!blob.type.startsWith("video/") && blob.type!=="application/octet-stream"){
  throw Error("الخدمة رجعت ملفًا ليس فيديو");
 }
 const ext=blob.type==="video/webm"?"webm":blob.type==="video/quicktime"?"mov":"mp4";
 const file=new File([blob], "404-"+(meta.shot_id||"clip")+"-"+Date.now()+"."+ext,{type:blob.type||"video/mp4"});
 return saveFile(file,{...meta,source:"zerogpu"});
}
async function list(){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const rows=[],tx=db.transaction(STORE,"readonly");
  const req=tx.objectStore(STORE).index("created_at").openCursor(null,"prev");
  req.onsuccess=()=>{
   const c=req.result;
   if(!c){resolve(rows);return}
   const {video,...rest}=c.value;rows.push(rest);c.continue();
  };
  req.onerror=()=>reject(req.error);
 });
}
async function get(id){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,"readonly").objectStore(STORE).get(id);
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error);
 });
}
async function remove(id){
 const db=await open();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
function download(record){
 if(!record?.video)throw Error("الفيديو المطلوب مش محفوظ");
 const uri=globalThis.URL.createObjectURL(record.video);
 const link=document.createElement("a");link.href=uri;link.download=record.name||"404-studio-video.mp4";
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>globalThis.URL.revokeObjectURL(uri),60000);
}
async function requestPersistence(){
 try{
  if(!navigator.storage?.persist)return false;
  return Boolean(await navigator.storage.persist());
 }catch{return false}
}
async function estimate(){
 try{return await navigator.storage.estimate()}catch{return null}
}
globalThis.Studio404Vault=Object.freeze({
 saveFile,saveRemote,list,get,remove,download,requestPersistence,estimate,MAX_FILE_BYTES
});
})();