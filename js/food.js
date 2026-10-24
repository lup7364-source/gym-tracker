/* ============ FOOD & WATER ============
   Needs: app.js (helpers, db, user, modal). The food catalog lives in the Supabase table "foods". */
const MEALS=[["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snack","Snacks"]];
const GOALS0={kcal:2000,protein:0,water:2000};
let FD="",FLOG=[],WATER=0,GOALS={...GOALS0},FDB=[],FLOADED=false,AM="breakfast",RES=[],RECENT=[],CAT="recent";
const CATS={dairy:"Dairy & eggs",meat_fish:"Meat & fish",grains:"Grains & bread",legumes:"Legumes",vegetables:"Vegetables",fruit:"Fruit",nuts_oils:"Nuts & oils",sweets:"Sweets & snacks",drinks:"Drinks",prepared:"Prepared"};
const catLabel=k=>CATS[k]||(k.charAt(0).toUpperCase()+k.slice(1).replace(/_/g," "));
const r1=x=>Math.round(x*10)/10;
const norm=s=>String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const mealNow=()=>{const h=new Date().getHours();return h<11?"breakfast":h<16?"lunch":h<21?"dinner":"snack"};
const mealLabel=k=>(MEALS.find(m=>m[0]===k)||[])[1]||k;
const sumF=(a,f)=>a.reduce((s,x)=>s+Number(x[f]),0);
const fmtL=ml=>(Math.round(ml/10)/100)+" L";
const nut=(f,g)=>({kcal:Math.round(f.k*g/100),protein:r1(f.p*g/100),carbs:r1(f.c*g/100),fat:r1(f.f*g/100)});
const num0=v=>{const n=parseFloat(String(v).replace(",","."));return isNaN(n)?0:n};

function resetFood(){FLOADED=false;FDB=[];CAT="recent";GOALS={...GOALS0};FD="";FLOG=[];WATER=0}

/* ---------- Data ---------- */
function allFoods(){
  const rows=FDB.map(x=>({id:x.id,name:x.name,alias:x.alias||"",cat:x.category||"custom",k:Number(x.kcal100),p:Number(x.protein100),c:Number(x.carbs100),f:Number(x.fat100),serv:Number(x.serving)||100,mine:!!x.user_id}));
  const mine=new Set(rows.filter(r=>r.mine).map(r=>norm(r.name)));   // your own version replaces the built-in one
  return rows.filter(r=>r.mine||!mine.has(norm(r.name)));
}
function searchFoods(q){
  const t=norm(q).split(/\s+/).filter(Boolean);if(!t.length)return[];
  return allFoods().filter(f=>{const h=norm(f.name+" "+f.alias);return t.every(x=>h.includes(x))})
    .sort((a,b)=>((+!!b.mine)-(+!!a.mine))||((+norm(b.name).startsWith(t[0]))-(+norm(a.name).startsWith(t[0]))))
    .slice(0,40);
}
async function reloadFoods(){const r=await db.from("foods").select("*").order("name").limit(2000);if(!r.error)FDB=r.data||[];return !r.error}
async function loadFoodData(){
  const [g,fd]=await Promise.all([db.from("nutrition_goals").select("*").limit(1),db.from("foods").select("*").order("name").limit(2000)]);
  if(g.error||fd.error)return false;
  if(g.data&&g.data[0])GOALS={kcal:g.data[0].kcal,protein:g.data[0].protein||0,water:g.data[0].water};
  FDB=fd.data||[];return true;
}
async function loadRecents(){
  const {data}=await db.from("food_log").select("name,grams,kcal,protein,carbs,fat").gte("day",addDays(iso(new Date()),-30)).order("id",{ascending:false}).limit(300);
  const seen=new Set(),foods=allFoods();RECENT=[];
  (data||[]).forEach(x=>{
    if(seen.has(x.name)||RECENT.length>=12)return;seen.add(x.name);
    const g=Number(x.grams)||100,known=foods.find(f=>f.name===x.name);
    RECENT.push({...(known||{name:x.name,alias:"",k:r1(x.kcal/g*100),p:r1(x.protein/g*100),c:r1(x.carbs/g*100),f:r1(x.fat/g*100),serv:g}),last:g});
  });
}

