/* ============ CALORIE DEFICIT ============
   Needs: app.js + food.js. These are ESTIMATES:
   burned = daily baseline (without exercise) + strength training + cardio
   deficit = burned − eaten                                                        */
const KCAL_PER_KG=7700;      // ≈ kcal in 1 kg of body weight change
const ACTIVITY=1.2;          // baseline = BMR × 1.2 (daily life, no exercise)
const MIN_PER_SET=2.5;       // minutes of strength work per logged set (incl. rest)
const STRENGTH_MET=5;        // weight lifting, vigorous effort
const MET={run:[6,8.3,10,11.5],bike:[3.5,6.8,8.8,11]};   // by intensity band: 1–3, 4–6, 7–8, 9–10
const band=i=>i<=3?0:i<=6?1:i<=8?2:3;
let DRANGE=14,DD=[],LASTKG=0;
const fmtN=n=>Math.round(n).toLocaleString("en-US");
const dLabel=d=>d.slice(5).replace("-","/");

/* ---------- Calorie math ---------- */
function cardioKcal(c,kg){
  const min=Number(c.minutes),km=Number(c.km);
  if(c.kind==="run"&&km>0)return Math.round(kg*km);                       // ≈ 1 kcal per kg per km
  const met=(MET[c.kind]||MET.run)[band(Number(c.intensity))];
  return Math.round((met-1)*kg*min/60);                                    // net of resting (the baseline already counts it)
}
const strengthKcal=(sets,kg)=>Math.round((STRENGTH_MET-1)*kg*sets*MIN_PER_SET/60);
const bmr=(p,kg)=>10*kg+6.25*p.height-5*p.age+(p.sex==="female"?-161:5);  // Mifflin-St Jeor
function baseKcal(kg){
  if(PROFILE.baseline)return Number(PROFILE.baseline);
  return PROFILE.age&&PROFILE.height&&kg?Math.round(bmr(PROFILE,kg)*ACTIVITY):0;
}
function kgFor(day,ws){                                                    // latest weekly weigh-in on or before that day
  let w=null;for(const x of ws){if(x.week_start<=day)w=Number(x.weight);else break}
  if(w===null&&ws.length)w=Number(ws[0].weight);
  return w||PROFILE.weight||0;
}
function buildDays(food,sets,cardio,ws,n){
  const today=iso(new Date()),out=[];
  for(let i=n-1;i>=0;i--){
    const day=addDays(today,-i),fo=food.filter(x=>x.day===day),kg=kgFor(day,ws),base=baseKcal(kg);
    const nSets=sets.filter(x=>x.day===day).length,cs=cardio.filter(x=>x.day===day);
    const sK=kg?strengthKcal(nSets,kg):0,cK=kg?cs.reduce((a,x)=>a+cardioKcal(x,kg),0):0;
    const eaten=sumF(fo,"kcal"),burned=base+sK+cK,logged=fo.length>0;
    out.push({day,logged,eaten,p:sumF(fo,"protein"),c:sumF(fo,"carbs"),f:sumF(fo,"fat"),kg,base,nSets,sK,cK,cMin:cs.reduce((a,x)=>a+Number(x.minutes),0),burned,
      deficit:logged&&base?burned-eaten:null,today:day===today});
  }
  return out;
}
async function pageAll(make){
  let all=[];
  for(let from=0;;from+=1000){
    const {data,error}=await make().range(from,from+999);
    if(error)return null;
    all=all.concat(data||[]);if(!data||data.length<1000)break;
  }
  return all;
}

