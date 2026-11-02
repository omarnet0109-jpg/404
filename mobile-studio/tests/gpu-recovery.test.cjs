"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const js=fs.readFileSync(path.join(root,"simple.js"),"utf8");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
assert.match(html,/id="recovery"[^>]*hidden/,"Recovery must not clutter the normal UI");
assert.match(html,/id="copyVideoPrompt"/);
assert.match(html,/id="downloadCharacterImage"/);
assert.match(html,/huggingface\.co\/spaces\/zerogpu-aoti\/wan2-2-fp8da-aoti-faster/);
assert.match(js,/if\(event\.stage==="error"\)throw Error\(event\.message\|\|event\.code/);
assert.match(js,/showRecovery\(\)/);
assert.match(js,/hideRecovery\(\)/);
assert.match(js,/navigator\.clipboard\.writeText\(value\)/);
assert.match(js,/globalThis\.URL\.createObjectURL\(char\.image\)/);
assert.doesNotMatch(js,/setInterval\(.*generate|setTimeout\(.*generate/,"Do not automatically retry failed GPU calls");

const start=js.indexOf("function describeGpuError(error){");
const end=js.indexOf("function showRecovery()",start);
assert(start>=0&&end>start,"Error handler code must be available");
const describe=vm.runInNewContext(
 "(function(){"+js.slice(start,end)+"return describeGpuError})()"
);
assert.match(describe({message:"GPU quota exceeded"}),/حصة مجانية/);
assert.match(describe({message:"429 Too Many Requests"}),/حد طلبات/);
assert.match(describe({message:"503 service unavailable"}),/مشغولة أو الاتصال/);
assert.match(describe({message:"403 Unauthorized"}),/محتاجة دخول/);
assert.match(describe({message:"Something failed in model"}),/Something failed in model/);
console.log("PASS: actual Gradio error exposed, quota/availability/account recovery and no silent retries");
