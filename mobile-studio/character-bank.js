"use strict";
// Approved 404 Studio reference photos; one-time import, local-only IndexedDB storage.
// Photos are never sent to any generation service without the user's explicit action.
(() => {
const DB_NAME="studio404-approved-character-refs-v1",STORE="references";
const ACTORS=new Set(["LAYLA","WIDAD","SABER","ensemble"]);
const MAX_BYTES=12*1024*1024;
let opened, manifest;
function db(){
 if(!opened)opened=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error("المتصفح لا يدعم حفظ الصور المحلية"));return}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:"actor"});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error("تعذر فتح مكتبة صور الشخصيات"));
 });
 return opened;
}
function actorId(actor){
 if(!ACTORS.has(actor))throw Error("معرّف شخصية غير صالح");
 return actor;
}
async function expectedHashes(){
 if(manifest)return manifest;
 const res=await fetch("./data/characters.json",{cache:"force-cache"});
 if(!res.ok)throw Error("ملف مراجع الشخصيات غير متاح");
 const b=await res.json();
 const values=Object.fromEntries((b.reference_images||[]).map(x=>[x.id,x.sha256]));
 if([...ACTORS].some(x=>!(/^[a-f0-9]{64}$/).test(values[x]||"")))throw Error("مرجع الشخصيات الأصلي غير مكتمل");
 manifest=values;
 return values;
}
async function hash(file){
 const bytes=await file.arrayBuffer();
 const raw=await crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(raw)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function approve(file,actor){
 actorId(actor);
 if(!(file instanceof Blob)||file.size<100||file.size>MAX_BYTES ||
   !["image/png","image/jpeg","image/webp"].includes(file.type))
   throw Error("اختار صورة أصلية PNG / JPG / WebP بحجم أقل من 12MB");
 const allowed=await expectedHashes(),actual=await hash(file);
 if(actual!==allowed[actor])
   throw Error("الصورة مختلفة عن مرجع "+actor+" الأصلي المعتمد في الحي 404. اختار ملف الشخصية الأصلي بدون تعديل أو إعادة حفظ.");
 const database=await db();
 const item={actor,blob:file,name:file.name||actor.toLowerCase()+".png",
   mime:file.type,sha256:actual,saved_at:new Date().toISOString()};
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");
  tx.objectStore(STORE).put(item);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("نفدت مساحة حفظ الصور في الموبايل"));
 });
 return item;
}
async function get(actor){
 actorId(actor);
 const database=await db();
 const item=await new Promise((resolve,reject)=>{
  const request=database.transaction(STORE,"readonly").objectStore(STORE).get(actor);
  request.onsuccess=()=>resolve(request.result||null);
  request.onerror=()=>reject(request.error);
 });
 if(!item)return null;
 const allowed=await expectedHashes();
 if(item.sha256!==allowed[actor] || await hash(item.blob)!==allowed[actor])
   throw Error("مرجع الشخصية المخزن لم يعد مطابقًا. احذف النسخة وأعد استخدام الصورة الأصلية.");
 return item;
}
async function remove(actor){
 actorId(actor);
 const database=await db();
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");
  tx.objectStore(STORE).delete(actor);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
globalThis.Studio404CharacterBank=Object.freeze({approve,get,remove});
})();