/* 맑은사주 — UI 로직 */
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

let MODE = localStorage.getItem("sajuMode") || "easy"; // easy | expert
let LAST = null;

document.addEventListener("DOMContentLoaded", () => {
  const citySel = document.getElementById("city");
  CITIES.forEach((c,i)=>{
    const o = document.createElement("option");
    o.value = i; o.textContent = c.name;
    citySel.appendChild(o);
  });
  document.getElementById("saju-form").addEventListener("submit", onSubmit);
  document.getElementById("hour-unknown").addEventListener("change", e=>{
    document.getElementById("hour").disabled = e.target.checked;
    document.getElementById("minute").disabled = e.target.checked;
  });
  document.querySelectorAll(".mode-btn").forEach(b=>b.addEventListener("click", ()=>{
    MODE = b.dataset.mode; localStorage.setItem("sajuMode", MODE);
    updateModeButtons();
    if (LAST) render(LAST);
  }));
  updateModeButtons();
  // URL 파라미터 복원 (공유 링크)
  const q = new URLSearchParams(location.search);
  if (q.get("y")){
    document.getElementById("year").value = q.get("y");
    document.getElementById("month").value = q.get("mo");
    document.getElementById("day").value = q.get("d");
    if(q.get("h")!==null && q.get("h")!==""){ document.getElementById("hour").value=q.get("h"); document.getElementById("minute").value=q.get("mi")||0; }
    else { document.getElementById("hour-unknown").checked = true; document.getElementById("hour").disabled=true; document.getElementById("minute").disabled=true; }
    document.getElementById("gender").value = q.get("g")||"F";
    document.getElementById("city").value = q.get("c")||0;
    document.getElementById("saju-form").requestSubmit();
  }
});

function updateModeButtons(){
  document.querySelectorAll(".mode-btn").forEach(b=>b.classList.toggle("active", b.dataset.mode===MODE));
}

function onSubmit(e){
  e.preventDefault();
  const y = +document.getElementById("year").value;
  const m = +document.getElementById("month").value;
  const d = +document.getElementById("day").value;
  const hourUnknown = document.getElementById("hour-unknown").checked;
  const h = hourUnknown? null : +document.getElementById("hour").value;
  const mi = hourUnknown? null : +document.getElementById("minute").value;
  const g = document.getElementById("gender").value;
  const ci = +document.getElementById("city").value;
  if (!y || !m || !d || y<1900 || y>2050){ alert("생년월일을 확인해주세요 (1900~2050)"); return; }
  const dt = new Date(y, m-1, d);
  if (dt.getMonth() !== m-1 || dt.getDate() !== d){ alert("존재하지 않는 날짜입니다"); return; }
  const input = {year:y, month:m, day:d, hour:h??12, minute:mi??0, hourUnknown, gender:g, longitude:CITIES[ci].lon, placeName:CITIES[ci].name};
  const result = computeSaju(input);
  LAST = result;
  render(result);
  // 공유 URL 갱신
  const params = new URLSearchParams({y, mo:m, d, g, c:ci});
  if(!hourUnknown){ params.set("h",h); params.set("mi",mi); }
  history.replaceState(null,"", "?"+params.toString());
  document.getElementById("result").scrollIntoView({behavior:"smooth"});
}

function T(obj){ return obj[MODE] || obj.easy; }
function gz(p){ return STEMS[p.stem]+BRANCHES[p.branch]; }
function gzKo(p){ return STEMS_KO[p.stem]+BRANCHES_KO[p.branch]; }