/* ---------- Charts (inline SVG, follow the theme colors) ---------- */
function chartLines(D){
  const W=340,H=180,L=40,R=10,T=12,B=26,pw=W-L-R,ph=H-T-B,vals=[];
  D.forEach(d=>{if(d.base)vals.push(d.burned);if(d.logged)vals.push(d.eaten)});if(GOALS.kcal)vals.push(GOALS.kcal);
  if(!vals.length)return'<p class="mute" style="margin:0">Nothing to chart yet.</p>';
  const step=500,lo=Math.max(0,Math.floor((Math.min(...vals)-150)/step)*step);let hi=Math.ceil((Math.max(...vals)+150)/step)*step;if(hi<=lo)hi=lo+step;
  const x=i=>L+(D.length===1?pw/2:i*pw/(D.length-1)),y=v=>T+ph-(v-lo)/(hi-lo)*ph;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories eaten versus burned">`;
  for(let v=lo;v<=hi;v+=step)s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
  if(GOALS.kcal)s+=`<line x1="${L}" x2="${W-R}" y1="${y(GOALS.kcal)}" y2="${y(GOALS.kcal)}" stroke="var(--mute)" stroke-dasharray="4 4"/>`;
  const runs=(key,ok)=>{const out=[];let cur=[];D.forEach((d,i)=>{if(ok(d))cur.push(x(i)+","+y(d[key]));else{if(cur.length)out.push(cur);cur=[]}});if(cur.length)out.push(cur);return out};
  runs("burned",d=>d.base>0).forEach(r=>s+=`<polyline fill="none" stroke="var(--cyan)" stroke-width="2.5" stroke-linejoin="round" points="${r.join(" ")}"/>`);
  runs("eaten",d=>d.logged).forEach(r=>s+=`<polyline fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" points="${r.join(" ")}"/>`);
  D.forEach((d,i)=>{
    if(d.base)s+=`<circle cx="${x(i)}" cy="${y(d.burned)}" r="3" fill="var(--cyan)"/>`;
    if(d.logged)s+=`<circle cx="${x(i)}" cy="${y(d.eaten)}" r="3.5" fill="${d.today?"var(--card)":"var(--acc)"}" stroke="var(--acc)" stroke-width="2"/>`;
  });
  const every=Math.ceil(D.length/7);
  D.forEach((d,i)=>{if(i===D.length-1||(i%every===0&&D.length-1-i>=Math.ceil(every/2)))s+=`<text x="${x(i)}" y="${H-8}" text-anchor="middle">${dLabel(d.day)}</text>`});
  D.forEach((d,i)=>{const bw=pw/Math.max(D.length-1,1);s+=`<rect class="hit" data-i="${i}" x="${x(i)-bw/2}" y="${T}" width="${bw}" height="${ph}" fill="transparent"/>`});
  return s+"</svg>";
}
function chartBars(D){
  const W=340,H=170,L=40,R=10,T=16,B=26,pw=W-L-R,ph=H-T-B,ds=D.filter(d=>d.deficit!==null).map(d=>d.deficit);
  if(!ds.length)return'<p class="mute" style="margin:0">Log what you eat to see your daily deficit here.</p>';
  let hi=Math.max(0,...ds),lo=Math.min(0,...ds);const step=(hi-lo)>2000?500:250;
  hi=Math.ceil((hi+1)/step)*step;lo=lo<0?Math.floor(lo/step)*step:0;
  const y=v=>T+ph-(v-lo)/(hi-lo)*ph,y0=y(0),bw=pw/D.length;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily calorie deficit">`;
  for(let v=lo;v<=hi;v+=step)s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="${v===0?"var(--mute)":"var(--line)"}"/><text x="${L-6}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
  D.forEach((d,i)=>{
    const cx=L+bw*i+bw/2;
    if(d.deficit!==null){
      const v=d.deficit,top=Math.min(y(v),y0),h=Math.max(Math.abs(y(v)-y0),1);
      s+=`<rect x="${cx-bw*0.3}" y="${top}" width="${bw*0.6}" height="${h}" rx="3" fill="${v>=0?"var(--acc)":"var(--red)"}" opacity="${d.today?0.45:1}"/>`;
      if(D.length<=14)s+=`<text x="${cx}" y="${v>=0?top-3:top+h+10}" text-anchor="middle" style="fill:var(--ink)">${Math.round(v)}</text>`;
    }
    s+=`<rect class="hit" data-i="${i}" x="${cx-bw/2}" y="${T}" width="${bw}" height="${ph}" fill="transparent"/>`;
  });
  const every=Math.ceil(D.length/7);
  D.forEach((d,i)=>{if(i===D.length-1||(i%every===0&&D.length-1-i>=Math.ceil(every/2)))s+=`<text x="${L+bw*i+bw/2}" y="${H-8}" text-anchor="middle">${dLabel(d.day)}</text>`});
  return s+"</svg>";
}
function showDetail(i){
  const d=DD[i];if(!d)return;
  $("ddetail").innerHTML=`<b style="color:var(--ink)">${dLabel(d.day)}${d.today?" (today, so far)":""}</b> · Eaten ${d.logged?fmtN(d.eaten)+" kcal":"nothing logged"} · Burned ${d.base?fmtN(d.burned)+" kcal":"—"}`+
    (d.base?` <span>(rest ${fmtN(d.base)} + strength ${fmtN(d.sK)} + cardio ${fmtN(d.cK)})</span>`:"")+
    (d.deficit!==null?` · <b style="color:${d.deficit>=0?"var(--acc)":"var(--red)"}">${d.deficit>=0?"Deficit":"Surplus"} ${fmtN(Math.abs(d.deficit))}</b>`:"");
}

