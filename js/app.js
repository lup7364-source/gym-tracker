/* Starter list, copied into each user's account the first time they sign in. After that, edit it in the app. */
const DEFAULTS=[
["Barbell flat bench press","chest",1],["Barbell incline bench press","chest",1],["Barbell decline bench press","chest",1],
["Pec deck fly","chest",0],["Standing cable fly","chest",0],["High cable fly","chest",0],["Low standing cable fly","chest",0],
["Lat pulldown","back",1],["Seated cable row","back",1],["Bent-over row","back",1],["Hyperextension","back",0],["Deadlifts","back",1],
["Dumbbell side raise","shoulders",0],["Dumbbell front raise","shoulders",0],["Dumbbell shrugs","shoulders",0],["Dumbbell shoulder press","shoulders",1],
["Front raise cable","shoulders",0],["Reverse pec deck","shoulders",0],["Face pulls","shoulders",0],
["Dumbbell bicep curl","arms",0],["EZ bar preacher curl","arms",0],["Dumbbell reverse curl","arms",0],["Dumbbell hammer curl","arms",0],
["Close grip EZ bar curl","arms",0],["Seated barbell wrist curl","arms",0],["Dumbbell kickback","arms",0],
["Dumbbell overhead triceps extension","arms",0],["Tricep bench dips","arms",1],["Pulley triceps pushdown","arms",0],
["Leg extension","legs",0],["Leg press","legs",1],["Seated calf raise","legs",0],["Barbell lunges","legs",1],
["Lying leg curl","legs",0],["Hip thrusts","legs",1],["Barbell squat","legs",1],
["Weighted sit-ups","core",0],["Weighted Russian twist","core",0],["Hanging knee & hip raise","core",0],
["Bicycle crunches","core",0],["Sit-ups","core",0],["Incline straight-leg & hip raise","core",0]
];

const GROUPS=["legs","chest","back","shoulders","arms","core"];
const GN={legs:"Legs",chest:"Chest",back:"Back",shoulders:"Shoulders",arms:"Arms",core:"Core"};
const COL={legs:"#fa114f",chest:"#a6ff00",back:"#00d8ff",shoulders:"#ff9f0a",arms:"#bf5af2",core:"#ffd60a"};
const COL0={...COL};
let PLAN=null;   // special fixed plan for this user (from js/plans.js), or null for the standard app
function applyTheme(){
  Object.assign(COL,COL0,PLAN?PLAN.colors:{});
  const r=document.documentElement;
  if(PLAN){r.dataset.theme=PLAN.theme;try{localStorage.setItem("gymTheme",PLAN.theme)}catch{}}
  else{delete r.dataset.theme;try{localStorage.removeItem("gymTheme")}catch{}}
}
const ICON='<svg viewBox="0 0 24 24"><path d="M6 7v10M3 10v4M18 7v10M21 10v4M6 12h12"/></svg>';
const $=id=>document.getElementById(id);
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let user=null,EX=[],cur="",plan=[],last={},saved={},blob=null;

const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const addDays=(s,n)=>{const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return iso(d)};
const dayNum=s=>{const [y,m,d]=s.split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/864e5)};
const md=s=>s.slice(5).replace("-","/");
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const imgUrl=e=>`${SUPABASE_URL}/storage/v1/object/public/exercise-images/${e.image_path}`;
const ph=g=>`<div class="ph" style="--c:${COL[g]}">${ICON}</div>`;
const pic=e=>e.image_path?`<img src="${esc(imgUrl(e))}" alt="${esc(e.name)}" loading="lazy" data-g="${e.muscle_group}">`:ph(e.muscle_group);
/* if an image fails to load, show the icon instead */
document.addEventListener("error",ev=>{const t=ev.target;if(t.tagName==="IMG"&&t.dataset.g){const d=document.createElement("div");d.innerHTML=ph(t.dataset.g);t.replaceWith(d.firstChild)}},true);

/* ---------- Daily plan ----------
   • Every CYCLE (6) days, each active exercise is done exactly once and every day mixes muscle groups.
   • Each new cycle is re-shuffled so that exercises that shared a day in the previous cycle are kept apart
     (routines don't repeat). It is seeded, so the plan is the same all day and on every device.
   • If you only do part of a day, the exercises you didn't log move to the lightest day still ahead (this cycle or the next).
     A day with nothing logged counts as a rest day and doesn't move anything. */
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shuffle(l,r){for(let i=l.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[l[i],l[j]]=[l[j],l[i]]}return l}
const dayStr=n=>new Date(n*864e5).toISOString().slice(0,10);
const todayStr=()=>iso(new Date());

