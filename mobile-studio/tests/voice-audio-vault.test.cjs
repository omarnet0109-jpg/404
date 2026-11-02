"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"voice-audio-vault.js"),"utf8");
const voice=fs.readFileSync(path.join(root,"voice-studio.js"),"utf8");
const gallery=fs.readFileSync(path.join(root,"library.js"),"utf8");
assert.match(voice,/Studio404AudioVault\.fromRemote\(uri,actor,line\.shot_id,voiceIdentity\)/);
assert.match(gallery,/Studio404AudioVault\.get\(item\.actor,item\.shot_id\)/);
assert.match(source,/id,actor,shot,voiceHash/);
const items=new Map();let initialized=false;
function transaction(){
 const tx={oncomplete:null,onerror:null};
 tx.objectStore=()=>({
  put(item){queueMicrotask(()=>{items.set(item.id,item);tx.oncomplete?.()})},
  get(id){const req={};queueMicrotask(()=>{req.result=items.get(id)||null;req.onsuccess?.()});return req},
  delete(id){queueMicrotask(()=>{items.delete(id);tx.oncomplete?.()})},
  openCursor(){const req={},values=[...items.values()];let i=0;function next(){queueMicrotask(()=>{
    req.result=i<values.length?{value:values[i],continue(){i++;next()}}:null;
    req.onsuccess?.();
   })}next();return req}
 });
 return tx;
}
const db={createObjectStore(){initialized=true;return {}},transaction};
const indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onupgradeneeded?.();req.onsuccess?.()});return req}};
const ctx={indexedDB,Blob,File,URL,console,fetch:async()=>{throw Error("No network in test")}};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 const vault=ctx.Studio404AudioVault;
 const wav=new File([Buffer.alloc(2048,42)],"layla.wav",{type:"audio/wav"});
 await vault.save(wav,"LAYLA","sh05","hash123");
 const record=await vault.get("LAYLA","sh05");
 assert.equal(record.file.size,2048);
 assert.equal(record.voiceHash,"hash123");
 assert.equal((await vault.list()).length,1);
 await assert.rejects(()=>vault.save(wav,"SABER","invalid","x"),/غير معروفة/);
 await assert.rejects(()=>vault.fromRemote("https://evil.example/file.wav","LAYLA","sh05","x"),/غير موثوق/);
 await vault.remove("LAYLA","sh05");
 assert.equal(await vault.get("LAYLA","sh05"),null);
 console.log("PASS: audio real Blob persisted by character and shot, audio integrity boundaries");
})().catch(err=>{console.error(err);process.exitCode=1});
