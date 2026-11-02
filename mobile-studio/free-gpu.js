"use strict";
// This page uses a public, third-party ZeroGPU Gradio Space, NOT the private 404 ComfyUI backend.
// Never includes paid API credentials or silently transfers users' reference photos.
(() => {
const ID="zerogpu-aoti/wan2-2-fp8da-aoti-faster";
const SPACE_APP_ORIGIN="https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space";
const $=id=>document.getElementById(id);
let shots=[],selected=null,busy=false,previewUrl=null;
const el=(tag,txt)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;return e};
function status(message,error=false){const n=$("notice");n.textContent=message;n.style.color=error?"#ffb6ad":"#a6b6cf"}
function selectScene(id){selected=shots.find(s=>s.shot_id===id)||shots[0];if(selected)$("prompt").value=selected.prompt_en}
function validPhoto(f){return !!f&&["image/png","image/jpeg","image/webp"].includes(f.type)&&f.size>0&&f.size<=12*1024*1024}
function safeVideo(result){
 let candidate=result?.data?.[0];
 if(Array.isArray(candidate))candidate=candidate[0];
 if(candidate?.video)candidate=candidate.video;
 const link=typeof candidate==="string"?candidate:candidate?.url;
 if(!link||typeof link!=="string")throw Error("الخدمة انتهت لكن ما رجّعتش رابط فيديو صالح");
 const uri=new globalThis.URL(link,SPACE_APP_ORIGIN);
 if(uri.protocol!=="https:"||!(uri.hostname==="huggingface.co"||uri.hostname.endsWith(".hf.space")))
   throw Error("رابط الفيديو الخارج من الخدمة غير آمن أو غير معروف");
 return uri.href;
}
async function submit(){
 if(busy)return;
 const file=$("reference").files?.[0];
 if(!validPhoto(file)){status("اختار صورة PNG أو JPG أو WebP بحد أقصى 12MB، مش ملف ZIP.",true);return}
 if(!$("consent").checked){status("لازم توافق أولًا على إرسال الصورة للخدمة الخارجية.",true);return}
 const prompt=$("prompt").value.trim();
 const clipMeta={shot_id:selected?.shot_id||null,actor:selected?.speaker||"ensemble",prompt};
 if(prompt.length<15){status("وصف الحركة قصير جدًا.",true);return}
 busy=true;$("submit").disabled=true;$("result").replaceChildren();
 status("جاري الاتصال بخدمة GPU المشتركة... قد يكون هناك طابور.");
 try{
   // Load Gradio's API client only when the user explicitly starts an external render.
   const {Client,handle_file}=await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
   const app=await Client.connect(ID, {events:["data","status"]});
   const args=[
      handle_file(file), prompt, 4,
      "face distortion, changed character, extra people, duplicate faces, captions, watermark, jitter",
      1.5, 1, 1, Number(selected?.seed||404), false
   ];
   const job=app.submit("/generate_video",args);
   let completed=false;
   for await(const message of job){
      if(message.type==="status"){
        if(message.stage==="error")throw Error("الخدمة أبلغت عن مشكلة أو نفاد الحصة المجانية.");
        if(message.position!=null)status("في انتظار دور GPU المجانية؛ ترتيب الطابور: "+message.position);
        else status("الخدمة بتحاول توليد الفيديو على GPU...");
      }else if(message.type==="data"){
        const video=safeVideo(message);
        const player=el("video");
        player.controls=true;player.playsInline=true;player.preload="metadata";player.src=video;
        const link=el("a","فتح وتنزيل ملف الفيديو الناتج");link.href=video;link.target="_blank";link.rel="noopener noreferrer";
        $("result").replaceChildren(player,link);
        completed=true;
        status("الفيديو اتولد، جاري حفظ الملف داخل مكتبتك على الموبايل...");
        try{
          const saved=await globalThis.Studio404Vault.saveRemote(video,clipMeta);
          await globalThis.Studio404Vault.requestPersistence();
          const gallery=el("a","✅ الفيديو محفوظ — افتح مكتبة فيديوهاتي");
          gallery.href="./library.html";
          $("result").append(gallery);
          status("✅ الفيديو محفوظ فعليًا في مكتبتك على الجهاز. نزّل نسخة احتياطية لحمايته من حذف بيانات المتصفح.");
        }catch(storeError){
          const gallery=el("a","افتح المكتبة لاستيراد الفيديو بعد تنزيله");
          gallery.href="./library.html?shot="+encodeURIComponent(clipMeta.shot_id||"")+
            "&actor="+encodeURIComponent(clipMeta.actor);
          $("result").append(gallery);
          status("الفيديو اتولد لكن ما اتحفظش تلقائيًا: "+storeError.message+
            ". افتح رابط الفيديو واحفظه في Downloads، ثم استورده في مكتبة فيديوهاتي.",true);
        }
      }
   }
   if(!completed)throw Error("المهمة انتهت من غير فيديو. ممكن تكون الحصة المجانية انتهت.");
 }catch(error){
   status("التوليد مش متاح من داخل التطبيق حاليًا: "+(error?.message||"اتصال فشل")+". جرّب رابط الخدمة الخارجية أسفل الصفحة.",true);
 }finally{busy=false;$("submit").disabled=false}
}
async function boot(){
 try{
  const response=await fetch("./data/scene.json");
  if(!response.ok)throw Error("ملف المشاهد مش متاح");
  const data=await response.json();
  shots=data.shots||[];
  if(shots.length!==16)throw Error("السيناريو مش مكتمل");
  const picker=$("scene");
  for(const sh of shots){const option=el("option",sh.shot_id.toUpperCase()+" · "+(sh.speaker||"الحارة")+" · "+sh.duration_seconds+"ث");option.value=sh.shot_id;picker.append(option)}
  picker.value="sh05";selectScene(picker.value);
  picker.addEventListener("change",()=>selectScene(picker.value));
 }catch(err){status("تعذّر تحميل السيناريو: "+err.message,true);$("submit").disabled=true}
 $("reference").addEventListener("change",()=>{
   if(previewUrl)URL.revokeObjectURL(previewUrl);
   previewUrl=null;
   const file=$("reference").files?.[0],preview=$("photoPreview");
   if(!validPhoto(file)){preview.style.display="none";return}
   previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.style.display="block";
 });
 $("submit").addEventListener("click",submit);
 $("copyPrompt").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText($("prompt").value);status("تم نسخ الوصف؛ الصقه في خدمة GPU الخارجية.")}
  catch{const text=$("prompt");text.focus();text.select();status("حدّد وصف الحركة واضغط نسخ من الموبايل.")}
 });
}
document.addEventListener("DOMContentLoaded",boot);
})();