function dealCycle(cyc,prev){
  const r=rng(cyc+7919),act=EX.filter(e=>e.active),cap=Math.ceil(act.length/CYCLE);
  const pd={};if(prev)prev.forEach((l,i)=>l.forEach(e=>pd[e.id]=i));
  const days=Array.from({length:CYCLE},()=>[]);
  shuffle(act.slice(),r).forEach(e=>{
    let best=-1,bs=1e9;
    for(let s=0;s<CYCLE;s++){
      if(days[s].length>=cap)continue;
      const gc=days[s].filter(x=>x.muscle_group===e.muscle_group).length;                       // keep muscle groups spread
      const ov=prev?days[s].filter(x=>pd[x.id]!==undefined&&pd[x.id]===pd[e.id]).length:0;         // keep old day-mates apart
      const sc=gc*100+ov*10+days[s].length*3+r()*2;
      if(sc<bs){bs=sc;best=s}
    }
    days[best].push(e);
  });
  return days;
}
const ANCHOR=Math.floor(dayNum("2025-01-01")/CYCLE);
let CM={sig:"",m:{}};
function cycleDays(cyc){
  const sig=EX.filter(e=>e.active).map(e=>e.id+e.muscle_group).join();
  if(CM.sig!==sig)CM={sig,m:{}};
  if(cyc<ANCHOR)return dealCycle(cyc,null);
  for(let k=ANCHOR;k<=cyc;k++)if(!CM.m[k])CM.m[k]=dealCycle(k,CM.m[k-1]||null);
  return CM.m[cyc];
}

async function planFor(day){
  const n=dayNum(day),cyc=Math.floor(n/CYCLE),ws=(cyc-1)*CYCLE,we=(cyc+2)*CYCLE-1,T=dayNum(todayStr());
  let rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await db.from("sets").select("day,exercise_id").gte("day",dayStr(ws)).lte("day",dayStr(we)).range(from,from+999);
    if(error||!data)break;
    rows=rows.concat(data);if(data.length<1000)break;
  }
  const logged=new Set(),used=new Set();
  rows.forEach(s=>{const d=dayNum(s.day);logged.add(d+"|"+s.exercise_id);used.add(d)});
  const L={};
  for(let d=ws;d<=we;d++){const c=Math.floor(d/CYCLE);L[d]=cycleDays(c)[d-c*CYCLE].slice()}
  for(let d=ws;d<n;d++){
    if(!used.has(d))continue;                                    // nothing logged = rest day, nothing moves
    const cEnd=(Math.floor(d/CYCLE)+1)*CYCLE-1,last=Math.min(cEnd+CYCLE,we);
    L[d].filter(e=>!logged.has(d+"|"+e.id)).forEach(e=>{
      const cur=EX.find(x=>x.id===e.id);if(!cur||!cur.active)return;
      let t=-1;
      for(let x=d+1;x<=last;x++){
        if(!(x>=T||used.has(x))||L[x].some(y=>y.id===e.id))continue;   // only days still ahead (or days you did train)
        if(t<0||L[x].length<L[t].length)t=x;                           // the lightest one
      }
      if(t<0)t=cEnd+1;
      if(t<=we&&!L[t].some(y=>y.id===e.id))L[t].push({...cur,carried:true});
    });
  }
  return L[n];
}

/* ---------- Fixed plan (special profiles) ---------- */
const PICK={};   // date → routine chosen by tapping Day 1/2/3
const hintFor=name=>{for(const d of PLAN.days)for(const it of d.items)if(it[0]===name)return it[3];return""};
function routineItems(ri){
  return PLAN.days[ri].items.map(([name,sets,reps,hint])=>{const e=EX.find(x=>x.name===name);return e&&{...e,sets,reps,hint}}).filter(Boolean);
}
function pickRoutine(day,logs){
  if(PICK[day]!==undefined)return PICK[day];
  if(logs.length){                                   // already trained that day: show the routine that matches what was logged
    const ids=new Set(logs.map(s=>s.exercise_id));let best=null,bs=0;
    PLAN.days.forEach((d,i)=>{const its=routineItems(i),hit=its.filter(e=>ids.has(e.id)).length/(its.length||1);if(hit>bs){bs=hit;best=i}});
    if(best!==null)return best;
  }
  const w=PLAN.weekdays[new Date(day+"T12:00:00").getDay()];
  return w===undefined?null:w;
}
$("dpick").addEventListener("click",ev=>{const b=ev.target.closest("button");if(!b)return;PICK[cur]=+b.dataset.i;TM={};render()});

/* ---------- Session ---------- */
async function init(){
  const {data}=await db.auth.getSession();
  data.session?enter(data.session.user):show("login");
}
function show(w){$("login").classList.toggle("hide",w!=="login");$("app").classList.toggle("hide",w!=="app")}
$("lbtn").onclick=async()=>{
  $("lerr").textContent="";
  const name=$("u").value.trim().toLowerCase().replace(/\s+/g,"");
  if(!name||!$("p").value){$("lerr").textContent="Enter your username and password.";return}
  const {data,error}=await db.auth.signInWithPassword({email:name.includes("@")?name:name+"@"+DOMAIN,password:$("p").value});
  if(error){$("lerr").textContent="Incorrect username or password.";return}
  enter(data.user);
};
$("p").addEventListener("keydown",e=>{if(e.key==="Enter")$("lbtn").click()});
$("out").onclick=async()=>{if(!confirm("Signed in as "+(user&&user.email)+(PLAN?" (3-day plan)":"")+".\n\nSign out?"))return;await db.auth.signOut();user=null;PLAN=null;applyTheme();$("p").value="";show("login")};