function render(r){
  const el = document.getElementById("result");
  el.classList.remove("hidden");
  const P = r.pillars, ds = P.day.stem;
  const posOrder = [["hour","시주"],["day","일주"],["month","월주"],["year","연주"]];

  /* ---- 명식 카드 ---- */
  let pillarHtml = `<div class="pillar-grid">`;
  for (const [key,label] of posOrder){
    const p = P[key];
    if (!p){ pillarHtml += `<div class="pillar unknown"><div class="p-label">${label}</div><div class="p-char">?</div><div class="p-sub">시간 모름</div></div>`; continue; }
    const sGod = key==="day" ? "일간" : tenGod(ds, p.stem);
    const bGod = tenGodBranch(ds, p.branch);
    const stage = twelveStage(ds, p.branch);
    pillarHtml += `<div class="pillar ${key==='day'?'day-pillar':''}">
      <div class="p-label">${label}</div>
      <div class="p-god">${sGod}</div>
      <div class="p-char elem-${STEM_ELEM[p.stem]}">${STEMS[p.stem]}</div>
      <div class="p-char elem-${BRANCH_ELEM[p.branch]}">${BRANCHES[p.branch]}</div>
      <div class="p-god">${bGod}</div>
      <div class="p-sub">${stage}</div>
    </div>`;
  }
  pillarHtml += `</div>`;

  /* ---- 계산 과정 (투명성) ---- */
  let calcHtml = `<div class="badge badge-calc">계산 영역 — 100% 검증 가능</div>
    <ul class="calc-log">${r.calcLog.map(l=>`<li>${l}</li>`).join("")}</ul>`;
  if (r.warnings.length){
    calcHtml += `<div class="warnings">${r.warnings.map(w=>`<div class="warning">⚠️ ${w}</div>`).join("")}</div>`;
  }

  /* ---- 오행 ---- */
  const cnt = elementCount(P);
  const total = Object.values(cnt).reduce((a,b)=>a+b,0);
  let elemHtml = `<div class="elem-bars">`;
  for (const e of ["목","화","토","금","수"]){
    const pct = Math.round(cnt[e]/total*100);
    elemHtml += `<div class="elem-row"><span class="elem-name elem-${e}">${e}(${ELEM_KO[e]})</span>
      <div class="bar-track"><div class="bar elem-bg-${e}" style="width:${Math.max(pct,3)}%"></div></div>
      <span class="elem-cnt">${cnt[e]}</span></div>`;
  }
  elemHtml += `</div>`;
  const maxE = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  const zeros = Object.entries(cnt).filter(([,v])=>v===0).map(([k])=>k);
  let elemComment = "";
  if (maxE[1] >= 3) elemComment += `<p><b>${maxE[0]}(${ELEM_KO[maxE[0]]})이 많은 사주</b> — ${T(ELEM_TEXT_EXCESS[maxE[0]])}</p>`;
  zeros.forEach(z=>{ elemComment += `<p><b>${z}(${ELEM_KO[z]}) 없음</b> — ${T(ELEM_TEXT_LACK[z])}</p>`; });

  /* ---- 일간 + 조후 + 신강약 ---- */
  const dm = DAY_MASTER_TEXT[STEMS[ds]];
  const season = seasonOfMonthIdx(r.monthIdx);
  const johu = JOHU_HINT[STEM_ELEM[ds]][season];
  const st = strengthEstimate(P);
  const interp1 = `
    <div class="badge badge-interp">해석 영역 — 전통 통설 요약</div>
    <div class="dm-card">
      <div class="dm-emoji">${dm.emoji}</div>
      <h3>나의 본질: ${gzKo(P.day)} — ${SEASON_NAMES[season]}의 ${dm.title}</h3>
      <p>${T(dm)}</p>
      <p class="johu">🌡 <b>계절 처방</b> (궁통보감 조후 요약): ${johu}</p>
      <p class="strength"><b>기운 세기</b>: ${st.label.replace("(참고)","")} <span class="tag">${st.detail.join("·")}</span> — ${T(STRENGTH_TEXT[st.label])}</p>
      <p class="note">※ 신강약·용신 정밀 판단은 격국 전체를 봐야 하므로 여기서는 '참고치'로만 표시합니다 — 이게 정직한 한계입니다.</p>
    </div>`;

  /* ---- 십성 구성 ---- */
  const gods = {};
  for (const [key] of posOrder){
    const p = P[key]; if(!p) continue;
    if (key!=="day"){ const g1 = tenGod(ds,p.stem); gods[g1]=(gods[g1]||0)+1; }
    const g2 = tenGodBranch(ds,p.branch); gods[g2]=(gods[g2]||0)+1;
  }
  let godHtml = `<div class="god-chips">`;
  Object.entries(gods).sort((a,b)=>b[1]-a[1]).forEach(([g,n])=>{
    godHtml += `<div class="chip"><b>${g}${n>1?" ×"+n:""}</b><span>${T(TEN_GOD_TEXT[g])}</span></div>`;
  });
  godHtml += `</div>`;

  /* ---- 신살 ---- */
  const sals = shinsal(P, r.sajuYear);
  let salHtml = `<div class="sal-list">`;
  sals.forEach(s=>{
    const base = s.name.replace(/\(.*\)|\s×\d+/g,"").trim();
    const key = Object.keys(SHINSAL_TEXT).find(k=>base.startsWith(k.replace(/\(.*\)/,"")))
      || Object.keys(SHINSAL_TEXT).find(k=>s.name.startsWith(k));
    const desc = key? T(SHINSAL_TEXT[key]) : "";
    salHtml += `<div class="sal ${s.absent?'absent':''} ${s.good===false?'care':''}">
      <b>${s.name}</b> <span class="where">${s.where}</span>
      <p>${desc}${s.absent? " — 지금은 없지만 '언제 들어오는지'가 포인트예요.":""}</p></div>`;
  });
  salHtml += `</div><p class="note">※ 신살은 보조 지표입니다. 겁주는 도구가 아니라 관리 포인트로만 읽으세요.</p>`;

  /* ---- 대운 ---- */
  const nowYear = new Date().getFullYear();
  let luckHtml = `<div class="luck-strip">`;
  r.luckPillars.forEach(lp=>{
    const active = nowYear >= lp.startYear && nowYear < lp.startYear+10;
    const sg = tenGod(ds, lp.stem), bg = tenGodBranch(ds, lp.branch);
    luckHtml += `<div class="luck ${active?'active':''}">
      <div class="l-age">${lp.startAge}세<br><span>${lp.startYear}~</span></div>
      <div class="l-gz">${STEMS[lp.stem]}${BRANCHES[lp.branch]}</div>
      <div class="l-god">${sg}·${bg}</div>
    </div>`;
  });
  luckHtml += `</div>
  <p class="note">대운수 ${r.luckStart} · ${r.forward?"순행":"역행"} — 10년 단위로 삶의 배경 계절이 바뀝니다. 현재 대운이 하이라이트되어 있어요.</p>`;

  /* ---- 올해·향후 세운 ---- */
  const years = yearlyFortune(P, nowYear, 3);
  let yearHtml = `<div class="year-cards">`;
  years.forEach(yf=>{
    yearHtml += `<div class="ycard">
      <h4>${yf.year} ${STEMS[yf.stem]}${BRANCHES[yf.branch]}년</h4>
      <p class="ygods">${yf.stemGod} · ${yf.branchGod}</p>
      <p>${T(TEN_GOD_TEXT[yf.stemGod])}</p>
      ${yf.events.map(e=>`<p class="yevent">✨ ${e}</p>`).join("")}
    </div>`;
  });
  yearHtml += `</div>`;

  /* ---- 조립 ---- */
  el.innerHTML = `
    <section class="card">
      <h2>📜 나의 명식</h2>
      ${pillarHtml}
      <details class="calc-details" open><summary>이 명식이 나온 계산 과정 (전부 공개)</summary>${calcHtml}</details>
    </section>
    <section class="card">
      <h2>🌗 오행 균형 <span class="badge badge-calc small">계산</span></h2>
      ${elemHtml}
      <div class="interp-block">${elemComment}</div>
    </section>
    <section class="card">${interp1}</section>
    <section class="card">
      <h2>🧩 내 안의 기운들 (십성) <span class="badge badge-interp small">해석</span></h2>
      ${godHtml}
    </section>
    <section class="card">
      <h2>⭐ 신살 <span class="badge badge-interp small">해석</span></h2>
      ${salHtml}
    </section>
    <section class="card">
      <h2>🛤 대운 — 10년 단위 흐름 <span class="badge badge-calc small">계산</span></h2>
      ${luckHtml}
    </section>
    <section class="card">
      <h2>📅 올해와 앞으로 <span class="badge badge-interp small">해석</span></h2>
      ${yearHtml}
    </section>
    <section class="card share-card">
      <h2>🔗 공유</h2>
      <p>지금 주소(URL)를 복사하면 이 결과가 그대로 재현됩니다.</p>
      <button id="copy-link" class="btn">결과 링크 복사</button>
      <button id="copy-text" class="btn secondary">텍스트 요약 복사</button>
    </section>
    <section class="card premium">
      <h2>💎 더 깊이 보기</h2>
      ${PREMIUM_ITEMS.map(p=>`<div class="prem-item"><b>${p.name}</b> <span class="price">${p.price}</span><p>${p.desc}</p></div>`).join("")}
      <p class="note">광고 없음 · 겁주기 없음 · 결제 유도 팝업 없음 — 기본 리딩은 언제나 무료입니다.</p>
    </section>`;

  document.getElementById("copy-link").addEventListener("click", ()=>{
    navigator.clipboard.writeText(location.href).then(()=>toast("링크를 복사했어요"));
  });
  document.getElementById("copy-text").addEventListener("click", ()=>{
    const txt = `[맑은사주] ${r.input.year}.${r.input.month}.${r.input.day} ${r.input.hourUnknown?"(시간모름)":pad(r.input.hour)+":"+pad(r.input.minute)}
명식: ${P.hour?gzKo(P.hour)+"시 ":""}${gzKo(P.day)}일 ${gzKo(P.month)}월 ${gzKo(P.year)}년
일간: ${gzKo(P.day)} — ${SEASON_NAMES[season]}의 ${dm.title}
${location.href}`;
    navigator.clipboard.writeText(txt).then(()=>toast("요약을 복사했어요"));
  });
}

function toast(msg){
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1800);
}