/* ---------- Diary ---------- */
async function renderFood(){
  if(!FD)FD=iso(new Date());
  if(!FLOADED){
    if(!(await loadFoodData())){$("fmeals").innerHTML='<p class="mute">Couldn’t load. Did you run nutrition.sql in Supabase?</p>';return}
    FLOADED=true;
  }
  const day=FD;
  const [l,w]=await Promise.all([db.from("food_log").select("*").eq("day",day).order("id"),db.from("water").select("ml").eq("day",day).limit(1)]);
  if(day!==FD)return;
  FLOG=l.data||[];WATER=w.data&&w.data[0]?Number(w.data[0].ml):0;
  paintFood();
}
function paintFood(){
  const d=new Date(FD+"T12:00:00");
  $("fdate").textContent=FD===iso(new Date())?"Today":d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const k=sumF(FLOG,"kcal"),p=sumF(FLOG,"protein"),c=sumF(FLOG,"carbs"),f=sumF(FLOG,"fat"),left=GOALS.kcal-k;
  $("fk").textContent=Math.round(k)+" kcal";
  $("frl").textContent=left>=0?"Remaining":"Over by";
  $("fr").textContent=Math.abs(Math.round(left))+" kcal";$("fr").style.color=left>=0?"var(--ink)":"var(--red)";
  const ring=$("fring"),len=2*Math.PI*ring.getAttribute("r"),pc=GOALS.kcal?Math.min(k/GOALS.kcal,1):0;
  ring.style.strokeDasharray=pc>0?`${len*pc} ${len}`:`0 ${len}`;ring.style.opacity=pc>0?1:0;
  ring.setAttribute("stroke",left>=0?"var(--acc)":"var(--red)");
  $("fp").textContent=Math.round(p)+(GOALS.protein?"/"+GOALS.protein:"")+" g";
  $("fc").textContent=Math.round(c)+" g";$("ff").textContent=Math.round(f)+" g";
  $("wl").textContent=fmtL(WATER);$("wg").textContent="goal "+fmtL(GOALS.water);
  $("wbar").style.width=(GOALS.water?Math.min(WATER/GOALS.water,1)*100:0)+"%";
  $("fmeals").innerHTML=MEALS.map(([m,label])=>{
    const items=FLOG.filter(x=>x.meal===m);
    return `<div class="top2"><h2>${label} <span class="mute" style="font-size:16px;font-weight:500">${Math.round(sumF(items,"kcal"))} kcal</span></h2><button class="p" data-add="${m}">+ Add</button></div>
      <div class="card" style="padding:4px 16px">${items.length?items.map(x=>`<div class="frow" data-id="${x.id}" role="button" tabindex="0"><div><div style="font-weight:600">${esc(x.name)}</div><div class="meta" style="margin:0">${num0(x.grams)} g · P ${Math.round(x.protein)} · C ${Math.round(x.carbs)} · F ${Math.round(x.fat)}</div></div><b>${Math.round(x.kcal)}</b><span class="chev">›</span></div>`).join(""):'<p class="mute" style="margin:12px 0">Nothing yet.</p>'}</div>`;
  }).join("");
}
$("fprev").onclick=()=>{FD=addDays(FD||iso(new Date()),-1);renderFood()};
$("fnext").onclick=()=>{FD=addDays(FD||iso(new Date()),1);renderFood()};
$("fmeals").addEventListener("click",ev=>{
  const a=ev.target.closest("[data-add]");if(a){openAdd(a.dataset.add);return}
  const r=ev.target.closest(".frow");if(r)openEntry(+r.dataset.id);
});
$("fmeals").addEventListener("keydown",ev=>{if(ev.key==="Enter"){const r=ev.target.closest(".frow");if(r)openEntry(+r.dataset.id)}});