async function loadEx(){
  let {data,error}=await db.from("exercises").select("*").order("id");
  if(error)return false;
  if(PLAN){
    const first={};PLAN.days.forEach(d=>d.items.forEach(([n,s,r])=>{if(!first[n])first[n]=[s,r]}));
    const have=new Set(data.map(e=>e.name)),need=Object.keys(PLAN.ex).filter(n=>!have.has(n));
    if(need.length){
      const ins=await db.from("exercises").insert(need.map(n=>({name:n,muscle_group:PLAN.ex[n][0],type:PLAN.ex[n][1],sets:first[n][0],reps:first[n][1],default_weight:PLAN.ex[n][2]})));
      if(ins.error)return false;
      ({data}=await db.from("exercises").select("*").order("id"));
    }
    data=data.filter(e=>PLAN.ex[e.name]);
  }else if(!data.length){
    await db.from("exercises").insert(DEFAULTS.map(([name,g,c])=>({name,muscle_group:g,type:c?"compound":"isolation",sets:c?4:3,reps:c?"8-10":g==="core"?"15":"12"})));
    ({data}=await db.from("exercises").select("*").order("id"));
  }
  EX=data;
  $("exSel").innerHTML=GROUPS.map(g=>{const l=EX.filter(e=>e.muscle_group===g);return l.length?`<optgroup label="${GN[g]}">${l.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join("")}</optgroup>`:""}).join("");
  return true;
}
async function enter(u){
  user=u;if(typeof resetFood==="function")resetFood();show("app");$("out").textContent=u.email[0];
  const em=(u.email||"").toLowerCase(),pn=typeof PROFILES!=="undefined"?(PROFILES[em]||PROFILES[em.split("@")[0]]):null;
  if(pn&&(typeof PLANS==="undefined"||!PLANS[pn])){
    PLAN=null;applyTheme();
    $("list").innerHTML=`<p class="mute">Profile “${esc(pn)}” was found for ${esc(em)} but js/plans.js isn’t loaded. Upload plans.js and index.html, then reload.</p>`;return;
  }
  PLAN=pn?PLANS[pn]:null;applyTheme();
  if(!(await loadEx())){$("list").innerHTML='<p class="mute">Couldn’t load exercises. Did you run setup.sql?</p>';return}
  cur=iso(new Date());render();checkBW();
}

/* ---------- Tabs ---------- */
[1,2,3,4,5,6].forEach(n=>$("t"+n).onclick=()=>tab(n));
function tab(n){
  [1,2,3,4,5,6].forEach(i=>{$("v"+i).classList.toggle("hide",i!==n);$("t"+i).classList.toggle("on",i===n)});
  if(n===2)loadProgress();if(n===3)renderManage();if(n===4)renderCardio();if(n===5)renderBody();if(n===6)renderFood();
}
$("prev").onclick=()=>{cur=addDays(cur,-1);TM={};render()};
$("next").onclick=()=>{cur=addDays(cur,1);TM={};render()};

/* ---------- Workout ---------- */
async function render(){
  const day=cur,today=iso(new Date()),d=new Date(day+"T12:00:00");
  $("title").textContent=day===today?"Today":d.toLocaleDateString("en-US",{weekday:"long"});
  $("sub").textContent=d.toLocaleDateString("en-US",{month:"long",day:"numeric"});
  let dayLogs=null;
  if(PLAN){
    const r0=await db.from("sets").select("*").eq("day",day);
    if(day!==cur)return;
    dayLogs=r0.data||[];
    const ri=pickRoutine(day,dayLogs);
    plan=ri===null?[]:routineItems(ri);
    $("dpick").innerHTML=PLAN.days.map((x,i)=>`<button data-i="${i}" class="${i===ri?"on":""}">Day ${i+1}</button>`).join("");
    $("dpick").classList.remove("hide");
    $("navl").textContent=ri===null?"Rest day":`${PLAN.days[ri].title} · ${PLAN.days[ri].time}`;
  }else{
    $("dpick").classList.add("hide");
    plan=await planFor(day);
    if(day!==cur)return;
    $("navl").textContent=plan.length+" exercises · day "+((dayNum(day)%CYCLE)+1)+" of "+CYCLE;
  }
  $("list").innerHTML="";$("saveWrap").classList.add("hide");
  if(!plan.length){$("list").innerHTML=PLAN?'<div class="rest"><h2>Rest day</h2><p class="mute">Want to train anyway? Pick a day above.</p></div>':'<div class="rest"><h2>Nothing planned</h2><p class="mute">Add or activate exercises in the Exercises tab.</p></div>';updateRings();return}
  const ids=plan.map(e=>e.id);
  const [c,p]=await Promise.all([
    PLAN?Promise.resolve({data:dayLogs}):db.from("sets").select("*").eq("day",day).in("exercise_id",ids),
    db.from("sets").select("exercise_id,set_no,weight,reps,day").lt("day",day).in("exercise_id",ids).order("day",{ascending:false}).limit(800)
  ]);
  if(day!==cur)return;
  saved={};(c.data||[]).forEach(s=>saved[s.exercise_id+"|"+s.set_no]=s);
  last={};
  (p.data||[]).forEach(s=>{
    const l=last[s.exercise_id];
    if(!l)last[s.exercise_id]={day:s.day,sets:{[s.set_no]:s}};
    else if(l.day===s.day)l.sets[s.set_no]=s;
  });
  $("list").innerHTML=plan.map(e=>{
    const l=last[e.id];let rows="";
    for(let k=1;k<=e.sets;k++){
      const s=saved[e.id+"|"+k],pr=l&&l.sets[k];
      rows+=`<div class="row"><b>${k}</b>
        <input inputmode="decimal" data-e="${e.id}" data-k="${k}" data-f="w" placeholder="${pr&&pr.weight?pr.weight:(e.default_weight||"kg")}" value="${s?s.weight:""}" aria-label="Weight, set ${k}">
        <input inputmode="numeric" data-e="${e.id}" data-k="${k}" data-f="r" placeholder="${pr?pr.reps:(parseInt(e.reps)||"reps")}" value="${s?s.reps:""}" aria-label="Reps, set ${k}"></div>`;
      if(k===e.sets)rows+=`<div class="row trow"><span></span><input inputmode="numeric" data-e="${e.id}" data-k="${k}" data-f="t" placeholder="0:00" value="${s&&s.seconds?tmFmt(s.seconds):""}" aria-label="Stopwatch time"></div>`;
    }
    const lw=l?Math.max(...Object.values(l.sets).map(x=>x.weight)):0,lr=l?Math.max(...Object.values(l.sets).map(x=>x.reps)):0;
    const hint=e.hint?esc(e.hint):"";
    const info=l?(lw?`Last time: ${lw} kg · ${md(l.day)}`:`Last time: ${lr} reps · ${md(l.day)}`)+(hint?` · Suggested ${hint}`:""):(hint?`Suggested: ${hint}`:(e.default_weight?`Suggested start: ${e.default_weight} kg`:"First time. Pick a comfortable weight"));
    return `<div class="card"><div class="eh" data-id="${e.id}" role="button" tabindex="0">
      <div class="thumb">${pic(e)}</div>
      <div><h3>${esc(e.name)}</h3><div class="meta" style="margin:2px 0 0">${GN[e.muscle_group]} · ${e.type} · ${e.sets} × ${esc(e.reps)}${e.carried?" · carried over":""}</div></div><span class="chev">›</span></div>
      <div class="meta">${info}</div>
      <div class="timer" data-t="${e.id}"><button class="tb go" data-a="go">Start</button><button class="tb" data-a="pause" disabled>Pause</button></div>
      <div class="lbl"><span></span><span>Weight (kg)</span><span>Reps</span></div>${rows}</div>`;
  }).join("");
  $("saveWrap").classList.remove("hide");$("save").textContent="Save workout";
  plan.forEach(e=>paintTimer(e.id));
  updateRings();
}

