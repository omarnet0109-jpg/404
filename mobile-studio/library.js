"use strict";
(() => {
const $=id=>document.getElementById(id);
const vault=()=>globalThis.Studio404Vault;
const labels={LAYLA:"ليلى",WIDAD:"الحاجة وداد",SABER:"عم صابر",ensemble:"الحارة"};
let previewUrl=null,audioPreviewUrl=null,activePreviewId=null,dialogues=[];
function message(value,error=false){$("status").textContent=value;$("status").style.color=error?"#ffb6ad":"#a9bbd2"}
function make(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function bytes(n){return n>1048576?(n/1048576).toFixed(1)+" MB":(n/1024).toFixed(0)+" KB"}
function stopPreview(){
 if(previewUrl){globalThis.URL.revokeObjectURL(previewUrl);previewUrl=null}
 if(audioPreviewUrl){globalThis.URL.revokeObjectURL(audioPreviewUrl);audioPreviewUrl=null}
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
   const edit=make("a","🎙️ أضف صوت / مونتاج","btn alt");edit.href="./episode-editor.html?video="+encodeURIComponent(item.id);
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
     const attached=await globalThis.Studio404ClipAudio.get(item.id);
     const legacy=(!attached&&item.shot_id&&["LAYLA","WIDAD","SABER"].includes(item.actor))?
       await globalThis.Studio404AudioVault.get(item.actor,item.shot_id):null;
     const voice=attached||legacy;
     if(voice?.file){
       audioPreviewUrl=globalThis.URL.createObjectURL(voice.file);
       const description=make("p","🎙️ ملف صوت مرتبط بالفيديو، تقدر تسمعه هنا. ده مش مزامنة شفايف.","muted");
       const sound=make("audio");sound.controls=true;sound.preload="metadata";sound.src=audioPreviewUrl;sound.style.width="100%";
       videoBox.append(description,sound);
     }
    }catch(e){message(e.message,true)}
   });
   download.addEventListener("click",async()=>{
    try{const saved=await vault().get(item.id);vault().download(saved);message("بدأ تنزيل نسخة احتياطية من "+saved.name)}
    catch(e){message(e.message,true)}
   });
   del.addEventListener("click",async()=>{
    if(!confirm("حذف الفيديو "+item.name+" من مكتبة هذا الموبايل؟ لا يمكن استرجاعه من المكتبة."))return;
    try{await vault().remove(item.id);await globalThis.Studio404ClipAudio.remove(item.id);message("تم حذف الفيديو وصوته المرتبط من المكتبة");await render()}
    catch(e){message(e.message,true)}
   });
   actions.append(play,download,edit,del);card.append(actions,videoBox);items.append(card);
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
function shotOptions(){
 const actor=$("audioActor").value,select=$("audioShot");
 const previous=select.value;
 select.replaceChildren();
 for(const line of dialogues.filter(x=>x.speaker===actor)){
   const option=make("option",line.shot_id.toUpperCase()+" · "+line.text.slice(0,25));
   option.value=line.shot_id;select.append(option);
 }
 if([...select.options].some(o=>o.value===previous))select.value=previous;
}
async function refreshAudios(){
 const list=$("audios");list.replaceChildren();
 try{
   const rows=await globalThis.Studio404AudioVault.list();
   if(!rows.length){list.append(make("p","لسه مفيش أصوات محفوظة. ولّد جملة في استوديو الأصوات أو استورد WAV.","muted"));return}
   for(const row of rows){
     const section=make("section",undefined,"library-item");
     section.append(make("strong",(labels[row.actor]||row.actor)+" · "+row.shot.toUpperCase()));
     const controls=make("div",undefined,"buttons");
     const play=make("button","▶ استماع","btn alt");
     const download=make("button","↓ نسخة WAV","btn alt");
     const del=make("button","حذف الصوت","btn danger");
     const holder=make("div");
     play.addEventListener("click",async()=>{
       try{
         const clip=await globalThis.Studio404AudioVault.get(row.actor,row.shot);
         if(audioPreviewUrl)globalThis.URL.revokeObjectURL(audioPreviewUrl);
         audioPreviewUrl=globalThis.URL.createObjectURL(clip.file);
         const player=make("audio");player.src=audioPreviewUrl;player.controls=true;player.style.width="100%";
         holder.replaceChildren(player);
       }catch(e){message(e.message,true)}
     });
     download.addEventListener("click",async()=>{
       try{
         const item=await globalThis.Studio404AudioVault.get(row.actor,row.shot);
         const uri=globalThis.URL.createObjectURL(item.file),link=make("a");
         link.href=uri;link.download=item.name||row.actor+"-"+row.shot+".wav";
         document.body.append(link);link.click();link.remove();
         setTimeout(()=>globalThis.URL.revokeObjectURL(uri),60000);
       }catch(e){message(e.message,true)}
     });
     del.addEventListener("click",async()=>{
       if(!confirm("هل تحذف صوت "+labels[row.actor]+" لهذه اللقطة؟"))return;
       try{await globalThis.Studio404AudioVault.remove(row.actor,row.shot);await refreshAudios()}
       catch(e){message(e.message,true)}
     });
     controls.append(play,download,del);section.append(controls,holder);list.append(section);
   }
 }catch(e){message("فشل عرض الأصوات المحفوظة: "+e.message,true)}
}
async function importAudio(){
 const file=$("importAudio").files?.[0],actor=$("audioActor").value,shot=$("audioShot").value;
 if(!file){message("اختار ملف WAV أو MP3 الأول.",true);return}
 if(!shot){message("الشخصية دي مالهاش لقطة كلام محددة.",true);return}
 $("saveAudio").disabled=true;
 try{
   await globalThis.Studio404AudioVault.save(file,actor,shot,"imported-owned-file");
   $("importAudio").value="";message("✅ الصوت اتحفظ لنفس الشخصية واللقطة على هذا الموبايل.");
   await refreshAudios();
 }catch(e){message(e.message,true)}
 finally{$("saveAudio").disabled=false}
}
async function boot(){
 try{for(const c of await globalThis.Studio404Characters.all())labels[c.id]=c.name}catch{}
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
 try{
   const res=await fetch("./data/dialogue.json",{cache:"force-cache"});
   if(res.ok)dialogues=(await res.json()).dialogue_only||[];
 }catch{}
 if(["LAYLA","WIDAD","SABER"].includes(actor))$("audioActor").value=actor;
 shotOptions();
 if([...$("audioShot").options].some(o=>o.value===preferred))$("audioShot").value=preferred;
 $("audioActor").addEventListener("change",shotOptions);
 $("saveAudio").addEventListener("click",importAudio);
 $("saveImport").addEventListener("click",importVideo);
 $("persist").addEventListener("click",async()=>{
  const ok=await vault().requestPersistence();
  message(ok?"✅ المتصفح وافق يحاول يحتفظ بملفات المكتبة. نزّل نسخة احتياطية برضه.":
   "المتصفح لم يوافق على ضمان التخزين. استخدم «تنزيل نسخة MP4» لكل فيديو لحمايته.");
 });
 await render();
 await refreshAudios();
}
window.addEventListener("pagehide",stopPreview);
document.addEventListener("DOMContentLoaded",boot);
})();