/* ---------- Water ---------- */
async function wAdd(delta){
  const v=Math.max(0,WATER+delta);if(v===WATER)return;
  const old=WATER;WATER=v;paintFood();
  const {error}=await db.from("water").upsert({user_id:user.id,day:FD,ml:v},{onConflict:"user_id,day"});
  if(error){WATER=old;paintFood();alert("Couldn’t save water. Try again.")}
}
$("wbtns").addEventListener("click",ev=>{
  const b=ev.target.closest("button");if(!b)return;
  if(b.dataset.w==="x"){const v=parseFloat(prompt("Water to add in ml (use a negative number to remove):","300"));if(v)wAdd(v)}
  else wAdd(+b.dataset.w);
});

/* ---------- Add food: search ---------- */
async function openAdd(meal,msg){
  AM=meal;
  const cats=["recent","mine",...[...new Set(allFoods().filter(x=>!x.mine).map(x=>x.cat))].sort((a,b)=>catLabel(a).localeCompare(catLabel(b)))];
  $("sheet").innerHTML=`<button class="x" id="mx" aria-label="Close">✕</button>
    <h1 style="font-size:30px;padding-top:56px;margin-bottom:12px">Add to ${mealLabel(meal)}</h1>
    ${msg?`<div class="meta" style="color:var(--acc);margin:0 0 10px">${esc(msg)}</div>`:""}
    <input id="fs" placeholder="Search food (rice, arroz, chicken…)" autocomplete="off" autocapitalize="none">
    <div class="cats" id="fcat">${cats.map(c=>`<button data-c="${c}" class="${c===CAT?"on":""}">${c==="recent"?"Recent":c==="mine"?"★ Mine":esc(catLabel(c))}</button>`).join("")}</div>
    <div id="fres"></div>
    <button id="fnew" style="width:100%;margin-top:10px;background:var(--card2)">+ Create new food</button>`;
  $("modal").classList.remove("hide");$("mx").onclick=closeModal;
  $("fnew").onclick=()=>openFoodForm(null);
  const show=()=>{
    const q=$("fs").value.trim();let head="";
    if(q){RES=searchFoods(q);if(!RES.length)head='<p class="mute">No match. Create it below.</p>'}
    else if(CAT==="recent"){RES=RECENT;head=RES.length?"":'<div class="meta">Type to search, or pick a category.</div>'}
    else if(CAT==="mine"){RES=allFoods().filter(x=>x.mine);head=RES.length?"":'<div class="meta">Foods you create show up here.</div>'}
    else RES=allFoods().filter(x=>x.cat===CAT);
    $("fres").innerHTML=head+RES.map((x,i)=>`<div class="frow" data-i="${i}" role="button" tabindex="0"><div><div style="font-weight:600">${x.mine?"★ ":""}${esc(x.name)}</div><div class="meta" style="margin:0">${Math.round(x.k)} kcal / 100 g${x.last?` · last ${x.last} g`:""}</div></div><span class="chev">›</span></div>`).join("");
  };
  $("fs").oninput=show;
  $("fcat").onclick=ev=>{const b=ev.target.closest("button");if(!b)return;CAT=b.dataset.c;[...$("fcat").children].forEach(x=>x.classList.toggle("on",x===b));show()};
  $("fres").onclick=ev=>{const r=ev.target.closest(".frow");if(r)openAmount(RES[+r.dataset.i],{meal})};
  show();loadRecents().then(()=>{if($("fs")&&!$("fs").value.trim())show()});
  setTimeout(()=>{const s=$("fs");if(s)s.focus()},60);
}

