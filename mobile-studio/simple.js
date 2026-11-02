"use strict";
// Simple 404 Studio owner workspace. Two screens: locally saved characters and blank video generation.
// No paid keys, no fake login. External image/video transfer only after explicit opt-in.
(() => {
const SPACE_ID="zerogpu-aoti/wan2-2-fp8da-aoti-faster";
const SPACE_HOST="https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space";
const $=id=>document.getElementById(id);
const store=()=>globalThis.Studio404Characters;
const vault=()=>globalThis.Studio404Vault;
const make=(tag,value)=>{const el=document.createElement(tag);if(value!==undefined)el.textContent=value;return el};
let characters=[],selectedId="LAYLA",busy=false,thumbUrls=[],previewUrl=null;
function message(id,text,bad=false){const el=$(id);el.textContent=text;el.style.color=bad?"#ffb2a6":"#a7b5ca"}
function releaseThumbnails(){for(const url of thumbUrls)URL.revokeObjectURL(url);thumbUrls=[]}
function releasePreview(){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}}
function imageUrl(blob){const url=URL.createObjectURL(blob);thumbUrls.push(url);return url}
function switchTo(tab){
 const cast=tab!=="generate";
 $("charactersView").hidden=!cast;$("generateView").hidden=cast;
 $("tab-characters").classList.toggle("active",cast);
 $("tab-generate").classList.toggle("active",!cast);
 $("tab-characters").setAttribute("aria-selected",String(cast));
 $("tab-generate").setAttribute("aria-selected",String(!cast));
 if(!cast)loadVideoChoices();
}
async function readCharacters(){characters=await store().all();return characters}
function findCharacter(id){return characters.find(c=>c.id===id)}
function cardList(){
 releaseThumbnails();
 const box=$("characterCards");box.replaceChildren();
 for(const c of characters){
  const button=make("button");button.type="button";button.className="person"+(selectedId===c.id?" active":"");
  button.setAttribute("aria-label","تعديل شخصية "+c.name);
  button.setAttribute("aria-pressed",String(selectedId===c.id));
  const image=make("span");image.className="photo";
  if(c.image){
   const img=make("img");img.src=imageUrl(c.image);img.alt="صورة "+c.name;img.loading="lazy";image.append(img);
  }else image.append(make("span","👤"));
  button.append(image,make("strong",c.name),make("small",c.image?"الصورة محفوظة":"أضف الصورة"));
  button.addEventListener("click",()=>selectCharacter(c.id));
  box.append(button);
 }
}
function currentImage(){
 releasePreview();
 const img=$("characterPreview"),chosen=$("characterImage").files?.[0],previous=findCharacter(selectedId);
 const blob=chosen||previous?.image;
 if(blob){previewUrl=URL.createObjectURL(blob);img.src=previewUrl;img.hidden=false}
 else{img.removeAttribute("src");img.hidden=true}
}
function selectCharacter(id){
 selectedId=id;
 const item=findCharacter(id);
 $("characterName").value=item?.name||"";
 $("characterImage").value="";
 $("editTitle").textContent=item?"تعديل "+item.name:"إضافة شخصية";
 $("removeCharacter").hidden=!item;
 cardList();currentImage();
 message("castStatus",item?.image?"صورة الشخصية محفوظة على جهازك.":"اختار صورة الشخصية واضغط حفظ.");
}
async function saveCharacter(){
 const name=$("characterName").value.trim(),chosen=$("characterImage").files?.[0]||null;
 const current=findCharacter(selectedId);
 if(!chosen&&!current?.image){message("castStatus","اختار صورة للشخصية الأول.",true);return}
 if(chosen&&current?.image&&!confirm("هل تريد تغيير الصورة المرجعية المحفوظة لشخصية "+current.name+"؟"))return;
 $("saveCharacter").disabled=true;
 try{
  const saved=await store().save({id:selectedId,name,image:chosen});
  await readCharacters();selectCharacter(saved.id);
  message("castStatus","✅ اتحفظت "+saved.name+" بصورتها. هتلاقيها لما تفتح الاستوديو تاني.");
 }catch(e){message("castStatus",e.message||"تعذر حفظ الشخصية",true)}
 finally{$("saveCharacter").disabled=false}
}
async function removeCharacter(){
 const current=findCharacter(selectedId);
 if(!current)return;
 if(!confirm("هل تريد حذف صورة "+current.name+" المحفوظة؟ الفيديوهات القديمة لن تُحذف."))return;
 try{
  await store().remove(current.id);await readCharacters();
  selectCharacter(characters[0]?.id||null);
  message("castStatus","اتمسحت الصورة المحددة. الفيديوهات اللي سبق توليدها محفوظة في المكتبة.");
 }catch(e){message("castStatus",e.message,true)}
}
function loadVideoChoices(){
 const select=$("videoCharacter"),previous=select.value||selectedId;
 select.replaceChildren();
 for(const c of characters){
  const option=make("option",c.name+(c.image?"":" — صورة ناقصة"));option.value=c.id;select.append(option);
 }
 if(findCharacter(previous))select.value=previous;
 else if(findCharacter(selectedId))select.value=selectedId;
}
function safeVideo(result){
 let value=result?.data?.[0];
 if(Array.isArray(value))value=value[0];
 if(value?.video)value=value.video;
 const raw=typeof value==="string"?value:value?.url;
 if(!raw||typeof raw!=="string")throw Error("الخدمة لم ترجع ملف فيديو قابل للتشغيل");
 const url=new globalThis.URL(raw,SPACE_HOST);
 if(url.protocol!=="https:"||!(url.hostname==="huggingface.co"||url.hostname.endsWith(".hf.space")))
   throw Error("عنوان الفيديو غير آمن");
 return url.href;
}
async function generate(){
 if(busy)return;
 const char=findCharacter($("videoCharacter").value);
 if(!char?.image){message("status","لازم تختار شخصية محفوظة بصورتها من «شخصياتي» الأول.",true);return}
 const prompt=$("videoPrompt").value.trim();
 if(prompt.length<12){message("status","اكتب وصف الحركة اللي عايزها في الفيديو (12 حرف على الأقل).",true);return}
 if(!$("permission").checked){message("status","وافق الأول على إرسال صورة الشخصية ووصف الفيديو للخدمة المجانية.",true);return}
 busy=true;$("generateVideo").disabled=true;$("result").replaceChildren();
 message("status","جارٍ الاتصال بمحرك الفيديو المجاني...");
 try{
  const {Client,handle_file}=await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
  const api=await Client.connect(SPACE_ID,{events:["data","status"]});
  const ext=char.image.type==="image/jpeg"?"jpg":char.image.type==="image/webp"?"webp":"png";
  const file=new File([char.image],char.id+"."+ext,{type:char.image.type||"image/png"});
  const args=[handle_file(file),prompt,4,
   "changed character, different face, extra people, subtitles, watermark, flicker",
   1.5,1,1,404,false];
  const job=api.submit("/generate_video",args);
  let completed=false;
  for await(const event of job){
   if(event.type==="status"){
    if(event.stage==="error")throw Error("خدمة الفيديو رفضت الطلب أو خلصت الحصة المجانية");
    message("status",event.position!=null?
      "في انتظار دورك على GPU المجانية. ترتيب الطابور: "+event.position:
      "جاري تجهيز الفيديو على GPU المجانية...");
   }else if(event.type==="data"){
    const src=safeVideo(event);
    const player=make("video");player.controls=true;player.playsInline=true;player.preload="metadata";player.src=src;
    const download=make("a","فتح وتنزيل الفيديو");download.href=src;download.target="_blank";download.rel="noopener noreferrer";
    $("result").replaceChildren(player,download);
    completed=true;
    message("status","✅ الفيديو اتولد. جاري حفظه في مكتبتك...");
    try{
      await vault().saveRemote(src,{actor:char.id,prompt,source:"zerogpu"});
      await vault().requestPersistence();
      const link=make("a","✅ الفيديو اتحفظ — فتح فيديوهاتي");link.href="./library.html";$("result").append(link);
      message("status","✅ الفيديو محفوظ على نفس الموبايل والمتصفح. نزّل نسخة احتياطية من المكتبة.");
    }catch(saveError){
      const link=make("a","فتح المكتبة لإضافة الفيديو بعد تنزيله");link.href="./library.html";$("result").append(link);
      message("status","الفيديو اتولد، لكن الحفظ التلقائي مش مسموح من الخدمة. افتح «تنزيل الفيديو» واحفظه، وبعدها أضفه من المكتبة.",true);
    }
   }
  }
  if(!completed)throw Error("الخدمة أنهت المهمة بدون فيديو");
 }catch(e){
  message("status","التوليد المجاني مش متاح حاليًا: "+(e.message||"خطأ اتصال")+
   ". الشخصيات المحفوظة ما اتغيرتش.",true);
 }finally{busy=false;$("generateVideo").disabled=false}
}
async function boot(){
 $("tab-characters").addEventListener("click",()=>switchTo("characters"));
 $("tab-generate").addEventListener("click",()=>switchTo("generate"));
 $("newCharacter").addEventListener("click",()=>selectCharacter(null));
 $("characterImage").addEventListener("change",currentImage);
 $("saveCharacter").addEventListener("click",saveCharacter);
 $("removeCharacter").addEventListener("click",removeCharacter);
 $("generateVideo").addEventListener("click",generate);
 try{
  await readCharacters();selectCharacter(characters[0]?.id||null);loadVideoChoices();
 }catch(e){message("castStatus","تعذر فتح مكتبة الشخصيات على المتصفح: "+e.message,true)}
 if("serviceWorker" in navigator&&location.protocol==="https:")
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
window.addEventListener("pagehide",()=>{releaseThumbnails();releasePreview()});
document.addEventListener("DOMContentLoaded",boot);
})();
