/* 맑은사주 v4 — TDS 뼈대 × 오행 5색 × 공유 카드
 * 화면 순서(심리 동선): 공유 카드(정체성) → 한 줄 총평 + Do/Don't → 오행 지도
 * → 명식(계산 공개) → 대운 → 다섯 가지 질문(무료 요약) → 심층 리포트 → 대화·궁합
 */
"use strict";

const CITIES = [
  {name:"모름 / 기타 (한국 중부)", lon:127.5},
  {name:"서울", lon:126.98},{name:"인천·부천", lon:126.7},{name:"수원·성남", lon:127.0},
  {name:"대전", lon:127.38},{name:"대구", lon:128.6},{name:"부산", lon:129.07},
  {name:"울산", lon:129.31},{name:"광주", lon:126.85},{name:"전주", lon:127.15},
  {name:"청주", lon:127.49},{name:"춘천", lon:127.73},{name:"강릉", lon:128.9},
  {name:"제주", lon:126.53},{name:"창원", lon:128.68},{name:"천안", lon:127.15},
  {name:"포항", lon:129.36},{name:"목포", lon:126.39},{name:"여수", lon:127.66},{name:"원주", lon:127.95}
];
const ELEM_COLOR = {"목":"#4E8A66","화":"#C25450","토":"#C29A4B","금":"#8A8F98","수":"#4A6B8A"};
// 다크 표면(#191F28)용 밝은 변형 — 공유 카드·캔버스에서 오행색이 살아나도록
const ELEM_COLOR_DARK = {"목":"#6FBF8F","화":"#E8837E","토":"#E0B968","금":"#AEB4BE","수":"#7DA3C8"};
const ELEM_HAN = {"목":"木","화":"火","토":"土","금":"金","수":"水"};

const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(_e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(_e){} }
};
let MODE = store.get("sajuMode") || "easy";
let LAST = null;

window.addEventListener("error", ev=>{
  try{
    const b=document.createElement("div");
    b.style.cssText="position:fixed;top:0;left:0;right:0;background:#F04452;color:#fff;padding:8px 12px;font-size:12px;z-index:999;word-break:break-all";
    b.textContent="오류: "+(ev.message||ev.error)+" @"+(ev.lineno||"?");
    document.body.appendChild(b);
  }catch(_e){}
});

