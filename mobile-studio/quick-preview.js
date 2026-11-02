"use strict";
// Lightweight 2D storyboard player. Never claims to be AI video or speech.
(()=> {
const el=id=>document.getElementById(id),canvas=el("screen"),ctx=canvas.getContext("2d",{alpha:false}),W=360,H=640;
let shots=[], t=0, playing=false, raf=0, last=0, drawnSecond=-1;
const names={LAYLA:"ليلى",WIDAD:"الحاجة وداد",SABER:"عم صابر"};
const green="#284f41",gold="#ffc977",sky="#141e35";
function shape(fill,x,y,w,h){ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)}
function ellipse(fill,x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
function line(color,width,points){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()}
function figure(x,y,role,pulse){
 const female=role!=="SABER",head=role==="SABER"?"#ad7957":"#c99575";
 ellipse("#0005",x+8,y+72,41,11);
 ctx.beginPath();ctx.moveTo(x-26,y-1);ctx.lineTo(x+23,y-1);ctx.lineTo(x+32,y+65);ctx.lineTo(x-31,y+65);ctx.closePath();
 ctx.fillStyle=role==="LAYLA"?"#365b81":role==="WIDAD"?"#2c3443":"#a99883";ctx.fill();
 ellipse(head,x,y-29,24,29);
 if(role==="LAYLA"){ellipse("#171b22",x-2,y-55,25,14);ellipse("#171b22",x-17,y-41,10,25);}
 if(role==="WIDAD"){ctx.beginPath();ctx.moveTo(x-31,y-45);ctx.quadraticCurveTo(x,y-97,x+31,y-44);ctx.lineTo(x+39,y+25);ctx.lineTo(x-36,y+24);ctx.closePath();ctx.fillStyle="#232935";ctx.fill();}
 if(role==="SABER"){shape("#454c55",x-24,y-58,48,11);shape("#4a505e",x-16,y-68,32,16);shape("#473126",x-10,y-17,20,4);}
 ellipse("#172331",x-8,y-34,2,2);ellipse("#172331",x+8,y-34,2,2);
 const talking=pulse?4+Math.abs(Math.sin(pulse*12))*5:1.2;ellipse("#503129",x,y-14,4,talking/2);
 if(role==="LAYLA"){ctx.strokeStyle="#a2b5c6";ctx.lineWidth=2;ctx.strokeRect(x-23,y+4,46,42);}
 if(!female){line("#715e50",8,[[x-28,y+12],[x-34,y+50]]);}
}
function currentShot(){return shots.findLast?shots.findLast(s=>s.start_seconds<=t)||shots[0]:shots.filter(s=>s.start_seconds<=t).at(-1)||shots[0]}
function background(shot,sec){
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,sky);g.addColorStop(1,"#30455b");shape(g,0,0,W,H);
 ellipse("#e8e0bb",76,100,35,35);ellipse(sky,65,96,34,33);
 for(let i=0;i<30;i++){const x=(i*79+32)%W,y=(i*67+28)%220;ellipse("#cbd5ec",x,y,0.8,0.8)}
 // Two old alley buildings create a consistent, locked stage.
 shape("#685947",0,155,119,400);shape("#74634e",254,125,106,430);
 for(let i=0;i<8;i++){line("#8c7960",1,[[0,187+i*44],[118,180+i*44]]);line("#93816b",1,[[254,166+i*44],[360,166+i*44]])}
 shape("#274d3f",282,318,59,147);shape("#1b372e",289,331,45,120);shape("#c4a47c",292,326,4,134);
 ellipse("#d7be6b",299,273,18,23);ellipse("#ffe99b",299,272,8+Math.sin(sec*3)*2,13);
 const halo=ctx.createRadialGradient(299,272,5,299,272,120);halo.addColorStop(0,"#ffd88380");halo.addColorStop(1,"#ffd88300");ellipse(halo,299,272,120,120);
 shape("#171f2a",19,285,68,87);shape("#aab4c2",28,296,48,60);
 // Subtle upstairs light in ending
 if(shot.start_seconds>=48){const pulse=(Math.sin(sec*4)+1)*0.5;shape("rgba(74,158,233,"+(0.25+pulse*0.55)+")",260,169,54,73);}
 ctx.beginPath();ctx.moveTo(102,430);ctx.lineTo(253,420);ctx.lineTo(360,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle="#536074";ctx.fill();
 for(let i=0;i<9;i++)line("#a0a4a655",1,[[0,461+i*27],[360,453+i*29]]);
 // Camera changes between shots; 2D silhouettes are placeholders, not approved actor portraits.
 if(shot.start_seconds<39 || shot.start_seconds>=43 && shot.start_seconds<48){
   const speaking=shot.speaker,osc=Math.sin(sec*2)*1.3;
   ctx.save();ctx.translate(0,osc);
   figure(147,414,"LAYLA",speaking==="LAYLA"?sec:0);
   figure(218,410,"WIDAD",speaking==="WIDAD"?sec:0);
   figure(88,413,"SABER",speaking==="SABER"?sec:0);ctx.restore();
 }
 shape("#131b2ab8",10,14,340,32);
 ctx.fillStyle="#f0e6c7";ctx.textAlign="center";ctx.font="bold 14px Tahoma,Arial";
 ctx.fillText("الحي 404  •  معاينة مرسومة فقط",180,35);
 ctx.fillStyle="#ffffffc9";ctx.font="12px Tahoma,Arial";
 ctx.fillText("لقطة "+shot.shot_id.toUpperCase()+"  |  "+(shot.speaker?names[shot.speaker]:"بدون حوار"),180,62);
}
function render(){if(!shots.length)return;const shot=currentShot();background(shot,t);const speech=shot.dialogue_ar?.trim();el("caption").hidden=!speech;if(speech){el("speaker").textContent=names[shot.speaker]||"";el("dialogueText").textContent=speech}el("timeline").value=String(Math.round(t*10));el("elapsed").textContent="00:"+String(Math.floor(t)).padStart(2,"0");el("status").textContent="اللقطة "+shot.shot_id.toUpperCase()+" • "+(shot.end_seconds-shot.start_seconds)+" ثواني • تجربة 2D سريعة بدون GPU"}
function stop(){playing=false;el("play").textContent="▶ تشغيل المعاينة";cancelAnimationFrame(raf)}
function loop(now){if(!playing)return;const dt=Math.min((now-last)/1000,0.13);last=now;t=Math.min(60,t+dt);render();if(t>=60){stop();return}raf=requestAnimationFrame(loop)}
function play(){if(!shots.length)return;if(playing){stop();return}if(t>=60)t=0;playing=true;last=performance.now();el("play").textContent="⏸ إيقاف مؤقت";raf=requestAnimationFrame(loop)}
async function boot(){
try{
 const response=await fetch("./data/scene.json",{cache:"force-cache"});if(!response.ok)throw Error("تعذر تحميل ملف المشاهد");
 const data=await response.json();shots=data.shots;
 if(!Array.isArray(shots)||shots.length!==16||shots.reduce((s,x)=>s+x.duration_seconds,0)!==60)throw Error("ملف الحلقة غير صحيح");
 render();el("play").addEventListener("click",play);
 el("prev").addEventListener("click",()=>{const a=shots.filter(s=>s.start_seconds<t-0.2);t=a.length?a[a.length-1].start_seconds:0;render()});
 el("next").addEventListener("click",()=>{const a=shots.find(s=>s.start_seconds>t+0.2);t=a?a.start_seconds:60;render()});
 el("timeline").addEventListener("input",e=>{t=Number(e.target.value)/10;render()});
 document.addEventListener("visibilitychange",()=>{if(document.hidden)stop()});
}catch(err){el("status").textContent=err.message;el("play").disabled=true}
}
boot();
})();