/* ---------- Screen ---------- */
async function renderDeficit(){
  const today=iso(new Date()),start=addDays(today,-(DRANGE-1)),rng=q=>q.gte("day",start).lte("day",today);
  const [food,sets,cardio,wr]=await Promise.all([
    pageAll(()=>rng(db.from("food_log").select("day,kcal,protein,carbs,fat"))),
    pageAll(()=>rng(db.from("sets").select("day"))),
    pageAll(()=>rng(db.from("cardio").select("day,kind,minutes,km,intensity"))),
    db.from("body_weights").select("week_start,weight").order("week_start")
  ]);
  if(!food||!sets||!cardio){$("drec").innerHTML='<p class="mute" style="margin:0">Couldn’t load your data. Did you run the latest SQL?</p>';return}
  const ws=(wr&&wr.data)||[];LASTKG=kgFor(today,ws);
  DD=buildDays(food,sets,cardio,ws,DRANGE);
  const t=DD[DD.length-1],ready=baseKcal(LASTKG)>0;

  /* recommended intake */
  const macros=[["Protein",GOALS.protein,4,t.p,"var(--red)"],["Fat",GOALS.fat,9,t.f,"var(--cyan)"],["Carbs",GOALS.carbs,4,t.c,"var(--acc)"]];
  $("drec").innerHTML=`<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px"><b style="font-size:30px;letter-spacing:-.5px">${fmtN(GOALS.kcal)} kcal</b><span class="mute">recommended per day</span></div>`+
    macros.map(([n,g,k,e,col])=>g?`<div class="mac"><div class="h"><span><b style="color:${col}">${n}</b></span><span>${fmtN(g*k)} kcal · ${g} g</span></div>
      <div class="pbar"><i style="width:${Math.min(e/g,1)*100}%;background:${col}"></i></div><div class="meta" style="margin:0">Today: ${Math.round(e)} g (${fmtN(e*k)} kcal)</div></div>`:"").join("")+
    `<div class="meta" style="margin:10px 0 0">Change these numbers in Diary → Goals.</div>`;

  /* today */
  if(!ready){
    $("dtoday").innerHTML=`<p style="margin:0 0 12px">To estimate your deficit I need your age, height and weight.</p><button class="p" id="dset2" style="width:100%;padding:14px">Set up my details</button>`;
  }else{
    const def=t.deficit;
    $("dtoday").innerHTML=`<div class="stats3">
      <div><b style="color:var(--acc)">${fmtN(t.eaten)}</b><span>Eaten</span></div>
      <div><b style="color:var(--cyan)">${fmtN(t.burned)}</b><span>Burned</span></div>
      <div><b style="color:${def===null?"var(--mute)":def>=0?"var(--acc)":"var(--red)"}">${def===null?"—":fmtN(Math.abs(def))}</b><span>${def===null?"Log meals":def>=0?"Deficit so far":"Surplus"}</span></div></div>
      <div class="meta" style="margin:12px 0 0">Burned = ${fmtN(t.base)} baseline + ${fmtN(t.sK)} strength (${t.nSets} sets) + ${fmtN(t.cK)} cardio (${Math.round(t.cMin)} min)${LASTKG?"":". Add your weight to count exercise"}</div>`;
  }

  /* charts + totals */
  $("dleg").innerHTML=`<span><i style="background:var(--acc)"></i>Eaten</span><span><i style="background:var(--cyan)"></i>Burned</span><span><i style="background:var(--mute)"></i>Recommended</span>`;
  $("dchart1").innerHTML=chartLines(DD);
  $("dchart2").innerHTML=ready?chartBars(DD):'<p class="mute" style="margin:0">Set up your details to see the deficit chart.</p>';
  const done=DD.filter(d=>!d.today&&d.deficit!==null),tot=done.reduce((a,d)=>a+d.deficit,0);
  $("dsum").innerHTML=!ready?"":done.length?`<div class="stats3">
      <div><b style="color:${tot>=0?"var(--acc)":"var(--red)"}">${tot>=0?"":"−"}${fmtN(Math.abs(tot))}</b><span>${tot>=0?"Total deficit":"Total surplus"}</span></div>
      <div><b>${fmtN(tot/done.length)}</b><span>Avg per day</span></div>
      <div><b>${(tot/KCAL_PER_KG).toFixed(2)} kg</b><span>≈ body change</span></div></div>
      <div class="meta" style="margin:12px 0 0">${done.length} complete day${done.length>1?"s":""} with meals logged. Today isn’t counted until it’s over.</div>`
    :'<p class="mute" style="margin:0">Log your meals for a full day and the totals show up here.</p>';
  const last=[...DD].reverse().findIndex(d=>d.deficit!==null);showDetail(last<0?DD.length-1:DD.length-1-last);
}

