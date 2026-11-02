"use strict";
(() => {
const $=id=>document.getElementById(id);
const vault=()=>globalThis.Studio404Vault;
const labels={LAYLA:"ليلى",WIDAD:"الحاجة وداد",SABER:"عم صابر",ensemble:"الحارة"};
let previewUrl=null,activePreviewId=null;
function message(value,error=false){$("status").textContent=value;$("status").style.color=error?"#ffb6ad":"#a9bbd2"}
function make(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function bytes(n){return n>1048576?(n/1048576).toFixed(1)+" MB":(n/1024).toFixed(0)+" KB"}
function stopPreview(){
 if(previewUrl){globalThis.URL.revokeObjectURL(previewUrl);previewUrl=null}
 activePreviewId=null;
}
async function capacity(){
 const est=await vault().estimate();
 if(!est){$("capacity").textContent="تخزين الجهاز متاح، لكن المتصفح مش بيعرض مساحة واضحة.";return}
 $("capacity").textContent="المستخدم من مساحة المتصفح: "+bytes(est.usage||0)+
  " / الحد التقديري: "+bytes(est.quota||0)+". احتفظ بنسخة MP4 خارج التطبيق.";
}
async function render(){
 stopPreview();
 const items=$("items");items.replaceChildren();
 try{
  const rows=await vault().list();
  $("count").textContent=rows.length+" فيديو";
  $("empty").hidden=rows.length!==0;
  for(const item of rows){
   const card=make("article",undefined,"library-item");
   const head=make("div",undefined,"item-head");
   head.append(make("strong",(item.shot_id||"فيديو")+" · "+(labels[item.actor]||"الحارة")),
     make("small",new Date(item.created_at).toLocaleString("ar-EG")));
   card.append(head,make("p",item.name+" · "+bytes(item.size),"muted"));
   const actions=make("div",undefined,"buttons");
   const play=make("button","▶ مشاهدة","btn alt");
   play.type="button";
   const download=make("button","↓ تنزيل نسخة MP4","btn");
   download.type="button";
   const del=make("button","حذف","btn danger");del.type="button";
   const videoBox=make("div");
   play.addEventListener("click",async()=>{
    try{
     const saved=await vault().get(item.id);
     if(!saved?.video)throw Error("الملف مش موجود في قاعدة التخزين");
     stopPreview();
     previewUrl=globalThis.URL.createObjectURL(saved.video);
     const player=make("video");player.controls=true;player.playsInline=true;player.preload="metadata";player.src=previewUrl;
     document.querySelectorAll(".library-item video").forEach(v=>v.remove());
     videoBox.replaceChildren(player);activePreviewId=item.id;
    }catch(e){message(e.message,true)}
   });
   download.addEventListener("click",async()=>{
    try{const saved=await vault().get(item.id);vault().download(saved);message("بدأ تنزيل نسخة احتياطية من "+saved.name)}
    catch(e){message(e.message,true)}
   });
   del.addEventListener("click",async()=>{
    if(!confirm("حذف الفيديو ""+item.name+"" من مكتبة هذا الموبايل؟ لا يمكن استرجاعه من المكتبة."))return;
    try{await vault().remove(item.id);message("تم حذف الفيديو من المكتبة");await render()}
    catch(e){message(e.message,true)}
   });
   actions.append(play,download,del);card.append(actions,videoBox);items.append(card);
  }
  await capacity();
 }catch(e){message("تعذّر فتح مكتبة الفيديوهات: "+e.message,true)}
}
async function importVideo(){
 const file=$("importVideo").files?.[0];
 if(!file){message("اختار ملف الفيديو من التنزيلات الأول.",true);return}
 $("saveImport").disabled=true;message("جارٍ حفظ ملف الفيديو الحقيقي على هذا الموبايل...");
 try{
  const item=await vault().saveFile(file,{
   shot_id:$("importShot").value||null,actor:$("importActor").value,source:"local-import"
  });
  $("importVideo").value="";
  message("✅ اتحفظ الفيديو "+item.name+" داخل مكتبتك. نزّل نسخة احتياطية منه احتياطًا.");
  await render();
 }catch(e){message("فشل حفظ الفيديو: "+e.message,true)}
 finally{$("saveImport").disabled=false}
}
async function boot(){
 const query=new URLSearchParams(location.search);
 const preferred=query.get("shot"),actor=query.get("actor");
 const select=$("importShot");
 const no=make("option","بدون رقم");no.value="";select.append(no);
 for(let i=1;i<=16;i++){
  const id="sh"+String(i).padStart(2,"0"),opt=make("option",id.toUpperCase());
  opt.value=id;select.append(opt);
 }
 if(/^sh(0[1-9]|1[0-6])$/.test(preferred||""))select.value=preferred;
 if(Object.keys(labels).includes(actor))$("importActor").value=actor;
 $("saveImport").addEventListener("click",importVideo);
 $("persist").addEventListener("click",async()=>{
  const ok=await vault().requestPersistence();
  message(ok?"✅ المتصفح وافق يحاول يحتفظ بملفات المكتبة. نزّل نسخة احتياطية برضه.":
   "المتصفح لم يوافق على ضمان التخزين. استخدم «تنزيل نسخة MP4» لكل فيديو لحمايته.");
 });
 await render();
}
window.addEventListener("pagehide",stopPreview);
document.addEventListener("DOMContentLoaded",boot);
})();