$("list").addEventListener("input",ev=>{
  const t=ev.target;
  /* typing the weight of set 1 fills the other empty weight fields of that exercise */
  if(t.dataset.f==="w"&&t.dataset.k==="1")
    document.querySelectorAll(`input[data-e="${t.dataset.e}"][data-f="w"]`).forEach(i=>{if(i!==t&&(i.dataset.auto||i.value===""))i.value=t.value,i.dataset.auto=1});
  else if(t.dataset.f==="w")delete t.dataset.auto;
  updateRings();
});
$("list").addEventListener("click",ev=>{const h=ev.target.closest(".eh");if(h)openModal(+h.dataset.id)});
$("list").addEventListener("keydown",ev=>{if(ev.key==="Enter"){const h=ev.target.closest(".eh");if(h)openModal(+h.dataset.id)}});

$("save").onclick=async()=>{
  const rows=[];
  plan.forEach(e=>{
    for(let k=1;k<=e.sets;k++){
      const q=f=>{const el=document.querySelector(`input[data-e="${e.id}"][data-k="${k}"][data-f="${f}"]`);return el?el.value:""};
      const w=q("w"),r=q("r"),tt=q("t");
      if(w===""&&r===""&&tt==="")continue;
      rows.push({user_id:user.id,day:cur,exercise_id:e.id,set_no:k,weight:parseFloat(String(w).replace(",","."))||0,reps:parseInt(r)||0,seconds:k===e.sets?parseTime(tt):null});
    }
  });
  if(!rows.length){$("save").textContent="Nothing to save";return}
  $("save").textContent="Saving…";
  const {error}=await db.from("sets").upsert(rows,{onConflict:"user_id,day,exercise_id,set_no"});
  const doneIds=new Set(rows.map(r=>r.exercise_id)),left=PLAN?0:plan.filter(e=>!doneIds.has(e.id)).length;
  $("save").textContent=error?"Couldn’t save. Try again.":left?`Saved ✓ · ${left} unfinished will move to another day`:"Saved ✓";
};

/* ---------- Stopwatch (one per exercise) ----------
   Start → button becomes Finish. Pause/Resume in between. Finish writes the time into the Time field of the last set. */