/* ---------- Interaction ---------- */
$("fdef").addEventListener("click",ev=>{
  const hit=ev.target.closest(".hit");if(hit){showDetail(+hit.dataset.i);return}
  if(ev.target.closest("#dset")||ev.target.closest("#dset2"))openDetails();
});
$("drange").addEventListener("click",ev=>{
  const b=ev.target.closest("button");if(!b)return;
  DRANGE=+b.dataset.n;[...$("drange").children].forEach(x=>x.classList.toggle("on",x===b));renderDeficit();
});

function openDetails(){
  const p=PROFILE;
  $("sheet").innerHTML=`<button class="x" id="mx" aria-label="Close">✕</button>
    <h1 style="font-size:28px;padding-top:56px;margin-bottom:6px">My details</h1>
    <div class="meta">Used to estimate the calories you burn each day. These are estimates, not medical advice.</div>
    <div class="two">
      <label class="fld"><span>Age</span><input id="dpa" inputmode="numeric" value="${p.age||""}"></label>
      <label class="fld"><span>Height (cm)</span><input id="dph" inputmode="decimal" value="${p.height||""}"></label>
    </div>
    <div class="two">
      <label class="fld"><span>Weight (kg)</span><input id="dpw" inputmode="decimal" value="${p.weight||LASTKG||""}"></label>
      <label class="fld"><span>Sex</span><select id="dps"><option value="male" ${p.sex!=="female"?"selected":""}>Male</option><option value="female" ${p.sex==="female"?"selected":""}>Female</option></select></label>
    </div>
    <label class="fld"><span>Daily burn without exercise, in kcal (optional)</span><input id="dpb" inputmode="numeric" value="${p.baseline||""}" placeholder="Leave empty to estimate"></label>
    <div class="meta" id="dpest"></div>
    <div class="err" id="dperr"></div>
    <button class="p" id="dpsave" style="width:100%;padding:14px">Save</button>`;
  $("modal").classList.remove("hide");$("mx").onclick=closeModal;
  const read=()=>({age:Math.round(num0($("dpa").value))||null,height:num0($("dph").value)||null,weight:num0($("dpw").value)||null,sex:$("dps").value,baseline:Math.round(num0($("dpb").value))||null});
  const est=()=>{
    const q=read(),kg=LASTKG||q.weight;
    $("dpest").textContent=q.age&&q.height&&kg?`Estimated baseline: ${fmtN(bmr(q,kg)*ACTIVITY)} kcal/day (resting ${fmtN(bmr(q,kg))} × ${ACTIVITY}). Your weekly weigh-ins override the weight above.`:"Fill in age, height and weight to see the estimate.";
  };
  est();["dpa","dph","dpw","dps"].forEach(id=>$(id).oninput=est);
  $("dpsave").onclick=async()=>{
    const q=read();
    if(!q.baseline&&!(q.age&&q.height&&(q.weight||LASTKG))){$("dperr").textContent="Enter age, height and weight, or your daily burn.";return}
    $("dpsave").textContent="Saving…";PROFILE=q;
    const {error}=await saveSettings();
    if(error){$("dperr").textContent="Couldn’t save. Did you run the latest SQL?";$("dpsave").textContent="Save";return}
    closeModal();renderDeficit();
  };
}