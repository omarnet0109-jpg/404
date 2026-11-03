"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const root=path.resolve(__dirname,"..");
const home=fs.readFileSync(path.join(root,"index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"simple.js"),"utf8");
const identity=fs.readFileSync(path.join(root,"voice-identities.js"),"utf8");
const audio=fs.readFileSync(path.join(root,"clip-audio.js"),"utf8");
const editor=fs.readFileSync(path.join(root,"episode-editor.js"),"utf8");
const view=fs.readFileSync(path.join(root,"episode-editor.html"),"utf8");
const library=fs.readFileSync(path.join(root,"library.js"),"utf8");

assert.match(home,/id="lockVoiceRef"/);
assert.match(home,/id="voiceRights"/);
assert.match(home,/href="\.\/episode-editor\.html"/);
assert.match(app,/Studio404Voices\.save\(actor,file,true,\{replace:!!existing\}\)/);
assert.match(app,/if\(existing&&!confirm\(/);
assert.match(app,/episode-editor\.html\?video=/);
assert.match(view,/id="timeline"/);
assert.match(view,/id="attachAudio"/);
assert.match(view,/id="audioConsent"/);
assert.match(view,/id="generateDialogue"/);
assert.match(view,/id="exportEpisode"/);
assert.match(editor,/const MAX_CLIPS=16,MAX_LENGTH=90/);
assert.match(editor,/context\.createMediaStreamDestination\(\)/);
assert.match(editor,/canvas\.captureStream\(12\)/);
assert.match(editor,/new MediaRecorder\(combined/);
assert.match(editor,/const params=\[line,"arz","clone","",handle_file\(source\),referenceText,32,2,1,true\]/);
assert.match(editor,/app|client\.submit\("\/synthesize",params\)/);
assert.match(editor,/voice\.referenceHash!==reference\.sha256/);
assert.match(editor,/if\(!\$\("audioConsent"\)\.checked\)/);
assert.match(editor,/await vault\(\)\.saveFile\(file,\{actor:"ensemble",source:"episode-montage"\}\)/);
assert.match(library,/Studio404ClipAudio\.get\(item\.id\)/);
assert.match(library,/episode-editor\.html\?video=/);

function makeIDB(){
 const state=new Map();
 const db={transaction(){
  const tx={oncomplete:null,onerror:null};
  tx.objectStore=()=>({
   get(id){const req={};queueMicrotask(()=>{req.result=state.get(id)||null;req.onsuccess?.()});return req},
   put(obj){queueMicrotask(()=>{state.set(obj.actor||obj.videoId,obj);tx.oncomplete?.()})},
   delete(id){queueMicrotask(()=>{state.delete(id);tx.oncomplete?.()})}
  });return tx;
 },createObjectStore(){}};
 return {state,indexedDB:{open(){const req={};queueMicrotask(()=>{
  req.result=db;req.onupgradeneeded?.();req.onsuccess?.();
 });return req}}};
}
(async()=>{
 const voiceDB=makeIDB();
 const voiceCtx={indexedDB:voiceDB.indexedDB,Blob,File,crypto:webcrypto};
 vm.createContext(voiceCtx);vm.runInContext(identity,voiceCtx);
 const voices=voiceCtx.Studio404Voices;
 const first=new File([Buffer.alloc(600,42)],"layla.wav",{type:"audio/wav"});
 const second=new File([Buffer.alloc(600,43)],"layla-2.wav",{type:"audio/wav"});
 await assert.rejects(()=>voices.save("LAYLA",first,false),/إذن/);
 const saved=await voices.save("LAYLA",first,true);
 assert.equal(saved.sha256.length,64);
 assert.equal((await voices.verify("LAYLA")).sha256,saved.sha256);
 await assert.rejects(()=>voices.save("LAYLA",second,true),/تأكيد صريح/);
 const replaced=await voices.save("LAYLA",second,true,{replace:true});
 assert.notEqual(replaced.sha256,saved.sha256);
 await assert.rejects(()=>voices.save("INVALID",first,true),/غير صالح/);

 const audioDB=makeIDB(),audioCtx={indexedDB:audioDB.indexedDB,Blob,File};
 vm.createContext(audioCtx);vm.runInContext(audio,audioCtx);
 const clips=audioCtx.Studio404ClipAudio;
 const vid="f1e2d3c4-abc",wav=new File([Buffer.alloc(1000,9)],"line.wav",{type:"audio/wav"});
 await clips.save(vid,"LAYLA",wav,{referenceHash:replaced.sha256,source:"voicetut"});
 const actual=await clips.get(vid);
 assert.equal(actual.file.size,1000);
 assert.equal(actual.referenceHash,replaced.sha256);
 await assert.rejects(()=>clips.save(vid,"LAYLA",wav),/تأكيد/);
 await clips.remove(vid);assert.equal(await clips.get(vid),null);
 console.log("PASS: locked voice identity, consented replacement, per-video dialogue persistence and montage controls");
})().catch(e=>{console.error(e);process.exitCode=1});
