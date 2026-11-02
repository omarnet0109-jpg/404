"use strict";
(() => {
const $ = id => document.getElementById(id);
const LABEL = {LAYLA:"ليلى",WIDAD:"الحاجة وداد",SABER:"عم صابر",ensemble:"الحارة والمجموعة"};
const KEYS = {drafts:"studio404.drafts.v1",backend:"studio404.backend",token:"studio404.token",refs:"studio404.references.v1"};
let scene=null, bible=null, dialogue=null, drafts={}, refs={}, selected=null, editId=null, pendingInstall=null, polling=null, outputUrl=null, engineReady=false;
const readJSON = (key, fallback={}) => { try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback} };
const saveJSON = (key,obj) => {try{localStorage.setItem(key,JSON.stringify(obj))}catch{toast("تعذر حفظ المسودة على الجهاز")} };
const clean = value => (value??"").toString();
const ui = (tag,cls,text) => {const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=clean(text);return n};
let toastTimer;
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),4200)}
function show(view){document.querySelectorAll(".view").forEach(e=>e.classList.toggle("active",e.id==="view-"+view));document.querySelectorAll(".tab").forEach(e=>{const selected=e.dataset.target===view;e.classList.toggle("active",selected);e.setAttribute("aria-current",selected?"page":"false")});window.scrollTo({top:0,behavior:"instant"})}
function dialogueText(s){return s.dialogue_ar?.trim()||"بدون حوار"}
function promptFor(s){return drafts[s.shot_id]??s.prompt_en}
function shotLabel(s){return s.shot_id.toUpperCase()+"  ·  "+s.start_seconds+"–"+s.end_seconds+" ثانية"}
function populateShots(){
 const list=$("shotsList");list.replaceChildren();$("renderShot").replaceChildren();
 for(const s of scene.shots){
  const card=ui("article","shot-card"+(s.speaker?" dialogue":""));
  const top=ui("div","shot-top");top.append(ui("span","shot-num",s.shot_id.toUpperCase()),ui("span","timecode",String(s.start_seconds).padStart(2,"0")+":00 – "+String(s.end_seconds).padStart(2,"0")+":00"));card.append(top);
  card.append(ui("h3","",s.speaker?"حوار "+LABEL[s.speaker]:"لقطة بدون كلام"));
  if(s.dialogue_ar)card.append(ui("blockquote","",s.dialogue_ar));
  card.append(ui("p","",clean(s.description_ar).slice(0,190)));
  const foot=ui("div","shot-footer");foot.append(ui("span","pill",(s.end_seconds-s.start_seconds)+" ثواني"));
  const b=ui("button","",drafts[s.shot_id]?"تعديل المسودة ✎":"تحرير ✎");b.type="button";b.addEventListener("click",()=>editShot(s.shot_id));foot.append(b);card.append(foot);list.append(card);
  const opt=ui("option","",s.shot_id.toUpperCase()+" · "+(s.speaker?LABEL[s.speaker]:"صامت")+" · "+(s.end_seconds-s.start_seconds)+"ث");opt.value=s.shot_id;$("renderShot").append(opt);
 }
 if(!selected||!scene.shots.some(s=>s.shot_id===selected))selected=scene.shots[0].shot_id;
 $("renderShot").value=selected;selectShot(selected);
}
function populateCast(){
 const cast=$("castList");cast.replaceChildren();
 for(const key of ["LAYLA","WIDAD","SABER"]){
  const c=bible.characters[key],article=ui("article","cast-card");
  article.append(ui("div","cast-avatar",key==="LAYLA"?"ل":key==="WIDAD"?"و":"ص"));
  const text=ui("div","");text.append(ui("div","cast-role",key+"  •  "+c.age+" سنة"),ui("h3","",c.name_ar));
  text.append(ui("p","",key==="LAYLA"?"جاكيت جينز • أوراق قديمة":key==="WIDAD"?"شال داكن مزخرف • نبرة حازمة":"جلباب بيج • كارديجان بني • طاقية"));
  text.append(ui("p","",c.voice));article.append(text);cast.append(article);
 }
}
function editShot(id){editId=id;const s=scene.shots.find(x=>x.shot_id===id);if(!s)return;$("editDialogTitle").textContent=id.toUpperCase()+" — تحرير اللقطة";$("editPrompt").value=promptFor(s);$("editDialog").showModal()}
function selectShot(id){selected=id;const s=scene.shots.find(x=>x.shot_id===id);if(!s)return;$("renderPrompt").value=promptFor(s);$("referenceType").value=s.speaker||"ensemble";updateRefState()}
function updateRefState(){const kind=$("referenceType").value;const asset=refs[kind];$("referenceStatus").textContent=!engineReady?"المحرك غير متصل — الرفع متوقف":asset?"مرجع تم رفعه مسبقًا (قد تحتاج إلى إعادة الرفع)":"المرجع لم يُرفع بعد"}
function serverInfo(){const base=$("serverUrl").value.trim().replace(/\/+$/,"");const token=$("serverToken").value; if(!base)throw Error("أضف عنوان خادم الاستوديو من الإعدادات أولًا");let url;try{url=new URL(base)}catch{throw Error("عنوان الخادم غير صحيح")};if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))throw Error("لا يمكن إرسال المفتاح عبر HTTP غير آمن. استخدم HTTPS");if(!token)throw Error("أضف مفتاح دخول خادم الاستوديو");return {base:url.href.replace(/\/$/,""),token}}
async function request(path,init={}){
 const {base,token}=serverInfo(),controller=new AbortController(),time=setTimeout(()=>controller.abort(),45000);
 const headers={"Authorization":"Bearer "+token,...(init.headers||{})};
 try{const response=await fetch(base+path,{...init,headers,signal:controller.signal});if(!response.ok){let description="";try{const body=await response.json();description=body.detail||body.error||""}catch{}throw Error("خطأ "+response.status+": "+(typeof description==="string"?description:JSON.stringify(description)))}return response}finally{clearTimeout(time)}
}
function log(s){$("productionLog").textContent=s}
function updateOnline(online,description){
 engineReady=Boolean(online);
 $("stateDot").classList.toggle("online",engineReady);
 $("connectionLabel").textContent=engineReady?"المحرك متصل":"المحرك غير متصل";
 $("uploadButton").disabled=!engineReady;
 $("renderButton").disabled=!engineReady;
 $("referenceFile").disabled=!engineReady;
 $("uploadButton").title=engineReady?"رفع المرجع الأصلي إلى المحرك":"التوليد يحتاج اتصال GPU وWorkflow صالحين أولًا";
 $("renderButton").title=engineReady?"بدء توليد لقطة حقيقية":"التوليد يحتاج اتصال GPU وWorkflow صالحين أولًا";
 $("engineStateTitle").textContent=engineReady?"المحرك متصل وجاهز لاختبار التوليد":"محرك الفيديو غير متصل حاليًا";
 $("engineStateMessage").textContent=engineReady
  ?"تقدر الآن ترفع صورة مرجعية أصلية وتجرب توليد لقطة. راجع جودة النتيجة بنفسك قبل اعتمادها."
  :"اختيار صورة من الموبايل لا يولّد فيديو. ما فيش خادم GPU متصل لحد دلوقتي؛ مش مطلوب منك ترفع صورة أو تدفع اشتراك الآن. تجهيز محرّك ComfyUI المجاني يتطلب معالجة GPU منفصلة.";
 $("simpleEngineTitle").textContent=engineReady?"حالة توليد الفيديو: جاهز للاختبار":"حالة توليد الفيديو: غير متصل";
 $("simpleEngineMessage").textContent=engineReady?"تم التحقق من ComfyUI وWorkflow والعقد وملفات النموذج. النتيجة تظل لقطة اختبار حتى تراجع الهوية والصوت والشفايف.":"دي مش بيانات ناقصة منك. لسه ما فيش سيرفر GPU مجاني جاهز للمشروع، ومش مطلوب منك تكتب عنوان أو مفتاح أو تدفع حاجة.";
 if(description)$("productionState").textContent=description;
 updateRefState();
}
async function checkServer(){
 $("checkButton").disabled=true;
 try{const r=await request("/api/health");const data=await r.json();const ready=!!data.video_ready;let reason="وصلنا للخادم، لكن محرك ComfyUI أو قالب الفيديو غير جاهز.";if(data.workflow_status==="missing")reason="الخادم متصل، لكن ملف Workflow بصيغة API غير موجود.";else if(data.workflow_status==="invalid")reason="الخادم متصل، لكن ملف Workflow غير صالح للتوليد.";else if(data.workflow_status==="nodes_missing")reason="الخادم متصل، لكن عقد النموذج المطلوبة غير مثبتة في ComfyUI.";else if(data.workflow_status==="models_missing")reason="الخادم متصل، لكن ملفات نموذج الفيديو المطلوبة غير موجودة.";else if(!data.comfyui_connected)reason="الخادم متاح، لكن ComfyUI غير متصل.";updateOnline(ready,ready?"محرك الفيديو وWorkflow والعقد وملفات النموذج جاهزة لاختبار لقطة حقيقية.":reason);toast(ready?"تم الاتصال بمحرك التوليد":"الخادم متاح، لكن التوليد غير جاهز");return ready}
 catch(err){updateOnline(false,"ملفات المشروع جاهزة، لكن محرك توليد الفيديو غير متصل.");toast(err.message);return false}
 finally{$("checkButton").disabled=false}
}
async function upload(){
 if(!engineReady){toast("توليد الفيديو والرفع متوقفان لعدم وجود خادم GPU متصل");return}
 const file=$("referenceFile").files[0];
 if(!file){toast("اختار صورة الشخصية أو الحارة من هاتفك");return}
 if(file.size>15*1024*1024){toast("حجم الصورة يجب ألا يزيد عن 15MB");return}
 const kind=$("referenceType").value;$("uploadButton").disabled=true;log("جارٍ رفع "+LABEL[kind]+"...");
 try{const body=new FormData();body.append("image",file,file.name);body.append("reference_type",kind);const res=await request("/api/assets",{method:"POST",body});const data=await res.json();refs[kind]=data.asset_id;saveJSON(KEYS.refs,refs);updateRefState();toast("تم رفع المرجع لمحرك التوليد");log("تم رفع "+LABEL[kind]+" بنجاح")}
 catch(e){log(e.message);toast("تعذر رفع الصورة المرجعية")}
 finally{$("uploadButton").disabled=!engineReady}
}
async function render(){
 if(!engineReady){toast("المحرك غير متصل. لا يمكن توليد فيديو حقيقي الآن");return}
 const s=scene.shots.find(x=>x.shot_id===selected);if(!s)return;
 const ref=refs[$("referenceType").value];
 if(!ref){toast("ارفع صورة مرجعية أولًا للحفاظ على الشخصية");return}
 const prompt=$("renderPrompt").value.trim();if(!prompt){toast("وصف اللقطة مطلوب");return}
 $("renderButton").disabled=true;log("جارٍ إرسال الطلب لمحرك الفيديو...");
 try{
  const body={shot_id:s.shot_id,prompt,negative_prompt:s.negative_prompt||"",frames:Math.max(1,Math.round(s.duration_seconds*24)),seed:s.seed||404,reference_asset_id:ref};
  const response=await request("/api/render",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();$("jobPanel").classList.remove("hidden");$("jobStatus").textContent="قيد التنفيذ";$("jobDescription").textContent="تم تسجيل اللقطة "+s.shot_id+" في قائمة ComfyUI";$("jobOutput").replaceChildren();log("تم إرسال المهمة: "+data.job_id);if(polling)clearTimeout(polling);pollJob(data.job_id);
 }catch(e){log(e.message);toast("لم تبدأ عملية توليد: "+e.message)}
 finally{$("renderButton").disabled=!engineReady}
}
async function pollJob(jobId){
 try{const response=await request("/api/jobs/"+encodeURIComponent(jobId));const data=await response.json();$("jobStatus").textContent=data.status==="complete"?"اكتمل":data.status==="failed"?"فشل":"جارٍ التوليد";
  $("jobDescription").textContent=data.message||("حالة المهمة: "+data.status);
  if(data.status==="complete"){
   if(!data.videos?.length){log("اكتملت المهمة لكن لم يخرج ملف فيديو. راجع ComfyUI.");return}
   if(outputUrl)URL.revokeObjectURL(outputUrl);
   const videoResponse=await request("/api/jobs/"+encodeURIComponent(jobId)+"/video/0");
   outputUrl=URL.createObjectURL(await videoResponse.blob());const video=ui("video");video.controls=true;video.playsInline=true;video.src=outputUrl;$("jobOutput").replaceChildren(video);
   const link=ui("a","outline-btn","تنزيل نتيجة اللقطة ↧");link.href=outputUrl;link.download=selected+"-video.mp4";link.style.display="inline-block";link.style.marginTop="12px";$("jobOutput").append(link);
   log("اكتمل توليد الفيديو. راجع ملامح الشخصية والمشهد والصوت بنفسك؛ هذا لا يؤكد مزامنة الشفايف.");return;
  }
  if(data.status==="failed"){log(data.message||"فشل المحرك");return}
  polling=setTimeout(()=>pollJob(jobId),6000);
 }catch(e){log("فشل تحديث الحالة: "+e.message)}
}
function exportScene(){
 const snapshot={...scene,shots:scene.shots.map(s=>({...s,prompt_en:promptFor(s)})),exported_at:new Date().toISOString(),local_draft:true};
 const file=new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(file);
 const a=document.createElement("a");a.href=url;a.download="404-episode01-draft.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),600);
}
function bind(){
 document.querySelectorAll("[data-target],[data-open]").forEach(btn=>btn.addEventListener("click",()=>show(btn.dataset.target||btn.dataset.open)));
 $("renderShot").addEventListener("change",e=>selectShot(e.target.value));
 $("referenceType").addEventListener("change",updateRefState);
 $("uploadButton").addEventListener("click",upload);$("renderButton").addEventListener("click",render);
 $("exportButton").addEventListener("click",exportScene);
 $("saveSettings").addEventListener("click",()=>{try{serverInfo();sessionStorage.setItem(KEYS.backend,$("serverUrl").value.trim());sessionStorage.setItem(KEYS.token,$("serverToken").value);checkServer()}catch(e){toast(e.message)}});
 $("checkButton").addEventListener("click",checkServer);
 $("confirmEdit").addEventListener("click",e=>{if(!$("editPrompt").value.trim()){e.preventDefault();toast("الوصف لا يمكن أن يكون فارغًا");return}drafts[editId]=$("editPrompt").value.trim();saveJSON(KEYS.drafts,drafts);populateShots();toast("تم حفظ المسودة محليًا")});
 $("resetDrafts").addEventListener("click",()=>{if(!confirm("حذف جميع تعديلات المشاهد المحلية؟"))return;drafts={};saveJSON(KEYS.drafts,drafts);populateShots();toast("تمت إزالة المسودات")});
 $("installGuide").addEventListener("click",()=>toast("من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية»"));
 $("installButton").addEventListener("click",async()=>{if(pendingInstall){pendingInstall.prompt();await pendingInstall.userChoice;pendingInstall=null}else toast("من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية»")});
 window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();pendingInstall=e});
}
async function boot(){
 bind();drafts=readJSON(KEYS.drafts,{});refs=readJSON(KEYS.refs,{});
 $("serverUrl").value=sessionStorage.getItem(KEYS.backend)||"";$("serverToken").value=sessionStorage.getItem(KEYS.token)||"";updateOnline(false);
 try{
 const [sr,cr,dr]=await Promise.all(["./data/scene.json","./data/characters.json","./data/dialogue.json"].map(async x=>{const r=await fetch(x);if(!r.ok)throw Error("لم يتم تحميل "+x);return r.json()}));
 scene=sr;bible=cr;dialogue=dr;
 if(scene.shots.length!==16||dialogue.dialogue_only.length!==9)throw Error("ملفات الحلقة غير مكتملة");
 populateShots();populateCast();if($("serverUrl").value&&$("serverToken").value)checkServer();
 }catch(e){$("shotsList").textContent="تعذر فتح السيناريو: "+e.message;log("مطلوب نشر ملفات data مع التطبيق: "+e.message)}
 if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
document.addEventListener("DOMContentLoaded",boot);
})();
