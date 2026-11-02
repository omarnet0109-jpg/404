"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.resolve(__dirname, "..", "free-gpu.js"), "utf8");
const spaceHost = "https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space";
assert.doesNotMatch(source, /\bconst\s+URL\s*=/, "Never shadow the built-in URL constructor");
assert.match(source, /new globalThis\.URL\(/, "Video URL parsing must use built-in URL");
assert.match(source, /URL\.createObjectURL\(file\)/, "Selected photo preview must keep working");
assert.match(source, /events:\["data","status"\]/, "Queue status events must be enabled");

const begin = source.indexOf("function safeVideo(result){");
const end = source.indexOf("async function submit(){", begin);
assert(begin >= 0 && end > begin, "Unable to locate the real video resolver");
const body = source.slice(begin, end);
const resolveVideo = vm.runInNewContext(
  '(function(){const SPACE_APP_ORIGIN=' + JSON.stringify(spaceHost) + ';' +
  body + ';return safeVideo;})()', { URL, globalThis: { URL } }
);
const remote = spaceHost + "/gradio_api/file=/tmp/generated.mp4";
assert.equal(resolveVideo({data:[{video:{url:remote}}]}), remote);
assert.equal(resolveVideo({data:[{url:remote}]}), remote);
assert.equal(resolveVideo({data:[remote]}), remote);
assert.equal(resolveVideo({data:[{video:{url:"/gradio_api/file=/tmp/generated.mp4"}}]}), remote);
assert.throws(()=>resolveVideo({data:[{url:"https://malicious.example/clip.mp4"}]}),/غير آمن/);
assert.throws(()=>resolveVideo({data:[]}),/ما رجّعتش/);
console.log("PASS: Gradio video resolver, relative links, photo preview and queue events");
