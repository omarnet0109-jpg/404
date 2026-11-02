"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const base = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(base, "voice-studio.js"), "utf8");
const html = fs.readFileSync(path.join(base, "voice-studio.html"), "utf8");
const scene = JSON.parse(fs.readFileSync(path.join(base, "data", "dialogue.json"), "utf8"));
assert.equal(scene.dialogue_only.length, 9, "Exact 9 original spoken lines must be kept");
assert.deepEqual([...new Set(scene.dialogue_only.map(s => s.speaker))].sort(),
  ["LAYLA", "SABER", "WIDAD"]);
assert.equal(new Set(scene.dialogue_only.map(s => s.shot_id)).size, 9);
assert.match(js, /const ACTORS = \["LAYLA","WIDAD","SABER"\]/);
assert.match(js, /let mode="builtin",speaker=p\.speaker,reference=null,referenceText=""/);
assert.match(js, /mode="clone";speaker="";reference=handle_file\(audioFile\)/);
assert.match(js, /\["demo","licensed"\]/);
assert.match(js, /await crypto\.subtle\.digest\("SHA-256",bytes\)/);
assert.match(js, /if\(actual!==p\.sha256\)/);
assert.match(js, /localStorage\.setItem\(PROFILE_KEY/);
assert.match(js, /indexedDB\.open\(DB_NAME,1\)/);
assert.match(js, /if\(!\$\("rights"\)\.checked\)/);
assert.match(js, /if\(!\$\("sendConsent"\)\.checked\)/);
assert.match(js, /\["LAYLA","WIDAD","SABER"\]/);
assert.match(js, /const params=\[line\.text,"arz",mode,speaker,reference,referenceText,32,2\.0,1\.0,true\]/);
assert.match(js, /app\.submit\("\/synthesize",params\)/);
assert.match(js, /media\.duration>line\.end-line\.start\+0\.1/);
assert.match(html, /الأصوات الجاهزة.*ليست مرخّصة للنشر التجاري/);
assert.match(html, /id="lockVoice"/);
assert.match(html, /id="refAudio"/);
assert.match(html, /id="sendConsent"/);
assert.doesNotMatch(js, /const URL\s*=/);
const start = js.indexOf("function safeAudio(event){");
const end = js.indexOf("async function generate(){",start);
assert(start>=0&&end>start,"safeAudio resolver must exist");
const handler = vm.runInNewContext(
 "(function(){const SPACE_ORIGIN='https://mohammedaly22-voicetut-tts.hf.space';"+
 js.slice(start,end)+";return safeAudio;})()",
 {globalThis:{URL}});
const src = "https://mohammedaly22-voicetut-tts.hf.space/gradio_api/file=/tmp/test.wav";
assert.equal(handler({data:[{url:src},{}]}),src);
assert.equal(handler({data:[{url:"/gradio_api/file=/tmp/test.wav"}]}),src);
assert.throws(()=>handler({data:[{url:"https://attacker.test/audio.wav"}]}),/غير موثوق/);
assert.throws(()=>handler({data:[]}),/لم تُرجع/);
console.log("PASS 404 voice studio: actor mapping, 9 lines, consent, profile SHA, Gradio payload, audio safety");
