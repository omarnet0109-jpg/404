"use strict";
// The owner's character images live in their browser's IndexedDB; never put images in GitHub.
// This is local project storage, NOT authentication for the public website.
(() => {
const DB="studio404-simple-characters-v1",STORE="characters";
const MAX=12*1024*1024, allowed=["image/png","image/jpeg","image/webp"];
const DEFAULT=[["LAYLA","ليلى"],["WIDAD","الحاجة وداد"],["SABER","عم صابر"]];
let opened;
function open(){
 if(!opened)opened=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error("المتصفح لا يدعم حفظ صور الشخصيات"));return}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{
   const store=req.result.createObjectStore(STORE,{keyPath:"id"});
   for(const [id,name] of DEFAULT)store.put({id,name,image:null,updated_at:""});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error("تعذر فتح مكتبة الشخصيات"));
 });
 return opened;
}
function isId(id){return typeof id==="string"&&/^[A-Za-z0-9_-]{2,64}$/.test(id)}
function checkImage(image){
 if(!(image instanceof Blob)||!allowed.includes(image.type)||image.size<100||image.size>MAX)
  throw Error("اختار PNG أو JPG أو WebP أصغر من 12MB");
}
async function all(){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,"readonly").objectStore(STORE).getAll();
  req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>{
   const i=DEFAULT.findIndex(x=>x[0]===a.id),j=DEFAULT.findIndex(x=>x[0]===b.id);
   if(i>=0&&j>=0)return i-j;if(i>=0)return -1;if(j>=0)return 1;
   return a.name.localeCompare(b.name,"ar");
  }));
  req.onerror=()=>reject(req.error);
 });
}
async function get(id){
 if(!isId(id))return null;
 const db=await open();
 return new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,"readonly").objectStore(STORE).get(id);
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error);
 });
}
async function save({id,name,image}){
 const title=String(name||"").trim();
 if(!title||title.length>60)throw Error("اسم الشخصية مطلوب وأقصاه 60 حرفًا");
 if(image!=null)checkImage(image);
 const key=isId(id)?id:"C_"+(globalThis.crypto?.randomUUID?.().replace(/-/g,"")||Date.now().toString(36));
 const current=await get(key);
 // Keep old picture unless owner explicitly replaces it.
 const record={id:key,name:title,image:image??current?.image??null,
   updated_at:new Date().toISOString()};
 const db=await open();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(record);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("تعذر حفظ الشخصية. تأكد من وجود مساحة على جهازك"));
 });
 return {id:key,name:title};
}
async function remove(id){
 if(!isId(id))throw Error("معرف شخصية غير صحيح");
 const db=await open();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");
  if(DEFAULT.some(x=>x[0]===id)){
   const item=DEFAULT.find(x=>x[0]===id);
   tx.objectStore(STORE).put({id,name:item[1],image:null,updated_at:new Date().toISOString()});
  }else tx.objectStore(STORE).delete(id);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
globalThis.Studio404Characters=Object.freeze({all,get,save,remove,DEFAULT});
})();