/* ---------- Add food: grams ---------- */
function openAmount(food,o={}){
  const en=o.entry;let meal=en?en.meal:(o.meal||AM||mealNow());
  const g0=en?num0(en.grams):(food.last||food.serv||100);
  const chips=[50,100,150,200];if(food.serv&&!chips.includes(Number(food.serv)))chips.push(Number(food.serv));
  $("sheet").innerHTML=`<button class="x" id="mx" aria-label="Close">✕</button>
    <h1 style="font-size:28px;padding-top:56px">${esc(food.name)}</h1>
    <div class="meta">${Math.round(food.k)} kcal · P ${r1(food.p)} · C ${r1(food.c)} · F ${r1(food.f)} per 100 g</div>
    <label class="fld"><span>Amount (grams)</span><input id="fgr" inputmode="decimal" value="${g0}" style="font-size:28px;text-align:center"></label>
    <div class="chips" id="fch">${chips.sort((a,b)=>a-b).map(c=>`<button data-g="${c}">${c} g${c===Number(food.serv)&&food.serv!==100?" · serving":""}</button>`).join("")}</div>
    <div class="card stats4" id="fpv"></div>
    <div class="seg" id="fmeal">${MEALS.map(([m,l])=>`<button data-m="${m}" class="${m===meal?"on":""}">${l}</button>`).join("")}</div>
    <button class="p" id="fok" style="width:100%;padding:14px;margin-top:14px">${en?"Save":"Add"}</button>
    ${en?'<button class="danger" id="fdel2">Delete entry</button>':""}
    ${!en&&food.id?(food.mine?'<div class="two" style="margin-top:10px"><button id="fedit">Edit food</button><button id="fdelfood" style="color:var(--red)">Delete food</button></div>':'<button id="fedit" style="width:100%;margin-top:10px">Make my own version</button>'):""}`;
  $("modal").classList.remove("hide");$("mx").onclick=closeModal;
  const pv=()=>{
    const g=num0($("fgr").value),n=nut(food,g);
    $("fpv").innerHTML=`<div><b style="color:var(--acc)">${n.kcal}</b><span>kcal</span></div><div><b style="color:var(--red)">${n.protein}</b><span>protein</span></div><div><b>${n.carbs}</b><span>carbs</span></div><div><b style="color:var(--cyan)">${n.fat}</b><span>fat</span></div>`;
  };
  pv();$("fgr").oninput=pv;
  $("fch").onclick=ev=>{const b=ev.target.closest("button");if(b){$("fgr").value=b.dataset.g;pv()}};
  $("fmeal").onclick=ev=>{const b=ev.target.closest("button");if(!b)return;meal=b.dataset.m;[...$("fmeal").children].forEach(x=>x.classList.toggle("on",x===b))};
  $("fgr").addEventListener("keydown",ev=>{if(ev.key==="Enter")$("fok").click()});
  $("fok").onclick=async()=>{
    const g=num0($("fgr").value);if(!(g>0)){$("fgr").focus();return}
    $("fok").textContent="Saving…";
    const n=nut(food,g);
    const res=en?await db.from("food_log").update({meal,grams:g,...n}).eq("id",en.id)
                :await db.from("food_log").insert({user_id:user.id,day:FD,meal,name:food.name,grams:g,...n});
    if(res.error){$("fok").textContent="Couldn’t save. Try again.";return}
    await renderFood();
    if(en)closeModal();else{AM=meal;openAdd(meal,`Added ${food.name} · ${g} g ✓`)}
  };
  if(en)$("fdel2").onclick=async()=>{
    if(!confirm("Delete this entry?"))return;
    await db.from("food_log").delete().eq("id",en.id);await renderFood();closeModal();
  };
  if($("fedit"))$("fedit").onclick=()=>openFoodForm(food);
  if($("fdelfood"))$("fdelfood").onclick=async()=>{
    if(!confirm(`Delete “${food.name}” from your foods? Past entries stay in your diary.`))return;
    await db.from("foods").delete().eq("id",food.id);await reloadFoods();openAdd(meal);
  };
}
function openEntry(id){
  const e=FLOG.find(x=>x.id===id);if(!e)return;
  const g=Number(e.grams)||100;
  openAmount({name:e.name,k:e.kcal/g*100,p:e.protein/g*100,c:e.carbs/g*100,f:e.fat/g*100,serv:g},{entry:e});
}

