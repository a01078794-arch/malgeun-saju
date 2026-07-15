/* 맑은사주 v2 — 문집 × 부적 UI */
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
const ELEM_COLOR = {"목":"#5a7d5a","화":"#b5493a","토":"#c29a4b","금":"#8a8f98","수":"#4a6b8a"};

// localStorage는 file://·인앱브라우저·시크릿모드에서 예외를 던질 수 있음 — 안전 래퍼
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(_e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(_e){} }
};
let MODE = store.get("sajuMode") || "easy";
let LAST = null;

// 어떤 에러든 화면에 보이게 (원격 진단용)
window.addEventListener("error", ev=>{
  try{
    const b=document.createElement("div");
    b.style.cssText="position:fixed;top:0;left:0;right:0;background:#b5493a;color:#fff;padding:8px 12px;font-size:12px;z-index:999;word-break:break-all";
    b.textContent="오류: "+(ev.message||ev.error)+" @"+(ev.lineno||"?");
    document.body.appendChild(b);
  }catch(_e){}
});

function initApp(){
  const citySel = document.getElementById("city");
  if (!citySel || citySel.options.length>0) return; // 중복 초기화 방지
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
// 문서가 이미 로드된 상태여도, 아직 로딩 중이어도 반드시 1회 초기화
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

function onSubmit(e){
  e.preventDefault();
  const y=+document.getElementById("year").value, m=+document.getElementById("month").value, d=+document.getElementById("day").value;
  const hourUnknown=document.getElementById("hour-unknown").checked;
  const h=hourUnknown?null:+document.getElementById("hour").value;
  const mi=hourUnknown?null:+document.getElementById("minute").value;
  const g=document.getElementById("gender").value, ci=+document.getElementById("city").value;
  if (!y||!m||!d||y<1900||y>2050){ alert("생년월일을 확인해주세요 (1900~2050)"); return; }
  const dt=new Date(y,m-1,d);
  if (dt.getMonth()!==m-1||dt.getDate()!==d){ alert("존재하지 않는 날짜입니다"); return; }
  if (!hourUnknown && (isNaN(h)||h<0||h>23)){ alert("태어난 시를 입력하거나 '시간 모름'을 선택해주세요"); return; }
  const input={year:y,month:m,day:d,hour:h??12,minute:mi??0,hourUnknown,gender:g,longitude:CITIES[ci].lon,placeName:CITIES[ci].name};
  LAST=computeSaju(input);
  render(LAST);
  const params=new URLSearchParams({y,mo:m,d,g,c:ci});
  if(!hourUnknown){ params.set("h",h); params.set("mi",mi); }
  try{ history.replaceState(null,"","?"+params.toString()); }catch(_e){ /* file:// 등 로컬 실행 환경 */ }
  document.getElementById("result").scrollIntoView({behavior:"smooth"});
}

function T(o){ return o[MODE]||o.easy; }
function gz(p){ return STEMS[p.stem]+BRANCHES[p.branch]; }
function gzKo(p){ return STEMS_KO[p.stem]+BRANCHES_KO[p.branch]; }
function chapter(no, title, badge, inner, opts={}){
  const lock = opts.locked? ` data-locked="true"` : "";
  return `<section class="chapter${opts.locked?" locked":""}" id="ch-${no}"${lock}>
    <div class="ch-head"><span class="ch-no">${no}</span><h2>${title}</h2>${badge?`<span class="badge ${badge==="계산"?"badge-calc":"badge-interp"}">${badge}</span>`:""}</div>
    <div class="ch-body">${inner}</div>
    ${opts.locked?`<div class="paywall"><div class="pw-inner">
      <p class="pw-price"><del>990원</del> <b>오픈 기념 무료</b></p>
      <button class="btn unlock-btn" data-target="ch-${no}">열어보기</button>
      <p class="pw-note">정식 오픈 후 990원 — 지금은 전부 무료로 풀어드려요</p>
    </div></div>`:""}
  </section>`;
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

  /* ── 부적 카드 (공유의 핵심) ── */
  const cardHtml=`
  <section class="talisman-wrap">
    <div class="talisman" id="talisman">
      <div class="tal-top">四柱 · ${SEASON_NAMES[season]}</div>
      <div class="tal-label">${label}</div>
      <div class="tal-gz">${["hour","day","month","year"].map(k=>P[k]?`<span style="color:${ELEM_COLOR[STEM_ELEM[P[k].stem]]}">${STEMS[P[k].stem]}</span><span style="color:${ELEM_COLOR[BRANCH_ELEM[P[k].branch]]}">${BRANCHES[P[k].branch]}</span>`:"").join(" ")}</div>
      <div class="tal-tags">
        <span>합이 드는 상대 · ${hapTitle}(${hapStem})</span>
        <span>나를 채우는 기운 · ${ELEM_KO[motherElem]}(${motherElem})</span>
      </div>
      <div class="tal-seal">맑은<br>사주</div>
    </div>
    <div class="tal-actions">
      <button class="btn" id="save-card">부적 카드 저장</button>
      <button class="btn secondary" id="copy-link">내 사주 링크 복사</button>
    </div>
  </section>`;

  /* ── 序: 명식 + 계산 공개 ── */
  const posOrder=[["hour","시주"],["day","일주"],["month","월주"],["year","연주"]];
  let pillarHtml=`<div class="pillar-grid">`;
  for (const [key,lab] of posOrder){
    const p=P[key];
    if(!p){ pillarHtml+=`<div class="pillar unknown"><div class="p-label">${lab}</div><div class="p-char">—</div><div class="p-sub">시간 모름</div></div>`; continue; }
    const sGod=key==="day"?"일간":tenGod(ds,p.stem);
    pillarHtml+=`<div class="pillar ${key==='day'?'day-pillar':''}">
      <div class="p-label">${lab}</div><div class="p-god">${sGod}</div>
      <div class="p-char" style="color:${ELEM_COLOR[STEM_ELEM[p.stem]]}">${STEMS[p.stem]}</div>
      <div class="p-char" style="color:${ELEM_COLOR[BRANCH_ELEM[p.branch]]}">${BRANCHES[p.branch]}</div>
      <div class="p-god">${tenGodBranch(ds,p.branch)}</div><div class="p-sub">${twelveStage(ds,p.branch)}</div>
    </div>`;
  }
  pillarHtml+=`</div>`;
  let calcHtml=`<ul class="calc-log">${r.calcLog.map(l=>`<li>${l}</li>`).join("")}</ul>`;
  if(r.warnings.length) calcHtml+=r.warnings.map(w=>`<div class="warning">⚠️ ${w}</div>`).join("");
  const ch0=chapter("序","나의 명식","계산",
    pillarHtml+`<details class="calc-details"><summary>이 명식이 나온 계산 과정 — 전부 공개합니다</summary>${calcHtml}</details>`);

  /* ── 一: 본질 (일간×계절×강약·통근×대표구조 조합) ── */
  const st=strengthEstimate(P);
  const ess=composeEssence(r);
  const ch1=chapter("一",`본질 — ${ess.title}`,"해석",
    ess.frags.map((f,i)=>`<p class="${i===0?"lede":i===1?"johu":""}">${T(f)}</p>`).join("")
    + `<p><b>기운 세기</b> · ${st.label.replace("(참고)","")} <span class="tag">${st.detail.join("·")}</span> — ${T(STRENGTH_TEXT[st.label])}</p>`
    + `<p class="note">※ 신강약·용신의 정밀 판단은 격국 전체를 봐야 합니다 — 여기서는 참고치로만 드립니다. 이게 정직한 한계입니다.</p>`);

  /* ── 二: 오행과 기질 ── */
  const cnt=elementCount(P);
  const total=Object.values(cnt).reduce((a,b)=>a+b,0);
  let elemHtml=`<div class="elem-bars">`;
  for(const e2 of ["목","화","토","금","수"]){
    const pct=Math.round(cnt[e2]/total*100);
    elemHtml+=`<div class="elem-row"><span class="elem-name" style="color:${ELEM_COLOR[e2]}">${e2} ${ELEM_KO[e2]}</span>
      <div class="bar-track"><div class="bar" style="width:${Math.max(pct,3)}%;background:${ELEM_COLOR[e2]}"></div></div><span class="elem-cnt">${cnt[e2]}</span></div>`;
  }
  elemHtml+=`</div>`;
  const maxE=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  const zeros=Object.entries(cnt).filter(([,v])=>v===0).map(([k])=>k);
  let elemComment="";
  if(maxE[1]>=3) elemComment+=`<p><b>${maxE[0]}(${ELEM_KO[maxE[0]]})이 많은 사주</b> — ${T(ELEM_TEXT_EXCESS[maxE[0]])}</p>`;
  zeros.forEach(z=>{ elemComment+=`<p><b>${z}(${ELEM_KO[z]}) 없음</b> — ${T(ELEM_TEXT_LACK[z])}</p>`; });
  const gods={};
  for(const [key] of posOrder){ const p=P[key]; if(!p) continue;
    if(key!=="day"){ const g1=tenGod(ds,p.stem); gods[g1]=(gods[g1]||0)+1; }
    const g2=tenGodBranch(ds,p.branch); gods[g2]=(gods[g2]||0)+1; }
  let godHtml=`<div class="god-chips">`;
  Object.entries(gods).sort((a,b)=>b[1]-a[1]).forEach(([g,n])=>{ godHtml+=`<div class="chip"><b>${g}${n>1?" ×"+n:""}</b><span>${T(TEN_GOD_TEXT[g])}</span></div>`; });
  godHtml+=`</div>`;
  // 십성 조합 구조 + 글자끼리의 관계 (개인차의 핵심 — 실제 글자·자리 기준)
  const structs=godStructures(P);
  const relAll=[...stemRelations(P), ...branchRelations(P)];
  let structHtml="";
  if(structs.length) structHtml+=`<div class="struct-block"><h4>내 사주의 구조</h4>`+structs.slice(0,3).map(s=>`<p class="struct">🔑 ${T(s)}</p>`).join("")+`</div>`;
  if(relAll.length) structHtml+=`<div class="rel-block"><h4>글자끼리의 관계 (합·충·형)</h4>`+relAll.slice(0,5).map(x=>`<p class="rel">${T(x)}</p>`).join("")+`</div>`;
  const ch2=chapter("二","오행·기질·구조","해석", elemHtml+`<div class="interp-block">${elemComment}</div>`+godHtml+structHtml);

  /* ── 三: 별자리 (신살) ── */
  const sals=shinsal(P,r.sajuYear);
  let salHtml="";
  sals.forEach(s=>{
    const key=Object.keys(SHINSAL_TEXT).find(k=>s.name.startsWith(k.replace(/\(.*\)/,"")))||Object.keys(SHINSAL_TEXT).find(k=>s.name.startsWith(k));
    salHtml+=`<div class="sal ${s.absent?'absent':''} ${s.good===false?'care':''}"><b>${s.name}</b> <span class="where">${s.where}</span><p>${key?T(SHINSAL_TEXT[key]):""}${s.absent?" — 지금은 없지만 '언제 들어오는지'가 포인트예요.":""}</p></div>`;
  });
  const ch3=chapter("三","타고난 별들 (신살)","해석", salHtml+`<p class="note">※ 신살은 보조 지표입니다. 겁주는 도구가 아니라 관리 포인트로만 읽으세요.</p>`);

  /* ── 四: 대운 ── */
  const nowYear=new Date().getFullYear();
  let luckHtml=`<div class="luck-strip">`;
  r.luckPillars.forEach(lp=>{
    const active=nowYear>=lp.startYear&&nowYear<lp.startYear+10;
    luckHtml+=`<div class="luck ${active?'active':''}"><div class="l-age">${lp.startAge}세<br><span>${lp.startYear}~</span></div><div class="l-gz">${STEMS[lp.stem]}${BRANCHES[lp.branch]}</div><div class="l-god">${tenGod(ds,lp.stem)}·${tenGodBranch(ds,lp.branch)}</div></div>`;
  });
  luckHtml+=`</div>`;
  const cur=r.luckPillars.find(lp=>nowYear>=lp.startYear&&nowYear<lp.startYear+10);
  let curTxt="";
  if(cur){ const g1=tenGod(ds,cur.stem);
    curTxt=`<p><b>지금 대운(${STEMS[cur.stem]}${BRANCHES[cur.branch]}, ${cur.startAge}~${cur.startAge+9}세)</b>의 키워드는 <b>${g1}</b> — ${T(TEN_GOD_TEXT[g1])}. 10년 단위로 삶의 배경 계절이 바뀝니다.</p>`; }
  const ch4=chapter("四","대운 — 십 년의 계절","계산", luckHtml+curTxt+`<p class="note">대운수 ${r.luckStart} · ${r.forward?"순행":"역행"} (절기 정밀 계산)</p>`);

  /* ══ 테마 리포트 (잠금 상품) ══ */
  const years5=yearlyFortune(P,nowYear,5);
  const gender=r.input.gender||"F";

  /* ── 五: 배우자·인연운 ── */
  const iljiGod=tenGodBranch(ds,P.day.branch);
  const iljiStage=twelveStage(ds,P.day.branch);
  const hongranSal=sals.find(s=>s.name==="홍란·천희");
  const ssi=SPOUSE_STAR_INFO[gender];
  let spCount=0, spWhere=[];
  for(const [key,lab] of posOrder){ const p=P[key]; if(!p) continue;
    if(key!=="day"){ const g1=tenGod(ds,p.stem); if(ssi.stars.includes(g1)){spCount++; spWhere.push(lab.replace("주","간")+" "+g1);} }
    const g2=tenGodBranch(ds,p.branch); if(ssi.stars.includes(g2)){spCount++; spWhere.push(lab.replace("주","지")+" "+g2);} }
  let loveHtml=`<p class="lede">${T(ssi)} ${T(SPOUSE_COUNT_TEXT[Math.min(spCount,3)])}</p>`;
  if(spWhere.length) loveHtml+=`<p>내 사주 속 배우자 기운: <b>${spWhere.join(" · ")}</b></p>`;
  loveHtml+=`<p><b>배우자 자리(일지) 풀이</b> — ${T(SPOUSE_PALACE_TEXT[iljiGod])}<br>자리의 계절은 <b>${iljiStage}</b>: ${T(TWELVE_TEXT[iljiStage])}.</p>`;
  if(hongranSal) loveHtml+=`<p>💮 <b>인연의 별</b>: 홍란(만남)은 <b>${BRANCHES_KO[hongranSal.hongran]}</b>, 천희(경사)는 <b>${BRANCHES_KO[hongranSal.cheonhui]}</b> — 이 글자가 오는 해·대운에 인연 기운이 켜집니다.</p>`;
  const bondYears=years5.filter(y=>y.events.some(e=>e.includes("합")||e.includes("인연"))||ssi.stars.includes(y.stemGod)||(hongranSal&&(y.branch===hongranSal.hongran||y.branch===hongranSal.cheonhui)));
  if(bondYears.length) loveHtml+=`<p>🔔 <b>앞으로 5년 중 인연이 움직이는 해</b>: ${bondYears.map(y=>`<b>${y.year}</b>`).join(", ")}</p>`;
  else loveHtml+=`<p>앞으로 5년은 인연 자리가 조용한 편 — 억지 타이밍보다 나를 채우는 시간으로 쓰기 좋은 구간입니다.</p>`;
  loveHtml+=`<p>🤝 <b>천간이 합하는 상대</b>: ${DAY_MASTER_TEXT[STEM_HAP[STEMS[ds]]].title}(${STEM_HAP[STEMS[ds]]}) 일간 — 처음 만나도 오래 안 듯 편안한 조합의 고전적 공식입니다.</p>`;
  const ch5=chapter("五","배우자·인연운","해석", loveHtml, {locked:true});

  /* ── 六: 재물 (잠금) ── */
  const wealthGods=["정재","편재"];
  let wCount=0, wKind={정재:0,편재:0};
  for(const [key] of posOrder){ const p=P[key]; if(!p) continue;
    if(key!=="day"){ const g1=tenGod(ds,p.stem); if(wealthGods.includes(g1)){wCount++;wKind[g1]++;} }
    const g2=tenGodBranch(ds,p.branch); if(wealthGods.includes(g2)){wCount++;wKind[g2]++;} }
  const wc=Math.min(wCount,3);
  let wealthHtml=`<p class="lede">${T(WEALTH_COUNT_TEXT[wc])}</p>`;
  const mainW=wKind["정재"]>=wKind["편재"]?"정재":"편재";
  if(wCount>0) wealthHtml+=`<p>${T(WEALTH_STYLE[mainW])}</p>`;
  const moneyYears=years5.filter(y=>wealthGods.includes(y.stemGod)||wealthGods.includes(y.branchGod));
  if(moneyYears.length) wealthHtml+=`<p>💰 <b>앞으로 5년 중 돈이 움직이는 해</b>: ${moneyYears.map(y=>`<b>${y.year}</b>(${y.stemGod}·${y.branchGod})`).join(", ")} — 기회이자 지출이니, 이 해엔 흐름을 미리 준비해두세요.</p>`;
  // 구조·조건부 처방 (전원 동일 잔소리 제거 — 이 사주에 해당하는 것만)
  structs.filter(s=>["재다신약","식신생재","상관생재","군겁쟁재","무재"].includes(s.key)).forEach(s=>{ wealthHtml+=`<p>💡 ${T(s)}</p>`; });
  // WEALTH_STYLE이 이미 편재 저축을 다루므로 여기선 비겁(군겁쟁재) 경고만 — 중복 제거
  conditionalNotes(P).filter(n=>n.tag==="돈·사람").forEach(n=>{ wealthHtml+=`<p class="note">${T(n)}</p>`; });
  const ch6=chapter("六","재물 — 나의 돈그릇","해석", wealthHtml, {locked:true});

  /* ── 七: 신년운세 (올해 + 월별) ── */
  const thisYF=years5[0];
  let nyHtml=`<p class="lede">${nowYear}년(${STEMS[thisYF.stem]}${BRANCHES[thisYF.branch]})은 나에게 <b>${thisYF.stemGod}·${thisYF.branchGod}</b>의 해 — ${T(TEN_GOD_TEXT[thisYF.stemGod])}.</p>`;
  thisYF.events.forEach(e2=>{ nyHtml+=`<p class="yevent">✨ ${e2}</p>`; });
  const yStemIdx=((nowYear-4)%10+10)%10;
  const inStemTbl=[2,4,6,8,0];
  const YUKHAP2={0:1,1:0,2:11,11:2,3:10,10:3,4:9,9:4,5:8,8:5,6:7,7:6};
  let mHtml=`<div class="month-grid">`;
  for(let mi2=0; mi2<12; mi2++){
    const ms=(inStemTbl[yStemIdx%5]+mi2)%10, mb=(mi2+2)%12;
    const mg=tenGod(ds,ms);
    const rel=[];
    if(YUKHAP2[mb]===P.day.branch) rel.push("💞");
    if(((mb-P.day.branch)%12+12)%12===6) rel.push("⚡");
    mHtml+=`<div class="mcard ${rel.length?"mark":""}"><b>${MONTH_RANGE_LABEL[mi2]}</b><span class="mgz">${STEMS[ms]}${BRANCHES[mb]}</span><span class="mgod">${mg}${rel.join("")}</span><p>${MONTH_TIP[mg]}</p></div>`;
  }
  mHtml+=`</div><p class="note">월 경계는 절기 기준(날짜는 근사) · 💞=배우자궁과 합(관계·협력의 달) ⚡=배우자궁과 충(변동의 달)</p>`;
  const ch7=chapter("七",`${nowYear} 신년운세 — 열두 달의 리듬`,"해석", nyHtml+mHtml, {locked:true});

  /* ── 八: 직업·적성운 ── */
  const groupMap={"비견":"비겁","겁재":"비겁","식신":"식상","상관":"식상","편재":"재성","정재":"재성","편관":"관성","정관":"관성","편인":"인성","정인":"인성"};
  const groupCnt={"비겁":0,"식상":0,"재성":0,"관성":0,"인성":0};
  Object.entries(gods).forEach(([g,n])=>{ groupCnt[groupMap[g]]+=n; });
  const domGroup=Object.entries(groupCnt).sort((a,b)=>b[1]-a[1])[0];
  const cg=CAREER_GROUP_TEXT[domGroup[0]];
  let carHtml=`<p class="lede">내 사주에서 가장 큰 기운은 <b>${domGroup[0]}</b>(${domGroup[1]}개) — 당신은 <b>"${cg.title}"</b> 유형입니다.</p><p>${T(cg)}</p>`;
  // 구조가 직업 방향을 어떻게 좁히는지 (개인차)
  structs.filter(s=>["관인상생","살인상생","식상제살","상관패인","상관견관","무인성","도식"].includes(s.key)).forEach(s=>{ carHtml+=`<p>🧭 ${T(s)}</p>`; });
  if(sals.find(s=>s.name.startsWith("현침"))) carHtml+=`<p>🪡 현침살 보유 — 정밀·분석·의료·기술 계열에 추가 가산점이 붙는 구조.</p>`;
  if(sals.find(s=>s.name.startsWith("화개"))) carHtml+=`<p>🎨 화개 보유 — 연구·예술·정신세계 쪽 깊이가 무기가 됩니다.</p>`;
  carHtml+=`<p><b>계절 처방과 연결하면</b> — ${JOHU_HINT[STEM_ELEM[ds]][season]}. 일과 환경을 고를 때 이 보약 기운을 곁에 두는 게 전통적 개운법입니다.</p>`;
  const ch8=chapter("八","직업·적성 — 나의 쓰임","해석", carHtml, {locked:true});

  /* ── 九: 오년의 달력 (잠금) ── */
  let calHtml=`<div class="year-cards">`;
  years5.forEach(yf=>{
    calHtml+=`<div class="ycard"><h4>${yf.year} <span>${STEMS[yf.stem]}${BRANCHES[yf.branch]}</span></h4>
      <p class="ygods">${yf.stemGod} · ${yf.branchGod}</p><p>${T(TEN_GOD_TEXT[yf.stemGod])}</p>
      ${yf.events.map(e2=>`<p class="yevent">✨ ${e2}</p>`).join("")}</div>`;
  });
  calHtml+=`</div><p class="note">세운은 대운보다 신뢰도가 한 단계 낮은 것이 전통 통설입니다 — 큰 흐름은 대운으로, 해의 리듬은 세운으로 보세요.</p>`;
  const ch9=chapter("九","오년의 달력","해석", calHtml, {locked:true});

  el.innerHTML=cardHtml+`<div class="book">`+ch0+ch1+ch2+ch3+ch4+ch5+ch6+ch7+ch8+ch9+`</div>
    <section class="chapter outro">
      <p class="outro-line">계산은 여기까지가 사실이고, 해석은 여기까지가 전통입니다.<br>나머지는 당신이 씁니다.</p>
      <button class="btn secondary" id="copy-text">텍스트 요약 복사</button>
    </section>`;

  document.querySelectorAll(".unlock-btn").forEach(b=>b.addEventListener("click",()=>{
    const s=document.getElementById(b.dataset.target);
    s.classList.remove("locked"); s.querySelector(".paywall").remove();
    toast("열렸어요 — 오픈 기념 무료");
  }));
  document.getElementById("save-card").addEventListener("click",()=>drawTalisman(r,label,season,hapTitle,hapStem,motherElem));
  document.getElementById("copy-link").addEventListener("click",()=>{
    navigator.clipboard.writeText(location.href).then(()=>toast("링크를 복사했어요 — 붙여넣으면 이 결과가 그대로 열립니다"));
  });
  document.getElementById("copy-text").addEventListener("click",()=>{
    const txt=`[맑은사주] 나는 "${label}"\n명식: ${P.hour?gzKo(P.hour)+"시 ":""}${gzKo(P.day)}일 ${gzKo(P.month)}월 ${gzKo(P.year)}년\n합이 드는 상대: ${hapTitle}(${hapStem}) · 나를 채우는 기운: ${ELEM_KO[motherElem]}\n${location.href}`;
    navigator.clipboard.writeText(txt).then(()=>toast("요약을 복사했어요"));
  });
  updateProgress();
}

/* ── 부적 카드 이미지 (1080×1920 인스타 스토리) ── */
function drawTalisman(r,label,season,hapTitle,hapStem,motherElem){
  const P=r.pillars;
  const c=document.createElement("canvas"); c.width=1080; c.height=1920;
  const x=c.getContext("2d");
  document.fonts.load('700 100px "Noto Serif KR"').then(()=>document.fonts.ready).then(()=>{
    // 한지 배경
    x.fillStyle="#f3ecdd"; x.fillRect(0,0,1080,1920);
    // 미세 질감
    for(let i=0;i<900;i++){ x.fillStyle=`rgba(120,100,70,${Math.random()*0.05})`; x.fillRect(Math.random()*1080,Math.random()*1920,2,2); }
    // 이중 테두리 (부적 프레임)
    x.strokeStyle="#b5493a"; x.lineWidth=10; x.strokeRect(50,50,980,1820);
    x.lineWidth=3; x.strokeRect(80,80,920,1760);
    // 상단
    x.fillStyle="#8a7a5c"; x.font='500 40px "Noto Serif KR", serif'; x.textAlign="center";
    x.fillText("四 柱 · "+SEASON_NAMES[season], 540, 220);
    // 라벨 (핵심)
    x.fillStyle="#241f18"; x.font='700 95px "Noto Serif KR", serif';
    const words=label.split(" ");
    let ly=460;
    if(words.length>2){ x.fillText(words.slice(0,2).join(" "),540,ly); x.fillText(words.slice(2).join(" "),540,ly+130); ly+=130; }
    else { x.fillText(label,540,ly+60); ly+=60; }
    // 명식 세로 4주
    const order=["year","month","day","hour"];
    const startX=270, gap=180;
    x.font='700 110px "Noto Serif KR", serif';
    order.forEach((k,i)=>{
      const p=P[k]; const cx=startX+i*gap;
      if(!p){ x.fillStyle="#b3a88f"; x.fillText("—",cx,ly+320); x.fillText("—",cx,ly+460); return; }
      x.fillStyle=ELEM_COLOR[STEM_ELEM[p.stem]]; x.fillText(STEMS[p.stem],cx,ly+320);
      x.fillStyle=ELEM_COLOR[BRANCH_ELEM[p.branch]]; x.fillText(BRANCHES[p.branch],cx,ly+460);
    });
    x.fillStyle="#8a7a5c"; x.font='400 34px "Noto Serif KR", serif';
    ["년","월","일","시"].forEach((t,i)=>x.fillText(t,startX+i*gap,ly+540));
    // 구분선
    x.strokeStyle="#c9b98f"; x.lineWidth=2;
    x.beginPath(); x.moveTo(200,ly+620); x.lineTo(880,ly+620); x.stroke();
    // 궁합 태그
    x.fillStyle="#241f18"; x.font='500 44px "Noto Serif KR", serif';
    x.fillText(`합이 드는 상대 · ${hapTitle}`, 540, ly+730);
    x.fillText(`나를 채우는 기운 · ${ELEM_KO[motherElem]}`, 540, ly+810);
    // 인장
    x.fillStyle="#b5493a";
    x.beginPath(); x.arc(540, 1650, 95, 0, Math.PI*2); x.fill();
    x.fillStyle="#f3ecdd"; x.font='700 52px "Noto Serif KR", serif';
    x.fillText("맑은",540,1635); x.fillText("사주",540,1695);
    // URL
    x.fillStyle="#8a7a5c"; x.font='400 30px "Noto Serif KR", serif';
    x.fillText("malgeun-saju",540,1810);
    c.toBlob(blob=>{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download=`맑은사주_${label.replace(/\s/g,"")}.png`;
      a.click(); URL.revokeObjectURL(a.href);
      toast("부적 카드를 저장했어요 — 스토리에 올려보세요");
    },"image/png");
  });
}

function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2200);
}
