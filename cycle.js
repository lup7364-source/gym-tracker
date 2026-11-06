/* ============ WORKOUT CYCLES (standard / men's profile) ============
   A cycle = every active exercise dealt across 6 days (same mix as before). It does NOT restart on a calendar date:
   • The exercises scheduled for days that already passed and weren't done go to the "Pending" section.
   • A new cycle (re-shuffled, avoiding the previous day-groupings) starts only after EVERY exercise of the cycle
     has been done at least once, the day after the last one was completed — whatever weekday that is.
   Stored in the table "workout_cycles" (one row per cycle, with its layout), so it is stable across devices.
   Needs: app.js (db, user, EX, helpers, dealCycle, cycleDays). */
let CYC=null,CYC_ERR=false;
function resetCycles(){CYC=null;CYC_ERR=false}

async function loadCycles(){
  const r=await db.from("workout_cycles").select("*").order("start_day");
  if(r.error){CYC_ERR=true;return false}
  CYC=r.data||[];CYC_ERR=false;return true;
}
async function fetchLogs(from,to){
  let all=[];
  for(let o=0;;o+=1000){
    const {data,error}=await db.from("sets").select("day,exercise_id").gte("day",from).lte("day",to).range(o,o+999);
    if(error)return null;
    all=all.concat(data||[]);if(!data||data.length<1000)break;
  }
  return all;
}
const activeEx=id=>EX.find(e=>e.id===id&&e.active);
const reqIds=c=>[...new Set(c.layout.flat())].filter(id=>activeEx(id));

async function addCycle(start,layout){
  const r=await db.from("workout_cycles").insert({user_id:user.id,start_day:start,layout}).select();
  if(r.error||!r.data||!r.data[0])await loadCycles();      // another device may have created it first
  else CYC.push(r.data[0]);
}
/* first time: the cycle starts at the beginning of the current 6-day block, with the plan you already had */
async function createFirst(){
  const cyc=Math.floor(dayNum(todayStr())/CYCLE);
  await addCycle(dayStr(cyc*CYCLE),cycleDays(cyc).map(l=>l.map(e=>e.id)));
}
/* the day the last required exercise was first logged, or null if something is still missing */
function completionDay(c,logs){
  const ids=reqIds(c);if(!ids.length)return null;
  const first={};
  logs.forEach(s=>{if(s.day>=c.start_day&&(!(s.exercise_id in first)||s.day<first[s.exercise_id]))first[s.exercise_id]=s.day});
  return ids.every(id=>id in first)?ids.map(id=>first[id]).reduce((a,b)=>a>b?a:b):null;
}
async function closeCycle(c,fin){
  await db.from("workout_cycles").update({finished_day:fin}).eq("id",c.id);c.finished_day=fin;
  const prev=c.layout.map(l=>l.map(id=>({id})));
  const layout=dealCycle(Math.floor(Math.random()*1e9),prev).map(l=>l.map(e=>e.id));   // new random mix
  await addCycle(addDays(fin,1),layout);
}

/* plan for day V → {today, pending, done, total, ...}  (null = use the old date-based plan) */
async function planCycle(V){
  if(CYC===null&&!(await loadCycles()))return null;
  if(!CYC.length)await createFirst();
  if(!CYC.length)return null;
  const T=todayStr();
  let logs=null;
  for(let i=0;i<4;i++){                                  // close finished cycles (normally 0 or 1)
    const cur=CYC[CYC.length-1];
    logs=await fetchLogs(cur.start_day,T);if(!logs)return null;
    const fin=completionDay(cur,logs);if(fin===null)break;
    await closeCycle(cur,fin);logs=null;
  }
  const cur=CYC[CYC.length-1];
  if(!logs){logs=await fetchLogs(cur.start_day,T);if(!logs)return null}
  const c=[...CYC].reverse().find(x=>x.start_day<=V);
  if(!c)return null;                                     // before the first cycle: old plan
  const slot=dayNum(V)-dayNum(c.start_day);
  const today=slot>=0&&slot<CYCLE?c.layout[slot].map(activeEx).filter(Boolean):[];
  const pending=[];
  if(V===T&&c===cur){
    const before=new Set(logs.filter(s=>s.day<T).map(s=>s.exercise_id));
    for(let k=0;k<CYCLE&&dayNum(c.start_day)+k<dayNum(T);k++)
      c.layout[k].forEach(id=>{const e=activeEx(id);if(e&&!before.has(id))pending.push({...e,pending:true})});
  }
  const ids=reqIds(cur),seen=new Set(logs.map(s=>s.exercise_id));
  return {today,pending,total:ids.length,done:ids.filter(id=>seen.has(id)).length,slot,finished:!!c.finished_day&&V===T};
}
/* after saving a workout: did that complete the cycle? */
async function cycleAfterSave(){
  if(!CYC||!CYC.length)return false;
  const cur=CYC[CYC.length-1],logs=await fetchLogs(cur.start_day,todayStr());
  if(!logs)return false;
  const fin=completionDay(cur,logs);if(fin===null)return false;
  await closeCycle(cur,fin);return true;
}

$("pendhead").onclick=()=>{const hidden=$("pendlist").classList.toggle("hide");$("pendhead").classList.toggle("open",!hidden)};