let TM={};   // exercise id → {ms: accumulated, t0: last start, run, pause}
function tmFmt(sec){sec=Math.round(sec);return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0")}
function parseTime(str){
  str=String(str||"").trim();if(!str)return null;
  const p=str.split(":").map(x=>parseFloat(x.replace(",",".")));
  if(p.some(isNaN))return null;
  const sec=p.length>=2?p[0]*60+p[1]:p[0];
  return sec>0?Math.round(sec):null;
}
const tmMs=t=>t.ms+(t.run&&!t.pause?Date.now()-t.t0:0);
function paintTimer(id){
  const box=document.querySelector(`.timer[data-t="${id}"]`);if(!box)return;
  const t=TM[id]||{ms:0,run:false,pause:false};
  const inp=document.querySelector(`input[data-e="${id}"][data-f="t"]`);
  if(TM[id]&&inp&&(t.run||t.ms>0))inp.value=tmFmt(tmMs(t)/1000);   // live time, right under the reps
  const go=box.querySelector('[data-a="go"]'),pa=box.querySelector('[data-a="pause"]');
  go.textContent=t.run?"Finish":"Start";go.classList.toggle("stop",t.run);
  pa.disabled=!t.run;pa.textContent=t.pause?"Resume":"Pause";
}
setInterval(()=>{Object.keys(TM).forEach(id=>{if(TM[id].run&&!TM[id].pause)paintTimer(id)})},250);
$("list").addEventListener("click",ev=>{
  const b=ev.target.closest(".tb");if(!b)return;
  const id=+b.closest(".timer").dataset.t,t=TM[id]||(TM[id]={ms:0,t0:0,run:false,pause:false});
  if(b.dataset.a==="go"){
    if(!t.run){t.run=true;t.pause=false;t.ms=0;t.t0=Date.now()}            // start
    else{                                                                    // finish
      const total=tmMs(t);t.ms=total;t.run=false;t.pause=false;
    }
  }else if(t.run){
    if(t.pause){t.pause=false;t.t0=Date.now()}                               // resume
    else{t.ms+=Date.now()-t.t0;t.pause=true}                                 // pause
  }
  paintTimer(id);
});

/* ---------- Rings ---------- */
function setRing(id,p){const c=$(id),len=2*Math.PI*c.getAttribute("r");c.style.strokeDasharray=p>0?`${len*p} ${len}`:`0 ${len}`;c.style.opacity=p>0?1:0}
function updateRings(){
  let tot=0,done=0,exDone=0,vol=0,lastVol=0;
  plan.forEach(e=>{
    let c=0;
    for(let k=1;k<=e.sets;k++){
      tot++;
      const el=f=>document.querySelector(`input[data-e="${e.id}"][data-k="${k}"][data-f="${f}"]`);
      if(!el("w"))continue;
      const w=parseFloat(String(el("w").value).replace(",","."))||0,r=parseInt(el("r").value)||0;
      if(w>0||r>0){c++;done++}
      vol+=w*r;
    }
    if(c===e.sets)exDone++;
    if(last[e.id])Object.values(last[e.id].sets).forEach(s=>lastVol+=s.weight*s.reps);
  });
  const f=(a,b)=>b?Math.min(a/b,1):0;
  setRing("r1",f(done,tot));setRing("r2",f(exDone,plan.length));setRing("r3",f(vol,lastVol));
  $("s1").textContent=done+"/"+tot;$("s2").textContent=exDone+"/"+plan.length;$("s3").textContent=Math.round(vol)+" kg";
}

/* ---------- Exercise detail ---------- */
function closeModal(){$("modal").classList.add("hide")}
$("modal").addEventListener("click",ev=>{if(ev.target===$("modal"))closeModal()});
document.addEventListener("keydown",ev=>{if(ev.key==="Escape")closeModal()});

async function openModal(id){
  const e=EX.find(x=>x.id===id);if(!e)return;
  $("sheet").innerHTML=`<button class="x" id="mx" aria-label="Close">✕</button>
    <div class="big">${pic(e)}</div>
    <h1 style="font-size:30px">${esc(e.name)}</h1>
    <div style="margin:10px 0"><span class="chip" style="color:${COL[e.muscle_group]}">${GN[e.muscle_group]}</span><span class="chip">${e.type}</span><span class="chip">${e.sets} × ${esc(e.reps)}</span>${PLAN&&hintFor(e.name)?`<span class="chip">Suggested: ${esc(hintFor(e.name))}</span>`:""}</div>
    ${e.instructions?`<p class="mute" style="margin:0 0 8px">${esc(e.instructions)}</p>`:""}
    <h2 style="font-size:22px;margin-top:18px">Your weights</h2><div id="mh" class="mute">Loading…</div>
    <button id="medit" style="width:100%;margin-top:18px;background:var(--card2)">Edit exercise</button>`;
  $("modal").classList.remove("hide");
  $("mx").onclick=closeModal;$("medit").onclick=()=>openEdit(id);
  const {data}=await db.from("sets").select("day,weight,reps").eq("exercise_id",id).order("day",{ascending:false}).limit(80);
  const by={};(data||[]).forEach(s=>{const b=by[s.day]||(by[s.day]={w:0,reps:0});if(s.weight>b.w||(s.weight===b.w&&s.reps>b.reps)){b.w=s.weight;b.reps=s.reps}});
  const days=Object.entries(by);
  if(!days.length){$("mh").textContent="No logs yet. Your first one sets the baseline.";return}
  const pb=Math.max(...days.map(([,v])=>v.w));
  $("mh").innerHTML=`<div style="color:var(--ink);margin-bottom:8px">Personal best: <b style="color:var(--acc)">${pb?pb+" kg":Math.max(...days.map(([,v])=>v.reps))+" reps"}</b></div>`+
    days.slice(0,6).map(([d,v])=>`<div class="hist"><span>${md(d)}/${d.slice(0,4)}</span><span style="color:var(--ink)">${v.w?`<b>${v.w} kg</b> × ${v.reps}`:`<b>${v.reps} reps</b>`}</span></div>`).join("");
}

/* ---------- Manage exercises ---------- */
function renderManage(){
  const act=EX.filter(e=>e.active).length;
  $("add").classList.toggle("hide",!!PLAN);
  $("mcount").textContent=PLAN?`${EX.length} exercises · your 3-day plan. Tap one to add a photo or notes.`:`${EX.length} exercises · ${act} active · about ${Math.ceil(act/CYCLE)} per day`;
  $("mlist").innerHTML=GROUPS.map(g=>{
    const l=EX.filter(e=>e.muscle_group===g);if(!l.length)return"";
    return `<h3 style="margin:18px 0 8px;color:${COL[g]}">${GN[g]} <span class="mute" style="font-size:15px">${l.length}</span></h3>
      <div class="card" style="padding:4px 16px">${l.map(e=>`<div class="mrow ${e.active?"":"off"}" data-id="${e.id}" role="button" tabindex="0">
        <div class="thumb s">${pic(e)}</div><div><div style="font-weight:600">${esc(e.name)}</div>
        <div class="meta" style="margin:0">${e.type} · ${e.sets} × ${esc(e.reps)}${e.active?"":" · hidden"}</div></div><span class="chev">›</span></div>`).join("")}</div>`;
  }).join("");
}
$("mlist").addEventListener("click",ev=>{const r=ev.target.closest(".mrow");if(r)openEdit(+r.dataset.id)});
$("add").onclick=()=>openEdit(null);

async function shrink(file){
  const b=await createImageBitmap(file),s=Math.min(1,900/Math.max(b.width,b.height));
  const c=document.createElement("canvas");c.width=Math.round(b.width*s);c.height=Math.round(b.height*s);
  c.getContext("2d").drawImage(b,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,"image/jpeg",.85));
}
function openEdit(id){
  const e=id?EX.find(x=>x.id===id):{name:"",muscle_group:"chest",type:"compound",sets:3,reps:"10",default_weight:0,instructions:"",active:true,image_path:null};
  blob=null;
  const fx=!!PLAN&&!!id,hd=fx?" hide":"";
  const opt=(arr,v,lab)=>arr.map(x=>`<option value="${x}" ${x===v?"selected":""}>${lab?lab[x]:x}</option>`).join("");
  $("sheet").innerHTML=`<button class="x" id="mx" aria-label="Close">✕</button>
    <h1 style="font-size:30px;padding-top:56px;margin-bottom:16px">${id?"Edit exercise":"New exercise"}</h1>
    <div class="imgpick"><div class="thumb" id="fprev">${pic(e)}</div>
      <div><input type="file" id="ffile" accept="image/*" style="padding:8px"><div class="meta" style="margin:4px 0 0">Optional. Resized automatically.</div></div></div>
    <label class="fld"><span>Name</span><input id="fname" value="${esc(e.name)}" ${fx?"readonly":""}></label>
    <div class="two${hd}">
      <label class="fld"><span>Muscle group</span><select id="fgroup">${opt(GROUPS,e.muscle_group,GN)}</select></label>
      <label class="fld"><span>Type</span><select id="ftype">${opt(["compound","isolation"],e.type)}</select></label>
    </div>
    <div class="two${hd}">
      <label class="fld"><span>Sets</span><input id="fsets" inputmode="numeric" value="${e.sets}"></label>
      <label class="fld"><span>Reps</span><input id="freps" value="${esc(e.reps)}"></label>
    </div>
    <label class="fld${hd}"><span>Suggested start weight (kg)</span><input id="fw" inputmode="decimal" value="${e.default_weight}"></label>
    <label class="fld"><span>Notes / instructions</span><textarea id="fins">${esc(e.instructions)}</textarea></label>
    <label class="sw${hd}"><input type="checkbox" id="fact" ${e.active?"checked":""}> Include in my daily plan</label>
    <div class="err" id="ferr"></div>
    <button class="p" id="fsave" style="width:100%;padding:14px">Save</button>
    ${id&&!fx?'<button class="danger" id="fdel">Delete exercise</button>':""}`;
  $("modal").classList.remove("hide");
  $("mx").onclick=closeModal;
  $("ffile").onchange=async()=>{
    const f=$("ffile").files[0];if(!f)return;
    try{blob=await shrink(f);$("fprev").innerHTML=`<img src="${URL.createObjectURL(blob)}" alt="">`}
    catch{blob=null;$("ferr").textContent="Couldn’t read that image."}
  };
  $("fsave").onclick=()=>saveEx(e,id);
  if(id&&!fx)$("fdel").onclick=()=>delEx(e);
}
async function saveEx(old,id){
  const name=$("fname").value.trim();
  if(!name){$("ferr").textContent="Give it a name.";return}
  $("fsave").textContent="Saving…";
  const row={name,muscle_group:$("fgroup").value,type:$("ftype").value,sets:Math.max(1,parseInt($("fsets").value)||3),
    reps:$("freps").value.trim()||"10",default_weight:parseFloat(String($("fw").value).replace(",","."))||0,
    instructions:$("fins").value.trim()||null,active:$("fact").checked};
  if(blob){
    const path=`${user.id}/${Date.now()}.jpg`;
    const up=await db.storage.from("exercise-images").upload(path,blob,{contentType:"image/jpeg"});
    if(up.error){$("ferr").textContent="Image upload failed.";$("fsave").textContent="Save";return}
    row.image_path=path;
  }
  const res=id?await db.from("exercises").update(row).eq("id",id):await db.from("exercises").insert(row);
  if(res.error){
    if(row.image_path)await db.storage.from("exercise-images").remove([row.image_path]);
    $("ferr").textContent=res.error.code==="23505"?"You already have an exercise with that name.":"Couldn’t save. Try again.";
    $("fsave").textContent="Save";return;
  }
  if(blob&&old.image_path)await db.storage.from("exercise-images").remove([old.image_path]);
  await loadEx();closeModal();renderManage();render();
}
async function delEx(e){
  if(!confirm(`Delete “${e.name}” and all its logged weights?\n\nTip: turn off “Include in my daily plan” to just hide it and keep your history.`))return;
  const {error}=await db.from("exercises").delete().eq("id",e.id);
  if(error){$("ferr").textContent="Couldn’t delete. Try again.";return}
  if(e.image_path)await db.storage.from("exercise-images").remove([e.image_path]);
  await loadEx();closeModal();renderManage();render();
}

