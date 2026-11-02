"use strict";
// Local Egyptian dialogue storage by fixed character and shot. Never stores only remote links.
(() => {
const DB="studio404-audio-clips-v1",STORE="audio";
const ACTORS=new Set(["LAYLA","WIDAD","SABER"]);
let pending;
function key(actor,shot){
 if(!ACTORS.has(actor)||!/^sh(0[1-9]|1[0-6])$/.test(shot||""))throw Error("شخصية أو لقطة غير معروفة");
 return actor+":"+shot;
}
function db(){
 if(!pending)pending=new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:"id"});
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error("تعذر إنشاء مكتبة الأصوات المحلية"));
 });
 return pending;
}
async function save(file,actor,shot,voiceHash){
 if(!(file instanceof Blob)||file.size<300||file.size>30*1024*1024)
  throw Error("الصوت فارغ أو أكبر من الحد المسموح (30MB)");
 if(file.type&&!["audio/wav","audio/x-wav","audio/mpeg","audio/mp3","audio/ogg","audio/webm","audio/mp4","audio/x-m4a","application/octet-stream"].includes(file.type))
  throw Error("الملف المختار ليس صيغة صوت معروفة");
 const id=key(actor,shot);
 const item={id,actor,shot,voiceHash:String(voiceHash||"demo"),file,
  name:file.name||id+".wav",created_at:new Date().toISOString()};
 const database=await db();
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");
  tx.objectStore(STORE).put(item);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("تعذر حفظ الصوت في الجهاز"));
 });
 return {id,name:item.name,created_at:item.created_at};
}
async function fromRemote(url,actor,shot,voiceHash){
 const uri=new globalThis.URL(url);
 if(uri.protocol!=="https:" || !(uri.hostname==="huggingface.co"||uri.hostname.endsWith(".hf.space")))
  throw Error("عنوان ملف الصوت غير موثوق");
 let response;
 try{response=await fetch(uri.href,{credentials:"omit",mode:"cors",cache:"no-store"})}
 catch{throw Error("الخدمة منعت تنزيل الصوت تلقائيًا. نزّل WAV بنفسك واحفظه في مكتبة الصوت.")}
 if(!response.ok||response.type==="opaque")throw Error("الصوت مش متاح للتنزيل");
 const blob=await response.blob();
 if(!["audio/","application/octet-stream"].some(t=>blob.type.startsWith(t)))
  throw Error("الخدمة رجعت ملفًا ليس صوتًا");
 return save(new File([blob],"404-"+actor+"-"+shot+".wav",{type:blob.type||"audio/wav"}),actor,shot,voiceHash);
}
async function get(actor,shot){
 const id=key(actor,shot),database=await db();
 return new Promise((resolve,reject)=>{
  const req=database.transaction(STORE,"readonly").objectStore(STORE).get(id);
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
 });
}
async function list(){
 const database=await db();
 return new Promise((resolve,reject)=>{
  const items=[],req=database.transaction(STORE,"readonly").objectStore(STORE).openCursor();
  req.onsuccess=()=>{
    const c=req.result;
    if(!c){resolve(items.sort((a,b)=>b.created_at.localeCompare(a.created_at)));return}
    const {file,...metadata}=c.value;items.push(metadata);c.continue();
  };req.onerror=()=>reject(req.error);
 });
}
async function remove(actor,shot){
 const database=await db();
 await new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,"readwrite");
  tx.objectStore(STORE).delete(key(actor,shot));
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });
}
globalThis.Studio404AudioVault=Object.freeze({save,fromRemote,get,list,remove});
})();