/* ---------- Create / edit your own food ---------- */
function openFoodForm(food){
  const f=food||{name:$("fs")?$("fs").value.trim():"",k:"",p:"",c:"",f:"",serv:""};
  $("sheet").innerHTML=`<button class="x" id="mx" aria-label="Close">✕</button>
    <h1 style="font-size:28px;padding-top:56px;margin-bottom:6px">${food?(food.mine?"Edit food":"My version"):"New food"}</h1>
    <div class="meta">Enter the values per 100 g, like on the package label.</div>
    <label class="fld"><span>Name</span><input id="nn" value="${esc(f.name)}"></label>
    <div class="two">
      <label class="fld"><span>Calories (kcal)</span><input id="nk" inputmode="decimal" value="${f.k}"></label>
      <label class="fld"><span>Protein (g)</span><input id="np" inputmode="decimal" value="${f.p}"></label>
    </div>
    <div class="two">
      <label class="fld"><span>Carbs (g)</span><input id="nc" inputmode="decimal" value="${f.c}"></label>
      <label class="fld"><span>Fat (g)</span><input id="nf" inputmode="decimal" value="${f.f}"></label>
    </div>
    <label class="fld"><span>Typical serving in grams (optional)</span><input id="ns" inputmode="decimal" value="${f.serv===100?"":f.serv}"></label>
    <div class="err" id="nerr"></div>
    <button class="p" id="nsave" style="width:100%;padding:14px">Save food</button>`;
  $("modal").classList.remove("hide");$("mx").onclick=closeModal;
  $("nsave").onclick=async()=>{
    const name=$("nn").value.trim();
    if(!name){$("nerr").textContent="Give it a name.";return}
    if($("nk").value.trim()===""){$("nerr").textContent="Enter the calories per 100 g.";return}
    const row={name,alias:food&&food.alias||"",category:food&&food.cat&&food.mine?food.cat:"custom",kcal100:num0($("nk").value),protein100:num0($("np").value),carbs100:num0($("nc").value),fat100:num0($("nf").value),serving:num0($("ns").value)||null};
    $("nsave").textContent="Saving…";
    const res=food&&food.id&&food.mine?await db.from("foods").update(row).eq("id",food.id):await db.from("foods").insert({user_id:user.id,...row});
    if(res.error){$("nerr").textContent=res.error.code==="23505"?"You already have a food with that name.":"Couldn’t save. Try again.";$("nsave").textContent="Save food";return}
    await reloadFoods();
    openAmount(allFoods().find(x=>x.mine&&x.name===name),{meal:AM});
  };
}

/* ---------- Goals ---------- */
$("fgoal").onclick=()=>{
  $("sheet").innerHTML=`<button class="x" id="mx" aria-label="Close">✕</button>
    <h1 style="font-size:28px;padding-top:56px;margin-bottom:12px">Daily goals</h1>
    <label class="fld"><span>Calories (kcal)</span><input id="gk" inputmode="numeric" value="${GOALS.kcal}"></label>
    <label class="fld"><span>Protein (g). 0 = no goal</span><input id="gp" inputmode="numeric" value="${GOALS.protein}"></label>
    <label class="fld"><span>Water (ml)</span><input id="gw" inputmode="numeric" value="${GOALS.water}"></label>
    <div class="err" id="gerr"></div>
    <button class="p" id="gsave" style="width:100%;padding:14px">Save goals</button>`;
  $("modal").classList.remove("hide");$("mx").onclick=closeModal;
  $("gsave").onclick=async()=>{
    const g={kcal:Math.round(num0($("gk").value)),protein:Math.round(num0($("gp").value)),water:Math.round(num0($("gw").value))};
    if(g.kcal<=0||g.water<=0){$("gerr").textContent="Calories and water must be above 0.";return}
    const {error}=await db.from("nutrition_goals").upsert({user_id:user.id,...g},{onConflict:"user_id"});
    if(error){$("gerr").textContent="Couldn’t save. Try again.";return}
    GOALS=g;paintFood();closeModal();
  };
};