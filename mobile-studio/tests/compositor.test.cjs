"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const p=path.resolve(__dirname,"..");
const code=fs.readFileSync(path.join(p,"compositor.js"),"utf8");
const html=fs.readFileSync(path.join(p,"compositor.html"),"utf8");
const gallery=fs.readFileSync(path.join(p,"library.html"),"utf8");
assert.match(html,/id="combine"/);
assert.match(html,/media-vault\.js/);
assert.match(html,/voice-audio-vault\.js/);
assert.match(html,/compositor\.js/);
assert.match(gallery,/href="\.\/compositor\.html"/);
assert.match(code,/const AudioEngine=globalThis\.AudioContext\|\|globalThis\.webkitAudioContext/);
assert.match(code,/context\.createMediaElementSource\(audio\)/);
assert.match(code,/context\.createMediaStreamDestination\(\)/);
assert.match(code,/new MediaStream\(\[\.\.\.videoStream\.getVideoTracks\(\),audioTrack\]\)/);
assert.match(code,/canvas\.captureStream\(24\)/);
assert.match(code,/new MediaRecorder\(combined/);
assert.match(code,/videoVault\(\)\.saveFile\(output/);
assert.match(code,/aSaved\.shot/);
assert.match(code,/vSaved\.actor!==aSaved\.actor/);
assert.match(code,/video\\/webm;codecs=vp8,opus/);
assert.match(code,/النتيجة مش ليب سينك/);
assert.doesNotMatch(code,/fetch\(/,"Mixer must never upload files");
const start=code.indexOf("const SUPPORTED=[");
const end=code.indexOf("let videos=",start);
const m=code.indexOf("function matchingAudio(",end);
const en=code.indexOf("function selectedVideo()",m);
assert(start>=0&&end>start&&m>0&&en>m);
const pieces=code.slice(start,end)+
 code.slice(code.indexOf("function availableType()",end),m)+
 code.slice(m,en);
const fn=vm.runInNewContext(
 '(function(){'+pieces+';return {targetSize,availableType,matchingAudio}})()',
 {globalThis:{MediaRecorder:{isTypeSupported:t=>t==="video/webm"}},audios:[
 {id:"LAYLA:sh05",actor:"LAYLA",shot:"sh05"},
 {id:"SABER:sh05",actor:"SABER",shot:"sh05"}
 ]});
assert.deepEqual({...fn.targetSize(1080,1920)},{width:540,height:960});
assert.deepEqual({...fn.targetSize(320,568)},{width:320,height:568});
assert.equal(fn.availableType(),"video/webm");
assert.equal(fn.matchingAudio({actor:"LAYLA",shot_id:"sh05"}).length,1);
assert.equal(fn.matchingAudio({actor:"LAYLA",shot_id:"sh07"}).length,0);
assert.throws(()=>fn.targetSize(0,10),/أبعاد/);
console.log("PASS: free local video/audio mixer, browser codec guard, duration logic, character-safe matching");
