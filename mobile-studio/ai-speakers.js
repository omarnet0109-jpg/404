"use strict";
// Persistent Egyptian AI demo speaker assignments. These BUILT-IN voices are NOT cleared
// for commercial publishing. Identity is fixed by actor ID across clips and sessions.
(() => {
const KEY="studio404.ai-speaker-profiles.v1";
const MODEL="mohammedaly22/VoiceTut-TTS";
const SPEAKERS=["Yasmin","Hanan","Shaker","Yara","Rana","Sarah","Mariam","Hadeer",
  "Ahmed","Ali","Hassan","Karim","Mahmoud","Mohammed","Mostafa","Ramy","Tareq","Yehia","Youssef"];
const DEFAULTS=Object.freeze({LAYLA:"Yasmin",WIDAD:"Hanan",SABER:"Shaker"});
function validId(id){return typeof id==="string"&&/^(LAYLA|WIDAD|SABER|C_[A-Za-z0-9_-]{4,64})$/.test(id)}
function read(){
 try{const value=JSON.parse(localStorage.getItem(KEY)||"{}");return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch{return {}}
}
function get(id){
 if(!validId(id))return null;
 const profile=read()[id];
 if(profile?.model===MODEL&&SPEAKERS.includes(profile.speaker))
  return Object.freeze({actor:id,speaker:profile.speaker,model:MODEL,locked:true,demo:true});
 const selected=DEFAULTS[id];
 return selected?Object.freeze({actor:id,speaker:selected,model:MODEL,locked:true,demo:true}):null;
}
function assign(id,speaker,{replace=false}={}){
 if(!validId(id))throw Error("الشخصية غير معروفة");
 if(!SPEAKERS.includes(speaker))throw Error("الصوت غير متوفر في النموذج المصري");
 const existing=get(id);
 if(existing&&existing.speaker!==speaker&&!replace)
  throw Error("الصوت مثبت للشخصية. تغيير الصوت يحتاج موافقة صريحة");
 const data=read();
 for(const [other,profile] of Object.entries(data)){
  if(other!==id&&profile?.model===MODEL&&profile.speaker===speaker)
   throw Error("الصوت ده مخصص لشخصية تانية؛ اختار صوتًا مختلفًا");
 }
 for(const [other,defaultSpeaker] of Object.entries(DEFAULTS)){
  if(other!==id&&get(other)?.speaker===speaker)
   throw Error("الصوت ده مخصص لشخصية تانية؛ اختار صوتًا مختلفًا");
 }
 data[id]={speaker,model:MODEL,locked_at:new Date().toISOString(),demo:true};
 try{localStorage.setItem(KEY,JSON.stringify(data))}catch{throw Error("المتصفح لم يحفظ صوت الشخصية")}
 return get(id);
}
function identity(id){const p=get(id);return p?"demo:"+MODEL+":"+p.speaker:null}
globalThis.Studio404AISpeakers=Object.freeze({get,assign,identity,SPEAKERS,DEFAULTS,MODEL});
})();