function initApp(){
  const citySel = document.getElementById("city");
  if (!citySel || citySel.options.length>0) return;
  CITIES.forEach((c,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=c.name; citySel.appendChild(o); });
  document.getElementById("saju-form").addEventListener("submit", onSubmit);
  document.getElementById("hour-unknown").addEventListener("change", e=>{
    document.getElementById("hour").disabled = e.target.checked;
    document.getElementById("minute").disabled = e.target.checked;
  });
  document.querySelectorAll(".mode-btn").forEach(b=>b.addEventListener("click", ()=>{
    MODE=b.dataset.mode; store.set("sajuMode",MODE); updateModeButtons(); if(LAST) render(LAST);
  }));
  updateModeButtons();
  window.addEventListener("scroll", updateProgress, {passive:true});
  const q = new URLSearchParams(location.search);
  if (q.get("y")){
    document.getElementById("year").value=q.get("y");
    document.getElementById("month").value=q.get("mo");
    document.getElementById("day").value=q.get("d");
    if(q.get("h")!==null && q.get("h")!==""){ document.getElementById("hour").value=q.get("h"); document.getElementById("minute").value=q.get("mi")||0; }
    else { document.getElementById("hour-unknown").checked=true; document.getElementById("hour").disabled=true; document.getElementById("minute").disabled=true; }
    document.getElementById("gender").value=q.get("g")||"F";
    document.getElementById("city").value=q.get("c")||0;
    document.getElementById("saju-form").requestSubmit();
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initApp);
else initApp();

function updateModeButtons(){
  document.querySelectorAll(".mode-btn").forEach(b=>b.classList.toggle("active", b.dataset.mode===MODE));
}
function updateProgress(){
  const res = document.getElementById("result");
  const bar = document.getElementById("read-progress");
  if (!bar || res.classList.contains("hidden")) return;
  const rect = res.getBoundingClientRect();
  const total = rect.height - window.innerHeight;
  const done = Math.min(Math.max(-rect.top, 0), Math.max(total,1));
  bar.style.width = (total>0 ? (done/total*100) : 0) + "%";
}

function formError(msg){
  const form=document.getElementById("saju-form");
  let el=form.querySelector(".field-msg");
  if(!msg){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement("p"); el.className="field-msg"; form.insertBefore(el, form.querySelector("button[type=submit]")); }
  el.textContent=msg;
}
function onSubmit(e){
  e.preventDefault();
  const y=+document.getElementById("year").value, m=+document.getElementById("month").value, d=+document.getElementById("day").value;
  const hourUnknown=document.getElementById("hour-unknown").checked;
  const h=hourUnknown?null:+document.getElementById("hour").value;
  const mi=hourUnknown?null:+document.getElementById("minute").value;
  const g=document.getElementById("gender").value, ci=+document.getElementById("city").value;
  if (!y||!m||!d||y<1900||y>2050){ formError("생년월일을 확인해 주세요 (1900~2050년)"); return; }
  const dt=new Date(y,m-1,d);
  if (dt.getMonth()!==m-1||dt.getDate()!==d){ formError("존재하지 않는 날짜예요"); return; }
  if (!hourUnknown && (isNaN(h)||h<0||h>23)){ formError("태어난 시를 입력하거나 '시간 모름'을 선택해 주세요"); return; }
  formError(null);
  const input={year:y,month:m,day:d,hour:h??12,minute:mi??0,hourUnknown,gender:g,longitude:CITIES[ci].lon,placeName:CITIES[ci].name};
  LAST=computeSaju(input);
  render(LAST);
  const params=new URLSearchParams({y,mo:m,d,g,c:ci});
  if(!hourUnknown){ params.set("h",h); params.set("mi",mi); }
  try{ history.replaceState(null,"","?"+params.toString()); }catch(_e){}
  document.getElementById("result").scrollIntoView({behavior:"smooth"});
}

function T(o){ return o[MODE]||o.easy; }
function gz(p){ return STEMS[p.stem]+BRANCHES[p.branch]; }
function gzKo(p){ return STEMS_KO[p.stem]+BRANCHES_KO[p.branch]; }
function gzDisp(stem,branch){
  return MODE==="easy" ? STEMS_KO[stem]+BRANCHES_KO[branch] : STEMS[stem]+BRANCHES[branch];
}
function sect(title, badge, inner, id){
  return `<section class="sect"${id?` id="${id}"`:""}>
    <div class="sect-head"><h2>${title}</h2>${badge?`<span class="badge ${badge==="계산"?"badge-calc":"badge-interp"}">${badge}</span>`:""}</div>
    ${inner}
  </section>`;
}

/* 구조에서 Do/Don't 도출 — 짧고 이 사주 전용 */
function doDontLists(P){
  const keys = godStructures(P).map(s=>s.key);
  const {g, grp} = godCounts(P);
  const cnt = elementCount(P);
  const dos=[], donts=[];
  const addDo=t=>{ if(dos.length<4 && !dos.includes(t)) dos.push(t); };
  const addDont=t=>{ if(donts.length<4 && !donts.includes(t)) donts.push(t); };
  if(keys.includes("식신생재")) addDo("한 우물 전문성 — 그대로 수입이 돼요");
  if(keys.includes("상관생재")){ addDo("아이디어·기획으로 승부하기"); addDont("잘 벌 때 번 만큼 바로 쓰기 — 수입 오르내림이 커요"); }
  if(keys.includes("상관견관")) addDont("윗사람 앞에서 바로 받아치기");
  if(keys.includes("재다신약")){ addDo("조직·자격에 기대 큰돈 다루기"); addDont("혼자 큰돈 떠안기"); }
  if(keys.includes("군겁쟁재")) addDont("동업·보증·지인 돈거래");
  if(keys.includes("관살태과")) addDo("압박은 자격·공부로 소화하기");
  if(keys.includes("관인상생")||keys.includes("살인상생")) addDo("자격을 무기로 조직에서 올라가기");
  if(keys.includes("무인성")) addDo("자격증 하나 의식적으로 챙기기");
  if(keys.includes("도식")) addDo("배운 건 꺼내서 결과물로 만들기");
  if(keys.includes("식상제살")) addDo("시련은 실력으로 되받아치기");
  if(grp["식상"]>=3) addDont("쉼 없이 달리기 — 방전이 빨라요");
  if((g["편재"]||0)>=2) addDo("월급날 자동저축 걸어두기");
  const lackDo={"목":"계획 세우고 천천히 시작하기","화":"나를 드러내는 연습","토":"루틴·안정 장치 만들기","금":"거절과 마무리 연습","수":"휴식·수분·수면 챙기기"};
  Object.entries(cnt).filter(([,v])=>v===0).forEach(([e])=>{ if(lackDo[e]) addDo(lackDo[e]); });
  // 폴백도 이 사주의 우세 기운 기반 (바넘 금지)
  const domG=Object.entries(grp).sort((a,b)=>b[1]-a[1])[0][0];
  const domDo={"비겁":"내 이름 걸고 하는 일 늘리기","식상":"결과물을 만들어 내보이기","재성":"숫자로 성과가 보이는 일 맡기","관성":"체계 있는 조직에서 승부하기","인성":"자격·공부에 먼저 투자하기"};
  const domDont={"비겁":"동업으로 돈 섞기","식상":"말이 앞서는 약속","재성":"들어온 만큼 쓰는 소비","관성":"모든 책임 혼자 떠안기","인성":"생각만 하고 실행 미루기"};
  if(!dos.length) addDo(domDo[domG]);
  if(!donts.length) addDont(domDont[domG]);
  return {dos, donts};
}

function render(r){
  const el=document.getElementById("result");
  el.classList.remove("hidden");
  document.getElementById("progress-wrap").classList.remove("hidden");
  const P=r.pillars, ds=P.day.stem;
  const season=seasonOfMonthIdx(r.monthIdx);
  const dm=DAY_MASTER_TEXT[STEMS[ds]];
  const label=CHAR_LABELS[STEMS[ds]][season];
  const hapStem=STEM_HAP[STEMS[ds]];
  const hapTitle=DAY_MASTER_TEXT[hapStem].title;
  const motherElem=ELEM_MOTHER[STEM_ELEM[ds]];
  const nowYear=new Date().getFullYear();
  const posOrder=[["year","연주"],["month","월주"],["day","일주"],["hour","시주"]];

  /* ── 1. 공유 카드 (스크린샷 = 완성된 공유물) ── */
  const idCard=`
  <section class="id-card" id="talisman">
    <div class="id-season">${SEASON_NAMES[season]} · ${r.sajuYear}년생</div>
    <div class="id-label">${label}</div>
    <div class="id-pillars">
      ${posOrder.map(([k,lab])=>{
        const p=P[k];
        if(!p) return `<div class="id-pillar"><div class="ip-pos">${lab}</div><div class="ip-gz" style="color:#6B7684">—</div><div class="ip-ko">모름</div></div>`;
        return `<div class="id-pillar"><div class="ip-pos">${lab}</div>
          <div class="ip-gz"><span style="color:${ELEM_COLOR_DARK[STEM_ELEM[p.stem]]}">${STEMS[p.stem]}</span><span style="color:${ELEM_COLOR_DARK[BRANCH_ELEM[p.branch]]}">${BRANCHES[p.branch]}</span></div>
          <div class="ip-ko">${gzKo(p)}</div></div>`;
      }).join("")}
    </div>
    <p class="id-verdict">${plainVerdict(P)}</p>
    <div class="id-brand">맑은사주</div>
  </section>
  <div class="id-actions">
    <button class="btn" id="save-card">카드 저장</button>
    <button class="btn ghost" id="copy-link">링크 복사</button>
  </div>`;

  /* ── 2. 본질 + Do/Don't ── */
  const ess=composeEssence(r);
  const st=strengthEstimate(P);
  const dd=doDontLists(P);
  const essHtml=
    ess.frags.map((f,i)=>`<p class="${i===0?"lede":""}">${T(f)}</p>`).join("")
    + `<p><b>기운 세기</b> · ${st.label.replace("(참고)","")} — ${T(STRENGTH_TEXT[st.label])}</p>`
    + `<div class="dodont">
        <div class="col do"><h4>이 사주에 잘 맞는 것</h4>${dd.dos.map(t=>`<li>✓ ${t}</li>`).join("")}</div>
        <div class="col dont"><h4>이 사주가 조심할 것</h4>${dd.donts.map(t=>`<li>✕ ${t}</li>`).join("")}</div>
      </div>
    <p class="note">기운 세기·용신의 정밀 판단은 격국 전체를 봐야 해서, 여기서는 참고치로 드려요.</p>`;
  const sect1=sect("나는 어떤 사람인가","해석",essHtml);

  /* ── 3. 오행 5색 지도 ── */
  const cnt=elementCount(P);
  let elemHtml=`<div class="elem-grid">`;
  for(const e2 of ["목","화","토","금","수"]){
    elemHtml+=`<div class="elem-cell ${cnt[e2]===0?"zero":""}" style="background:${ELEM_COLOR[e2]}">
      <div class="e-han">${ELEM_HAN[e2]}</div><div class="e-name">${ELEM_KO[e2]}</div><div class="e-cnt">${cnt[e2]}</div></div>`;
  }
  elemHtml+=`</div>`;
  const maxE=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  const zeros=Object.entries(cnt).filter(([,v])=>v===0).map(([k])=>k);
  let elemComment="";
  if(maxE[1]>=3) elemComment+=`<p><b>${maxE[0]}(${ELEM_KO[maxE[0]]})이 많아요</b> — ${T(ELEM_TEXT_EXCESS[maxE[0]])}</p>`;
  zeros.forEach(z=>{ elemComment+=`<p><b>${z}(${ELEM_KO[z]})이 비어 있어요</b> — ${T(ELEM_TEXT_LACK[z])}</p>`; });
  const gods={};
  for(const [key] of posOrder){ const p=P[key]; if(!p) continue;
    if(key!=="day"){ const g1=tenGod(ds,p.stem); gods[g1]=(gods[g1]||0)+1; }
    const g2=tenGodBranch(ds,p.branch); gods[g2]=(gods[g2]||0)+1; }
  let godHtml=`<div class="god-chips">`;
  Object.entries(gods).sort((a,b)=>b[1]-a[1]).forEach(([g,n])=>{ godHtml+=`<div class="chip"><b>${g}${n>1?" ×"+n:""}</b><span>${T(TEN_GOD_TEXT[g])}</span></div>`; });
  godHtml+=`</div>`;
  const structs=godStructures(P);
  const relAll=[...stemRelations(P), ...branchRelations(P)];
  let structHtml="";
  if(structs.length) structHtml+=`<div class="struct-block">`+structs.slice(0,3).map(s=>`<p class="struct">🔑 ${T(s)}</p>`).join("")+`</div>`;
  if(relAll.length && MODE==="expert") structHtml+=relAll.slice(0,5).map(x=>`<p class="rel">${T(x)}</p>`).join("");
  const sect2=sect("나의 오행 지도","해석", elemHtml+elemComment+godHtml+structHtml);

  /* ── 4. 명식 + 계산 공개 ── */
  let pillarHtml=`<div class="pillar-grid">`;
  for (const [key,lab] of posOrder){
    const p=P[key];
    if(!p){ pillarHtml+=`<div class="pillar unknown"><div class="p-label">${lab}</div><div class="p-char">—</div><div class="p-sub">시간 모름</div></div>`; continue; }
    const sGod=key==="day"?"일간":tenGod(ds,p.stem);
    pillarHtml+=`<div class="pillar ${key==='day'?'day-pillar':''}">
      <div class="p-label">${lab}</div><div class="p-god">${sGod}</div>
      <div class="p-char" style="color:${ELEM_COLOR[STEM_ELEM[p.stem]]}">${STEMS[p.stem]}<span class="p-read">${STEMS_KO[p.stem]}</span></div>
      <div class="p-char" style="color:${ELEM_COLOR[BRANCH_ELEM[p.branch]]}">${BRANCHES[p.branch]}<span class="p-read">${BRANCHES_KO[p.branch]}</span></div>
      <div class="p-god">${tenGodBranch(ds,p.branch)}</div><div class="p-sub">${twelveStage(ds,p.branch)}</div>
    </div>`;
  }
  pillarHtml+=`</div>`;
  let calcHtml=`<ul class="calc-log">${r.calcLog.map(l=>`<li>${l}</li>`).join("")}</ul>`;
  if(r.warnings.length) calcHtml+=r.warnings.map(w=>`<div class="warning">⚠️ ${w}</div>`).join("");
  // 여덟 글자 상세는 궁금한 사람만 — 기본 접힘 (카드에 이미 4주가 보임)
  const sect3=sect("나의 여덟 글자","계산",
    `<details class="fold"><summary>여덟 글자와 계산 근거 자세히 보기</summary>${pillarHtml}${calcHtml}</details>`);

  /* ── 5. 대운 타임라인 ── */
  let luckHtml=`<div class="luck-strip">`;
  r.luckPillars.forEach(lp=>{
    const active=nowYear>=lp.startYear&&nowYear<lp.startYear+10;
    const g1=tenGod(ds,lp.stem), g2=tenGodBranch(ds,lp.branch);
    // 쉬운말: 십성 대신 한 단어 키워드 ("겁재·정관"이 아니라 "승부·안정")
    const tagTxt = MODE==="easy" ? `${GOD_WORD[g1]}·${GOD_WORD[g2]}` : `${g1}·${g2}`;
    luckHtml+=`<div class="luck ${active?'active':''}"><div class="l-age">${lp.startAge}세<br><span>${lp.startYear}~</span></div><div class="l-gz">${gzDisp(lp.stem,lp.branch)}</div><div class="l-god">${tagTxt}</div></div>`;
  });
  luckHtml+=`</div>`;
  const cur=r.luckPillars.find(lp=>nowYear>=lp.startYear&&nowYear<lp.startYear+10);
  let curTxt="";
  if(cur){ const g1=tenGod(ds,cur.stem);
    curTxt=`<p><b>지금 나의 10년(${cur.startAge}~${cur.startAge+9}세)</b>은 '${GOD_WORD[g1]}'의 계절이에요. ${TEN_GOD_ACTION[g1]}</p>`;
    if(MODE==="expert") curTxt+=`<p class="note">현재 대운 ${gz(cur)} — 십성 ${g1}·${tenGodBranch(ds,cur.branch)}. ${TEN_GOD_TEXT[g1].expert}</p>`;
  }
  const luckNote = MODE==="expert"
    ? `대운수 ${r.luckStart} · ${r.forward?"순행":"역행"} · 절기 정밀 계산`
    : `10년 주기가 ${r.luckStart}세부터 시작돼요 (절기 시각까지 계산해 정했어요)`;
  const sect4=sect("십 년의 계절 — 대운","계산", luckHtml+curTxt+`<p class="note">${luckNote}</p>`);

  /* ── 6. 다섯 가지 질문 (무료 요약 → 리포트 훅) ── */
  const years5=yearlyFortune(P,nowYear,5);
  const gender=r.input.gender||"F";
  const goDeep=`<button class="go-deep" data-scroll="report">심층 리포트에서 더 깊게 →</button>`;

  // 일
  const groupMap={"비견":"비겁","겁재":"비겁","식신":"식상","상관":"식상","편재":"재성","정재":"재성","편관":"관성","정관":"관성","편인":"인성","정인":"인성"};
  const groupCnt={"비겁":0,"식상":0,"재성":0,"관성":0,"인성":0};
  Object.entries(gods).forEach(([g,n])=>{ groupCnt[groupMap[g]]+=n; });
  const domGroup=Object.entries(groupCnt).sort((a,b)=>b[1]-a[1])[0];
  const cg=CAREER_GROUP_TEXT[domGroup[0]];
  const sals=shinsal(P,r.sajuYear);
  let carHtml=`<p>당신은 <b>"${cg.title}"</b> 유형 — ${T(cg)}</p>`;
  if(sals.find(s=>s.name.startsWith("현침"))) carHtml+=`<p>🪡 예리한 감각의 별(현침)이 있어 정밀·분석·의료·기술 쪽에 가산점이 붙어요.</p>`;
  if(sals.find(s=>s.name.startsWith("화개"))) carHtml+=`<p>🎨 혼자 깊어지는 별(화개)이 있어 연구·예술 쪽 깊이가 무기가 돼요.</p>`;

  // 돈
  const wealthGods=["정재","편재"];
  let wCount=0, wKind={정재:0,편재:0};
  for(const [key] of posOrder){ const p=P[key]; if(!p) continue;
    if(key!=="day"){ const g1=tenGod(ds,p.stem); if(wealthGods.includes(g1)){wCount++;wKind[g1]++;} }
    const g2=tenGodBranch(ds,p.branch); if(wealthGods.includes(g2)){wCount++;wKind[g2]++;} }
  const wc=Math.min(wCount,3);
  let wealthHtml=`<p>${T(WEALTH_COUNT_TEXT[wc])}</p>`;
  const mainW=wKind["정재"]>=wKind["편재"]?"정재":"편재";
  if(wCount>0) wealthHtml+=`<p>${T(WEALTH_STYLE[mainW])}</p>`;
  const moneyYears=years5.filter(y=>wealthGods.includes(y.stemGod)||wealthGods.includes(y.branchGod));
  if(moneyYears.length) wealthHtml+=`<p>💰 앞으로 5년 중 돈이 움직이는 해: ${moneyYears.map(y=>`<b>${y.year}</b>`).join(", ")}</p>`;

  // 사랑
  const iljiGod=tenGodBranch(ds,P.day.branch);
  const hongranSal=sals.find(s=>s.name==="홍란·천희");
  const ssi=SPOUSE_STAR_INFO[gender];
  let spCount=0;
  for(const [key] of posOrder){ const p=P[key]; if(!p) continue;
    if(key!=="day"){ const g1=tenGod(ds,p.stem); if(ssi.stars.includes(g1)) spCount++; }
    const g2=tenGodBranch(ds,p.branch); if(ssi.stars.includes(g2)) spCount++; }
  let loveHtml=`<p>${T(SPOUSE_COUNT_TEXT[Math.min(spCount,3)])}</p>`;
  loveHtml+=`<p><b>배우자 자리(일지)</b> — ${T(SPOUSE_PALACE_TEXT[iljiGod])}</p>`;
  // 메인 지표: 배우자 기운(십성)·배우자궁 합이 드는 해 — 보통 1~3년 안에 잡힌다
  const bondYears=years5.filter(y=>
    ssi.stars.includes(y.stemGod)||ssi.stars.includes(y.branchGod)||y.events.some(e=>e.includes("합")));
  if(bondYears.length){
    loveHtml+=`<p>💞 <b>앞으로 5년 중 인연이 움직이는 해: ${bondYears.map(y=>`<b>${y.year}</b>`).join(" · ")}</b> — 배우자 기운이 들어오거나 배우자 자리와 합이 드는 해예요. 새 만남도, 있는 관계의 진전도 이런 해에 잘 움직여요.</p>`;
  } else {
    loveHtml+=`<p>💞 앞으로 5년은 인연 자리가 조용한 편이에요 — 억지 타이밍보다 나를 채우는 시간으로 쓰기 좋아요.</p>`;
  }
  // 보조 지표(홍란): 6년 안에 올 때만 표시 — 멀면 오해만 낳는다
  if(hongranSal){
    const nextOf=br=>{for(let yy=nowYear;yy<nowYear+12;yy++){if(((yy-4)%12+12)%12===br)return yy;}return null;};
    const hy=nextOf(hongranSal.hongran);
    if(hy!==null && hy<=nowYear+6) loveHtml+=`<p class="note">보조 지표로는 ${hy}년에도 만남의 별(홍란)이 켜져요.</p>`;
  }
  loveHtml+=`<p>🤝 처음 만나도 오래 알던 사이처럼 편한 상대: <b>${hapTitle}(${hapStem}) 일간</b> — 고전의 천간합 공식이에요.</p>`;

  // 올해 — "무슨 기운인지 + 그래서 뭘 하면 되는지"
  const thisYF=years5[0];
  let nyHtml=`<p>올해 ${nowYear}년은 나에게 <b>'${GOD_WORD[thisYF.stemGod]}'의 해</b>예요. ${TEN_GOD_ACTION[thisYF.stemGod]}</p>`;
  if(MODE==="expert") nyHtml+=`<p class="note">${gzDisp(thisYF.stem,thisYF.branch)}년 — 십성 ${thisYF.stemGod}·${thisYF.branchGod}.</p>`;
  thisYF.events.forEach(e2=>{ nyHtml+=`<p class="yevent">✨ ${e2}</p>`; });
  const yStemIdx=((nowYear-4)%10+10)%10;
  const inStemTbl=[2,4,6,8,0];
  const YUKHAP2={0:1,1:0,2:11,11:2,3:10,10:3,4:9,9:4,5:8,8:5,6:7,7:6};
  // 열두 달 중 여섯 달만 무료 — 나머지는 리포트의 몫 (경계를 콘텐츠 층에서)
  let mHtml=`<details class="fold"><summary>올해 여섯 달 리듬 보기</summary><div class="month-grid">`;
  for(let mi2=0; mi2<6; mi2++){
    const ms=(inStemTbl[yStemIdx%5]+mi2)%10, mb=(mi2+2)%12;
    const mg=tenGod(ds,ms);
    const rel=[];
    if(YUKHAP2[mb]===P.day.branch) rel.push("💞");
    if(((mb-P.day.branch)%12+12)%12===6) rel.push("⚡");
    mHtml+=`<div class="mcard ${rel.length?"mark":""}"><b>${MONTH_RANGE_LABEL[mi2]}</b><span class="mgz">${gzDisp(ms,mb)}</span><span class="mgod">${mg}${rel.join("")}</span><p>${MONTH_TIP[mg]}</p></div>`;
  }
  mHtml+=`</div><p class="note">월 경계는 절기 기준 · 💞=배우자궁과 합 ⚡=배우자궁과 충 · 남은 여섯 달은 심층 리포트에서 다뤄요</p></details>`;

  // 달력: 올해·내년만 상세 — 그 뒤는 리포트에서 (10년 달력)
  let calHtml=`<details class="fold"><summary>다가오는 해 미리 보기</summary><div class="year-cards">`;
  years5.forEach((yf,i)=>{
    if(i<2){
      calHtml+=`<div class="ycard"><h4>${yf.year} <span>${gzDisp(yf.stem,yf.branch)}</span></h4>
        <p class="ygods">${yf.stemGod} · ${yf.branchGod}</p><p>${T(TEN_GOD_TEXT[yf.stemGod])}</p>
        ${yf.events.map(e2=>`<p class="yevent">✨ ${e2}</p>`).join("")}</div>`;
    } else {
      calHtml+=`<div class="ycard dim"><h4>${yf.year} <span>${gzDisp(yf.stem,yf.branch)}</span></h4>
        <p class="note">이 해의 흐름과 나머지 10년은 심층 리포트에서</p></div>`;
    }
  });
  calHtml+=`</div></details>`;

  const domainsHtml=
    `<div class="domain-card"><h3>💼 어떤 일이 맞을까</h3>${carHtml}${goDeep}</div>`
    +`<div class="domain-card"><h3>💰 내 돈그릇은</h3>${wealthHtml}${goDeep}</div>`
    +`<div class="domain-card"><h3>💞 사랑과 인연은</h3>${loveHtml}${goDeep}</div>`
    +`<div class="domain-card"><h3>🗓 올해는 어떤 해</h3>${nyHtml}${mHtml}${calHtml}${goDeep}</div>`;
  const sect5=sect("네 가지 질문","해석",domainsHtml+`<p class="note">여기까지는 요약이에요. 나이대별 타임라인·10년 달력·행동 처방은 심층 리포트가 깊게 다뤄요.</p>`,"free-end");

  /* ── 7. 별 (신살) ── */
  let salHtml="";
  sals.forEach(s=>{
    const key=Object.keys(SHINSAL_TEXT).find(k=>s.name.startsWith(k.replace(/\(.*\)/,"")))||Object.keys(SHINSAL_TEXT).find(k=>s.name.startsWith(k));
    salHtml+=`<div class="sal ${s.absent?'absent':''}"><b>${s.name}</b> <span class="where">${s.where}</span><p>${key?T(SHINSAL_TEXT[key]):""}${s.absent?" — 지금은 없고, 들어오는 시기가 포인트예요.":""}</p></div>`;
  });
  const sect6=sect("타고난 별들","해석", `<details class="fold" open><summary>내 신살 보기</summary>${salHtml}</details><p class="note">신살은 보조 지표예요 — 관리 포인트로만 읽어 주세요.</p>`);

  /* ── 실천 팁 ── */
  const tips=actionTips(P);
  const tipsHtml=sect("오늘부터 이렇게","조언", tips.map(t=>`<p class="tip">✅ ${t}</p>`).join("")+`<p class="note">전통 통설 기반 참고예요 — 의료·법률·투자는 전문가와 상의하세요.</p>`);

  el.innerHTML=idCard+sect1+sect2+sect3+sect4+sect5+sect6+tipsHtml;

  document.getElementById("save-card").addEventListener("click",()=>drawTalisman(r,label,season,hapTitle,hapStem,motherElem));
  document.getElementById("copy-link").addEventListener("click",()=>{
    navigator.clipboard.writeText(location.href).then(()=>toast("링크를 복사했어요 — 붙여넣으면 이 결과가 그대로 열려요"));
  });
  // 대화·리포트 마운트 (chat.js)
  if (window.mountSajuChat) try{ window.mountSajuChat(r); }catch(_e){}
  // '더 깊게' 버튼 → 리포트로 스크롤
  const scrollToReport=()=>{ const t=document.querySelector(".report-cta"); if(t) t.scrollIntoView({behavior:"smooth", block:"center"}); };
  document.querySelectorAll(".go-deep").forEach(b=>b.addEventListener("click",scrollToReport));
  // 하단 고정 CTA — 리포트가 화면에 보이면 숨김
  let bar=document.getElementById("bottom-cta");
  if(!bar){
    bar=document.createElement("div"); bar.id="bottom-cta"; bar.className="bottom-cta";
    bar.innerHTML=`<button class="btn">내 심층 리포트 받기 — 오픈 기념 무료</button>`;
    document.body.appendChild(bar);
    bar.querySelector("button").addEventListener("click",scrollToReport);
  }
  bar.classList.remove("hidden");
  const rc=document.querySelector(".report-cta");
  if(rc && "IntersectionObserver" in window){
    new IntersectionObserver(es=>{
      es.forEach(en=>bar.classList.toggle("hidden", en.isIntersecting));
    },{threshold:0.15}).observe(rc);
  }
  updateProgress();
}

/* ── 공유 카드 이미지 (1080×1920, 다크 아이덴티티) ── */
function drawTalisman(r,label,season,hapTitle,hapStem,motherElem){
  const P=r.pillars;
  const c=document.createElement("canvas"); c.width=1080; c.height=1920;
  const x=c.getContext("2d");
  document.fonts.load('700 100px "Noto Serif KR"').then(()=>document.fonts.ready).then(()=>{
    x.fillStyle="#191F28"; x.fillRect(0,0,1080,1920);
    // 미세 별점 질감
    for(let i=0;i<400;i++){ x.fillStyle=`rgba(245,238,220,${Math.random()*0.08})`; x.fillRect(Math.random()*1080,Math.random()*1920,2,2); }
    x.strokeStyle="#A9853B"; x.lineWidth=3; x.strokeRect(60,60,960,1800);
    x.fillStyle="#8B95A1"; x.font='500 38px "Pretendard Variable", sans-serif'; x.textAlign="center";
    x.fillText(SEASON_NAMES[season]+" · "+r.sajuYear+"년생", 540, 220);
    x.fillStyle="#F5EEDC"; x.font='700 95px "Noto Serif KR", serif';
    const words=label.split(" ");
    let ly=430;
    if(words.length>2){ x.fillText(words.slice(0,2).join(" "),540,ly); x.fillText(words.slice(2).join(" "),540,ly+130); ly+=130; }
    else { x.fillText(label,540,ly+60); ly+=60; }
    const order=["year","month","day","hour"];
    const startX=270, gap=180;
    x.font='700 110px "Noto Serif KR", serif';
    order.forEach((k,i)=>{
      const p=P[k]; const cx=startX+i*gap;
      if(!p){ x.fillStyle="#4E5968"; x.fillText("—",cx,ly+320); x.fillText("—",cx,ly+460); return; }
      x.fillStyle=ELEM_COLOR_DARK[STEM_ELEM[p.stem]]; x.fillText(STEMS[p.stem],cx,ly+320);
      x.fillStyle=ELEM_COLOR_DARK[BRANCH_ELEM[p.branch]]; x.fillText(BRANCHES[p.branch],cx,ly+460);
    });
    x.fillStyle="#6B7684"; x.font='400 34px "Pretendard Variable", sans-serif';
    ["년","월","일","시"].forEach((t,i)=>x.fillText(t,startX+i*gap,ly+540));
    x.strokeStyle="#333D4B"; x.lineWidth=2;
    x.beginPath(); x.moveTo(200,ly+620); x.lineTo(880,ly+620); x.stroke();
    x.fillStyle="#F5EEDC"; x.font='500 44px "Pretendard Variable", sans-serif';
    x.fillText(`잘 맞는 상대 · ${hapTitle}`, 540, ly+730);
    x.fillText(`나를 채우는 기운 · ${ELEM_KO[motherElem]}`, 540, ly+810);
    x.fillStyle="#A9853B"; x.font='700 40px "Noto Serif KR", serif';
    x.fillText("맑은사주",540,1760);
    x.fillStyle="#6B7684"; x.font='400 26px "Pretendard Variable", sans-serif';
    x.fillText("내 사주도 무료로 — 맑은사주 검색",540,1815);
    c.toBlob(blob=>{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download=`맑은사주_${label.replace(/\s/g,"")}.png`;
      a.click(); URL.revokeObjectURL(a.href);
      toast("카드를 저장했어요 — 스토리에 올려보세요");
    },"image/png");
  });
}

function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2200);
}