/* ---------- Progress ---------- */
$("exSel").onchange=loadProgress;
async function loadProgress(){
  const id=+$("exSel").value;
  if(!id){$("chart").innerHTML='<p class="mute" style="margin:0">No exercises yet.</p>';$("hist").innerHTML="";return}
  const {data,error}=await db.from("sets").select("day,weight,reps").eq("exercise_id",id).order("day");
  if(error||!data.length){$("chart").innerHTML='<p class="mute" style="margin:0">No logs for this exercise yet.</p>';$("hist").innerHTML='<p class="mute" style="margin:0">—</p>';return}
  const by={};
  data.forEach(s=>{const b=by[s.day]||(by[s.day]={w:0,reps:0,vol:0});if(s.weight>b.w||(s.weight===b.w&&s.reps>b.reps)){b.w=s.weight;b.reps=s.reps}b.vol+=s.weight*s.reps});
  const pts=Object.entries(by).map(([d,v])=>({d,...v}));
  const bw=pts.every(p=>p.w===0);   // bodyweight exercise: chart the reps instead
  $("chart").innerHTML=lineSvg(pts.map(p=>bw?p.reps:p.w),bw?"Top reps per day":"Top weight per day",bw?0:1);
  $("hist").innerHTML=pts.slice().reverse().map(p=>`<div class="hist"><span>${md(p.d)}/${p.d.slice(0,4)}</span><span>${p.w?`<b>${p.w} kg</b> × ${p.reps} · vol. ${Math.round(p.vol)}`:`<b>${p.reps} reps</b>`}</span></div>`).join("");
}

