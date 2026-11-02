"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"..","media-vault.js"),"utf8");
const gallery=fs.readFileSync(path.resolve(__dirname,"..","library.js"),"utf8");
const html=fs.readFileSync(path.resolve(__dirname,"..","library.html"),"utf8");
const gpu=fs.readFileSync(path.resolve(__dirname,"..","free-gpu.js"),"utf8");
assert.match(source,/indexedDB\.open\(DB,1\)/);
assert.match(source,/tx\.objectStore\(STORE\)\.add\(record\)/);
assert.match(source,/store\.createIndex\("created_at"/);
assert.match(source,/event|video/);
assert.match(gallery,/await vault\(\)\.list\(\)/);
assert.match(gallery,/await vault\(\)\.get\(item\.id\)/);
assert.match(gallery,/await vault\(\)\.remove\(item\.id\)/);
assert.match(gpu,/await globalThis\.Studio404Vault\.saveRemote\(video,clipMeta\)/);
assert.match(html,/id="importVideo"/);
assert.match(html,/id="items"/);
assert.match(html,/رابط تطبيق GitHub Pages نفسه ما زال عامًا/);

const rows=new Map();
let initialized=false;
function makeTransaction(){
 const tx={oncomplete:null,onerror:null,onabort:null};
 const store={
  add(value){queueMicrotask(()=>{rows.set(value.id,value);tx.oncomplete?.()})},
  get(id){const r={};queueMicrotask(()=>{r.result=rows.get(id);r.onsuccess?.()});return r},
  delete(id){queueMicrotask(()=>{rows.delete(id);tx.oncomplete?.()})},
  index(){return {openCursor(){
    const r={},sorted=[...rows.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at));let i=0;
    function next(){queueMicrotask(()=>{
      r.result=i<sorted.length?{value:sorted[i],continue(){i++;next()}}:null;
      r.onsuccess?.();
    })}
    next();return r;
  }}}
 };
 tx.objectStore=()=>store;return tx;
}
const db={
 objectStoreNames:{contains:()=>initialized},
 createObjectStore(){initialized=true;return {createIndex(){}}},
 transaction(){return makeTransaction()}
};
const indexedDB={open(){const req={};queueMicrotask(()=>{req.result=db;req.onupgradeneeded?.();req.onsuccess?.()});return req}};
const ctx={indexedDB,File,Blob,URL,console,navigator:{storage:{persist:async()=>true,estimate:async()=>({usage:0,quota:1024})}},
  crypto:{randomUUID:()=>String(rows.size+1)},setTimeout,document:{}};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 const vault=ctx.Studio404Vault;
 const clip=new File([Buffer.alloc(4096)],"layla.mp4",{type:"video/mp4"});
 const saved=await vault.saveFile(clip,{shot_id:"sh05",actor:"LAYLA",prompt:"testing"});
 assert.ok(saved.id);
 let list=await vault.list();assert.equal(list.length,1);
 assert.equal(list[0].actor,"LAYLA");
 assert.equal(list[0].shot_id,"sh05");
 assert.equal(list[0].video,undefined,"list must not load video Blobs");
 const savedClip=await vault.get(saved.id);assert.equal(savedClip.video.size,4096);
 await assert.rejects(()=>vault.saveRemote("https://evil.example/test.mp4"),/غير معتمد/);
 await vault.remove(saved.id);
 list=await vault.list();assert.equal(list.length,0);
 await assert.rejects(()=>vault.saveFile(new File(["hello"],"readme.txt",{type:"text/plain"})),/الفيديو فقط/);
 console.log("PASS: real video Blob persists in IndexedDB, private metadata listing, delete, reject unsafe files and links");
})().catch(e=>{console.error(e);process.exitCode=1});
