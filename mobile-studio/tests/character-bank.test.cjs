"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const {webcrypto}=require("node:crypto");
const root=path.resolve(__dirname,"..");
const bankJs=fs.readFileSync(path.join(root,"character-bank.js"),"utf8");
const gpuJs=fs.readFileSync(path.join(root,"free-gpu.js"),"utf8");
const gpuHtml=fs.readFileSync(path.join(root,"free-gpu.html"),"utf8");
assert.match(gpuHtml,/<script defer src="\.\/character-bank\.js\?v=1"><\/script>/);
assert.match(gpuJs,/await bank\.approve\(chosen,actor\)/);
assert.match(gpuJs,/const saved=await bank\.get\(actor\)/);
assert.match(gpuJs,/\.\/voice-studio\.html\?actor=/);
assert.match(gpuJs,/await refreshSavedReference\(\)/);
assert.match(bankJs,/await crypto\.subtle\.digest\("SHA-256",bytes\)/);

const rows=new Map();let initialized=false;
function transaction(){
 const tx={oncomplete:null,onerror:null};
 tx.objectStore=()=>({
  put(item){queueMicrotask(()=>{rows.set(item.actor,item);tx.oncomplete?.()})},
  get(id){const req={};queueMicrotask(()=>{req.result=rows.get(id)||null;req.onsuccess?.()});return req},
  delete(id){queueMicrotask(()=>{rows.delete(id);tx.oncomplete?.()})}
 });
 return tx;
}
const db={objectStoreNames:{contains:()=>initialized},
 createObjectStore(){initialized=true;return {}},transaction};
const indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onupgradeneeded?.();req.onsuccess?.()});return req}};
(async()=>{
 const approved=new File([Buffer.alloc(512,7)],"layla.png",{type:"image/png"});
 const digest=Buffer.from(await webcrypto.subtle.digest("SHA-256",await approved.arrayBuffer())).toString("hex");
 const refMap=["LAYLA","WIDAD","SABER","ensemble"].map(id=>({id,sha256:digest}));
 const ctx={indexedDB,Blob,File,crypto:webcrypto,fetch:async()=>({ok:true,json:async()=>({reference_images:refMap})})};
 vm.createContext(ctx);vm.runInContext(bankJs,ctx);
 const bank=ctx.Studio404CharacterBank;
 const first=await bank.approve(approved,"LAYLA");
 assert.equal(first.sha256,digest);
 const second=await bank.get("LAYLA");
 assert.equal(second.blob.size,512);
 assert.equal(rows.size,1,"reference is stored only once per actor");
 const altered=new File([Buffer.alloc(512,8)],"wrong.png",{type:"image/png"});
 await assert.rejects(()=>bank.approve(altered,"LAYLA"),/مختلفة عن مرجع/);
 await assert.rejects(()=>bank.approve(approved,"INVALID"),/غير صالح/);
 await bank.remove("LAYLA");
 assert.equal(await bank.get("LAYLA"),null);
 console.log("PASS: reference stored once, reused by actor, reject changed image");
})().catch(e=>{console.error(e);process.exitCode=1});