/* ---------- Helpers ---------- */
const weekStart=day=>addDays(day,-((new Date(day+"T12:00:00").getDay()+6)%7));  // Monday
const num=n=>String(Math.round(Number(n)*100)/100);
const fmtTime=m=>{m=Math.round(m);return m>=60?Math.floor(m/60)+"h "+String(m%60).padStart(2,"0")+"m":m+" min"};
function lineSvg(vals,label,dec){
  const W=320,H=140,pad=24,max=Math.max(...vals),min=Math.min(...vals);
  const x=i=>pad+(vals.length===1?(W-2*pad)/2:i*(W-2*pad)/(vals.length-1));
  const y=v=>H-pad-(max===min?(H-2*pad)/2:(v-min)/(max-min)*(H-2*pad));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <polyline fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" points="${vals.map((v,i)=>x(i)+","+y(v)).join(" ")}"/>
    ${vals.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="var(--acc)"/>`).join("")}
    <text x="4" y="${y(max)+4}" font-size="11" fill="var(--mute)">${max.toFixed(dec)}</text>
    <text x="4" y="${y(min)+4}" font-size="11" fill="var(--mute)">${min.toFixed(dec)}</text></svg>`;
}

/* ---------- Weekly body weight ---------- */
$("bwbanner").onclick=()=>tab(5);
async function checkBW(){
  const {data,error}=await db.from("body_weights").select("id").eq("week_start",weekStart(iso(new Date()))).limit(1);
  $("bwbanner").classList.toggle("hide",!!error||(data&&data.length>0));
}
async function renderBody(){
  const {data,error}=await db.from("body_weights").select("*").order("week_start",{ascending:false}).limit(60);
  if(error){$("bwstatus").textContent="Couldn’t load. Did you run update_weight_cardio.sql?";return}
  const wk=weekStart(iso(new Date())),now=data.find(w=>w.week_start===wk);
  $("bwstatus").textContent=now?`This week: ${num(now.weight)} kg (logged ${md(now.day)}). You can update it.`:"Not logged this week yet.";
  if(now&&!$("bwin").value)$("bwin").value=num(now.weight);
  $("bwchart").innerHTML=data.length?lineSvg(data.slice().reverse().slice(-26).map(w=>Number(w.weight)),"Body weight by week",1):'<p class="mute" style="margin:0">Your first weigh-in starts the chart.</p>';
  $("bwhist").innerHTML=data.length?data.map((w,i)=>{
    const p=data[i+1],d=p?Number(w.weight)-Number(p.weight):null;
    return `<div class="hist"><span>Week of ${md(w.week_start)}</span><span><b>${num(w.weight)} kg</b>${d===null?"":` <span class="mute">${d>0?"+":""}${num(d)}</span>`}</span></div>`;
  }).join(""):'<p class="mute" style="margin:0">No weigh-ins yet.</p>';
}
$("bwsave").onclick=async()=>{
  const w=parseFloat(String($("bwin").value).replace(",","."));
  if(!(w>0)){$("bwerr").textContent="Enter your weight in kg.";return}
  $("bwerr").textContent="";$("bwsave").textContent="Saving…";
  const today=iso(new Date());
  const {error}=await db.from("body_weights").upsert({user_id:user.id,week_start:weekStart(today),day:today,weight:w},{onConflict:"user_id,week_start"});
  $("bwsave").textContent="Save";
  if(error){$("bwerr").textContent="Couldn’t save. Try again.";return}
  $("bwin").value="";await renderBody();checkBW();
};

/* ---------- Cardio ---------- */
let CK="run";
const KN={run:"Run",bike:"Static bike",swim:"Swim"};
const INT=["","Very easy","Very easy","Easy","Easy","Moderate","Moderate","Hard","Hard","All out","All out"];
const fmtPace=p=>{let m=Math.floor(p),s=Math.round((p-m)*60);if(s===60){m++;s=0}return m+":"+String(s).padStart(2,"0")};
$("ckind").addEventListener("click",ev=>{
  const b=ev.target.closest("button");if(!b)return;CK=b.dataset.k;
  [...$("ckind").children].forEach(x=>x.classList.toggle("on",x===b));
  const sw=CK==="swim";$("ckl").textContent=sw?"Distance (m)":"Distance (km)";$("ckm").placeholder=sw?"1000":"5";   // swimming is measured in meters
});
$("cint").oninput=()=>{$("cintl").textContent=$("cint").value+" · "+INT[+$("cint").value]};
async function renderCardio(){
  if(!$("cday").value)$("cday").value=iso(new Date());
  const [res,wr]=await Promise.all([
    db.from("cardio").select("*").order("day",{ascending:false}).order("id",{ascending:false}).limit(60),
    db.from("body_weights").select("week_start,weight").order("week_start")
  ]);
  const {data,error}=res;
  if(error){$("chist").innerHTML='<p class="mute" style="margin:0">Couldn’t load. Did you run update_weight_cardio.sql?</p>';return}
  const ws=(wr&&wr.data)||[];
  /* calories use your weight (latest weigh-in) and the intensity you chose — same math as the Deficit tab */
  const kc=c=>(typeof cardioKcal==="function"&&typeof kgFor==="function")?cardioKcal(c,kgFor(c.day,ws)):0;
  const wk=weekStart(iso(new Date())),tw=data.filter(c=>c.day>=wk);
  const sum=(k,f)=>tw.filter(c=>!k||c.kind===k).reduce((a,c)=>a+Number(c[f]),0);
  const kcalWeek=tw.reduce((a,c)=>a+kc(c),0);
  $("cweek").innerHTML=`<div><b style="color:var(--red)">${num(sum("run","km"))} km</b><span>Run</span></div>
    <div><b style="color:var(--acc)">${num(sum("bike","km"))} km</b><span>Bike</span></div>
    <div><b style="color:var(--cyan)">${Math.round(sum("swim","km")*1000)} m</b><span>Swim</span></div>
    <div><b>${fmtTime(sum(null,"minutes"))}</b><span>Time</span></div>`+
    (kcalWeek>0?`<div class="meta">≈ ${Math.round(kcalWeek).toLocaleString("en-US")} kcal burned this week</div>`:"");
  $("chist").innerHTML=data.length?data.map(c=>{
    const km=Number(c.km),min=Number(c.minutes),swim=c.kind==="swim";let extra="";
    if(km>0){
      if(swim)extra=` · ${fmtPace(min/(km*10))} /100 m`;
      else if(c.kind==="run")extra=` · ${fmtPace(min/km)} /km`;
      else extra=` · ${(km/(min/60)).toFixed(1)} km/h`;
    }
    const k=kc(c),dist=swim?Math.round(km*1000)+" m":num(km)+" km";
    return `<div class="crow"><div><div style="font-weight:600">${KN[c.kind]||c.kind} · ${dist} · ${fmtTime(min)}</div>
      <div class="meta" style="margin:2px 0 0">${md(c.day)}/${c.day.slice(0,4)} · Intensity ${c.intensity}/10${extra}${k>0?` · ≈ ${k} kcal`:""}</div></div>
      <button class="del" data-id="${c.id}" aria-label="Delete session">✕</button></div>`;
  }).join(""):'<p class="mute" style="margin:0">No sessions yet.</p>';
}
$("chist").addEventListener("click",async ev=>{
  const b=ev.target.closest(".del");if(!b||!confirm("Delete this session?"))return;
  await db.from("cardio").delete().eq("id",b.dataset.id);renderCardio();
});
$("csave").onclick=async()=>{
  const min=parseFloat(String($("cmin").value).replace(",",".")),raw=parseFloat(String($("ckm").value).replace(",","."))||0;
  const km=CK==="swim"?raw/1000:raw;
  if(!(min>0)){$("cerr").textContent="Enter the time in minutes.";return}
  if(!$("cday").value){$("cerr").textContent="Pick a date.";return}
  $("cerr").textContent="";$("csave").textContent="Saving…";
  const {error}=await db.from("cardio").insert({user_id:user.id,day:$("cday").value,kind:CK,minutes:min,km,intensity:+$("cint").value});
  $("csave").textContent="Save session";
  if(error){$("cerr").textContent=CK==="swim"?"Couldn’t save. Did you run the swimming SQL in Supabase?":"Couldn’t save. Try again.";return}
  $("cmin").value="";$("ckm").value="";renderCardio();
};

init();