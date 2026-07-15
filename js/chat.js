/* 맑은사주 — 대화 UI (Claude 백엔드 연동) + 궁합
 *
 * 계산된 사주를 근거 텍스트로 만들어 백엔드로 보내고, 답변(JSON {text})을 표시한다.
 * 궁합: 상대 생년월일을 받아 상대 사주도 코드로 계산 → 두 명식의 교차 관계까지
 *       근거로 넘겨 Claude가 궁합을 본다 (명식은 지어내지 않음).
 * 백엔드는 chat-backend/ 의 Vercel Node 서버리스 함수(AWS egress → Anthropic).
 */
"use strict";

const WORKER_URL = "https://saju-chat-vercel.vercel.app/api/chat";

let CHAT_HISTORY = [];   // {role, content}
let CHAT_CTX = "";       // 근거 사주 텍스트 (본인 또는 궁합)
let MY_R = null;         // 본인 계산 결과 (궁합용 보관)

/* 계산된 사주 → 근거 텍스트 (한 사람) */
function buildChartText(r) {
  const P = r.pillars, ds = P.day.stem;
  const gz = k => P[k] ? `${STEMS[P[k].stem]}${BRANCHES[P[k].branch]}(${STEMS_KO[P[k].stem]}${BRANCHES_KO[P[k].branch]})` : "시간모름";
  const cnt = elementCount(P);
  const st = strengthEstimate(P).label.replace("(참고)", "");
  const it = interpret(r, "expert");
  const now = new Date().getFullYear();
  const cur = r.luckPillars.find(lp => now >= lp.startYear && now < lp.startYear + 10);
  const yf = yearlyFortune(P, now, 1)[0];
  const lines = [];
  lines.push(`명식(년월일시): 연 ${gz("year")} · 월 ${gz("month")} · 일 ${gz("day")} · 시 ${gz("hour")}`);
  lines.push(`일간: ${STEMS[ds]}(${STEMS_KO[ds]}) · 성별: ${r.input.gender === "M" ? "남성" : "여성"}`);
  lines.push(`오행 개수: 목${cnt.목} 화${cnt.화} 토${cnt.토} 금${cnt.금} 수${cnt.수} · 신강약(참고): ${st}`);
  if (it.structures.length) lines.push(`대표 구조: ${it.structures.join(" / ")}`);
  const rel = [...it.stemRel, ...it.branchRel];
  if (rel.length) lines.push(`글자 관계(합충형): ${rel.slice(0, 5).join(" / ")}`);
  if (cur) lines.push(`현재 대운: ${STEMS[cur.stem]}${BRANCHES[cur.branch]} (${cur.startAge}~${cur.startAge + 9}세), 십성 ${tenGod(ds, cur.stem)}`);
  lines.push(`올해(${now} ${STEMS[yf.stem]}${BRANCHES[yf.branch]}): ${yf.stemGod}·${yf.branchGod}${yf.events.length ? " — " + yf.events.join("; ") : ""}`);
  return lines.join("\n");
}

/* ---- 궁합: 두 사주의 교차 관계 (계산값) ---- */
function branchesOf(P) { return ["year", "month", "day", "hour"].filter(k => P[k]).map(k => ({ pos: k, b: P[k].branch })); }
function stemsOf(P) { return ["year", "month", "day", "hour"].filter(k => P[k]).map(k => ({ pos: k, s: P[k].stem })); }

function crossRelations(myP, pP) {
  const out = [];
  const mB = branchesOf(myP), pB = branchesOf(pP);
  for (const a of mB) for (const b of pB) {
    const tag = `내 ${POS_KO_BRANCH[a.pos]} ${BRANCHES_KO[a.b]} ↔ 상대 ${POS_KO_BRANCH[b.pos]} ${BRANCHES_KO[b.b]}`;
    const diff = ((a.b - b.b) % 12 + 12) % 12;
    if (diff === 6) out.push({ p: 9, t: `${tag}: 충 — 서로 부딪히고 흔드는 자리(변화·긴장)` });
    else if (IREL_YUKHAP[a.b] === b.b) out.push({ p: 8, t: `${tag}: 육합 — 강하게 끌리고 잘 묶이는 자리` });
    else if (a.b === b.b && IREL_SELFHYEONG.includes(a.b)) out.push({ p: 5, t: `${tag}: 같은 글자 겹침 — 닮은 고집(자형 기운)` });
    else if ((a.b === 0 && b.b === 3) || (a.b === 3 && b.b === 0)) out.push({ p: 5, t: `${tag}: 형 — 예의·관계에서 엇박` });
    else if (IREL_SAMHYEONG.some(t => t.includes(a.b) && t.includes(b.b)) && diff !== 6) out.push({ p: 5, t: `${tag}: 형(刑) — 마찰 기운` });
    else if (IREL_PA[a.b] === b.b) out.push({ p: 3, t: `${tag}: 파 — 살짝 어긋남(경미)` });
    else if (IREL_HAE[a.b] === b.b) out.push({ p: 3, t: `${tag}: 해 — 사소한 서운함(경미)` });
  }
  for (const a of stemsOf(myP)) for (const b of stemsOf(pP)) {
    if (IREL_STEMHAP[a.s] === b.s) {
      const pri = (a.pos === "day" || b.pos === "day") ? 8 : 6;
      out.push({ p: pri, t: `내 ${POS_KO_STEM[a.pos]} ${STEMS_KO[a.s]} ↔ 상대 ${POS_KO_STEM[b.pos]} ${STEMS_KO[b.s]}: 천간합 — ${ELEM_KO[IREL_STEMHAP_ELEM[a.s]]}으로 화합` });
    }
  }
  out.sort((x, y) => y.p - x.p);
  return out.map(o => o.t);
}

function buildCompatText(myR, pR) {
  const md = myR.pillars.day.stem, pd = pR.pillars.day.stem;
  const lines = [];
  lines.push("=== 궁합 분석: 두 사람의 계산된 사주 ===");
  lines.push("[본인]"); lines.push(buildChartText(myR));
  lines.push(""); lines.push("[상대]"); lines.push(buildChartText(pR));
  lines.push(""); lines.push("=== 두 사주의 관계 (계산값 — 이 관계를 근거로 궁합을 보세요) ===");
  lines.push(`일간 관계: 상대(${STEMS_KO[pd]})는 나(${STEMS_KO[md]})에게 십성 '${tenGod(md, pd)}', 나는 상대에게 '${tenGod(pd, md)}'`);
  const cr = crossRelations(myR.pillars, pR.pillars);
  lines.push(cr.length ? "지지·천간 교차:\n- " + cr.slice(0, 10).join("\n- ") : "지지·천간 교차: 뚜렷한 합·충·형이 적음(무난한 편)");
  const mc = elementCount(myR.pillars), pc = elementCount(pR.pillars);
  const myLack = ["목", "화", "토", "금", "수"].filter(e => mc[e] === 0);
  const comp = myLack.filter(e => pc[e] >= 2);
  if (comp.length) lines.push(`오행 보완: 내게 없는 ${comp.join("·")} 기운을 상대가 갖춰 보완됨`);
  return lines.join("\n");
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/* 결과 렌더 후 app.js가 호출 */
window.mountSajuChat = function (r) {
  CHAT_HISTORY = [];
  MY_R = r;
  CHAT_CTX = buildChartText(r);
  const host = document.getElementById("result");
  if (!host) return;
  const old = document.getElementById("saju-chat");
  if (old) old.remove();

  const box = el("section", "chat-box");
  box.id = "saju-chat";
  box.innerHTML = `
    <div class="report-cta">
      <h2 class="report-title">✨ 나만의 심층 리포트</h2>
      <p class="report-sub">계산된 내 사주를 <b>쉬운 말로 길게</b> 풀어드려요 — 성격·일·돈·인연·올해 흐름 + 실천 조언까지. <del>990원</del> <b>오픈 기념 무료</b></p>
      <button class="btn" id="report-go">내 심층 리포트 받기</button>
      <div id="report-out" class="report-out"></div>
    </div>
    <div class="chat-head"><span class="ch-no">問</span><h2>사주에게 물어보기</h2>
      <span class="badge badge-interp">대화</span></div>
    <p class="chat-note">계산된 내 사주에 근거해 답합니다. 해석은 전통 통설 참고용이에요.</p>
    <div class="chat-log" id="chat-log"></div>
    <div class="chat-input-row">
      <input id="chat-input" type="text" placeholder="예: 올해 이직해도 될까요?" autocomplete="off">
      <button class="btn" id="chat-send">보내기</button>
    </div>
    <div class="chat-suggest" id="chat-suggest">
      <button data-q="올해 전체 운을 짧게 요약해줘">올해 운세</button>
      <button data-q="내 성격의 장점과 약점을 알려줘">내 성격</button>
      <button data-q="어떤 일이나 직업이 잘 맞아?">직업 적성</button>
      <button data-q="돈은 어떻게 관리하는 게 좋아?">재물 관리</button>
    </div>
    <div class="chat-compat">
      <button class="btn secondary" id="compat-toggle">💑 다른 사람과 궁합 보기</button>
      <div class="compat-form hidden" id="compat-form">
        <p class="compat-note">상대(남친·친구 등) 생년월일을 넣으면, 두 사주를 계산해 궁합을 봐드려요.</p>
        <div class="compat-fields">
          <input id="p-year" type="number" placeholder="년(예 1994)" inputmode="numeric">
          <input id="p-month" type="number" placeholder="월" inputmode="numeric">
          <input id="p-day" type="number" placeholder="일" inputmode="numeric">
          <select id="p-hour"></select>
          <select id="p-gender"><option value="M">남자</option><option value="F">여자</option></select>
          <select id="p-city"></select>
        </div>
        <button class="btn" id="compat-go">이 사람과 궁합 보기</button>
      </div>
    </div>`;
  host.appendChild(box);

  // 시(時)·도시 셀렉트 채우기
  const hourSel = box.querySelector("#p-hour");
  hourSel.appendChild(new Option("시간 모름", ""));
  for (let h = 0; h < 24; h++) hourSel.appendChild(new Option(String(h).padStart(2, "0") + "시", String(h)));
  const citySel = box.querySelector("#p-city");
  (typeof CITIES !== "undefined" ? CITIES : [{ name: "모름(중부)", lon: 127.5 }]).forEach((c, i) => citySel.appendChild(new Option(c.name, String(i))));
  // 상대 성별 기본값 = 본인 반대
  box.querySelector("#p-gender").value = (r.input.gender === "M") ? "F" : "M";

  const input = box.querySelector("#chat-input");
  const sendBtn = box.querySelector("#chat-send");
  const send = () => submitChat(input.value);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  box.querySelectorAll(".chat-suggest button").forEach(b =>
    b.addEventListener("click", () => submitChat(b.dataset.q)));
  box.querySelector("#compat-toggle").addEventListener("click", () => {
    box.querySelector("#compat-form").classList.toggle("hidden");
  });
  box.querySelector("#compat-go").addEventListener("click", submitCompat);
  box.querySelector("#report-go").addEventListener("click", generateReport);

  if (!WORKER_URL) {
    addMsg("assistant", "사주에게 직접 물어보는 대화 기능을 준비 중이에요 🙏 곧 열립니다.");
    input.placeholder = "대화 기능 준비 중이에요";
  }
};

function submitCompat() {
  const box = document.getElementById("saju-chat");
  const y = +box.querySelector("#p-year").value, m = +box.querySelector("#p-month").value, d = +box.querySelector("#p-day").value;
  const hv = box.querySelector("#p-hour").value;
  const hourUnknown = hv === "";
  const g = box.querySelector("#p-gender").value;
  const ci = +box.querySelector("#p-city").value || 0;
  const lon = (typeof CITIES !== "undefined" && CITIES[ci]) ? CITIES[ci].lon : 127.5;
  const name = (typeof CITIES !== "undefined" && CITIES[ci]) ? CITIES[ci].name : "모름";
  if (!y || !m || !d || y < 1900 || y > 2050) { alert("상대 생년월일을 확인해주세요 (년/월/일)"); return; }
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1 || dt.getDate() !== d) { alert("존재하지 않는 날짜입니다"); return; }
  const input = { year: y, month: m, day: d, hour: hourUnknown ? 12 : +hv, minute: 0, hourUnknown, gender: g, longitude: lon, placeName: name };
  let pR;
  try { pR = computeSaju(input); } catch (e) { alert("계산 오류: " + (e.message || e)); return; }

  CHAT_CTX = buildCompatText(MY_R, pR);
  CHAT_HISTORY = [];
  box.querySelector("#compat-form").classList.add("hidden");
  const P = pR.pillars;
  const gz = k => P[k] ? STEMS[P[k].stem] + BRANCHES[P[k].branch] : "시모름";
  addMsg("assistant", `궁합 상대 사주를 계산했어요 💑<br>상대 명식: ${gz("year")} ${gz("month")} ${gz("day")} ${gz("hour")} (${g === "M" ? "남" : "여"})<br>이제 궁합을 물어보세요 — 예: <b>성격 궁합</b>, <b>잘 맞는 점과 조심할 점</b>, <b>연애·결혼운</b>, <b>돈 궁합</b>.`);
  // 추천 질문을 궁합용으로 교체
  const sug = document.getElementById("chat-suggest");
  if (sug) {
    sug.innerHTML = "";
    [["성격 궁합은 어때?", "성격 궁합"], ["우리 잘 맞는 점과 조심할 점 알려줘", "잘 맞는 점/조심할 점"],
     ["연애·결혼 궁합 봐줘", "연애·결혼운"], ["돈·현실 궁합은?", "돈 궁합"]].forEach(([q, label]) => {
      const b = el("button", null, label); b.dataset.q = q;
      b.addEventListener("click", () => submitChat(q)); sug.appendChild(b);
    });
  }
  const inp = document.getElementById("chat-input");
  if (inp) inp.placeholder = "예: 우리 성격 궁합 어때?";
}

function addMsg(role, html) {
  const log = document.getElementById("chat-log");
  const m = el("div", "chat-msg " + role, html);
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
  return m;
}

function submitChat(text) {
  text = (text || "").trim();
  if (!text) return;
  const input = document.getElementById("chat-input");
  if (input) input.value = "";
  if (!WORKER_URL) {
    addMsg("user", escapeHtml(text));
    addMsg("assistant", "대화 기능을 준비 중이에요 🙏 곧 열립니다!");
    return;
  }
  addMsg("user", escapeHtml(text));
  const holder = addMsg("assistant", '<span class="typing">…</span>');
  streamChat(text, holder);
}

async function streamChat(question, holder) {
  const sendBtn = document.getElementById("chat-send");
  if (sendBtn) sendBtn.disabled = true;
  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chartText: CHAT_CTX, question, history: CHAT_HISTORY }),
    });
    let data = null;
    try { data = await resp.json(); } catch { data = null; }
    if (!resp.ok || !data || data.error) {
      const msg = (data && (data.detail || data.error)) || ("HTTP " + resp.status);
      holder.innerHTML = "⚠️ 오류: " + escapeHtml(String(msg).slice(0, 200));
      return;
    }
    const text = String(data.text || "").trim();
    holder.innerHTML = escapeHtml(text || "(응답이 비어 있어요. 다시 시도해 주세요.)");
    if (text) {
      CHAT_HISTORY.push({ role: "user", content: question });
      CHAT_HISTORY.push({ role: "assistant", content: text });
      if (CHAT_HISTORY.length > 12) CHAT_HISTORY = CHAT_HISTORY.slice(-12);
    }
    const log = document.getElementById("chat-log");
    if (log) log.scrollTop = log.scrollHeight;
  } catch (e) {
    holder.innerHTML = "⚠️ 연결 실패: " + escapeHtml(String(e && e.message || e));
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

/* ---- 심층 리포트 (Claude 생성, 쉬운 말·긴 글·조언) ---- */
async function generateReport() {
  const btn = document.getElementById("report-go");
  const out = document.getElementById("report-out");
  if (!WORKER_URL) { out.innerHTML = '<p class="report-note">리포트 기능 준비 중이에요 🙏</p>'; return; }
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "리포트 쓰는 중… (20초쯤 걸려요)";
  out.innerHTML = '<p class="typing" style="padding:14px 2px">✍️ 당신의 사주를 읽고 쓰는 중이에요…</p>';
  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "report", chartText: buildChartText(MY_R) }),
    });
    let data = null; try { data = await resp.json(); } catch { data = null; }
    if (!resp.ok || !data || data.error) {
      out.innerHTML = '<p class="report-note">⚠️ ' + escapeHtml(String((data && (data.detail || data.error)) || ("오류 " + resp.status)).slice(0, 200)) + '</p>';
      return;
    }
    out.innerHTML = mdToHtml(String(data.text || ""));
  } catch (e) {
    out.innerHTML = '<p class="report-note">⚠️ 연결 실패: ' + escapeHtml(String(e && e.message || e)) + '</p>';
  } finally {
    btn.disabled = false;
    btn.textContent = out.innerHTML && !out.querySelector(".report-note") ? "리포트 다시 받기" : label;
  }
}

/* 아주 작은 마크다운 렌더 (제목·목록·굵게·구분선) */
function mdToHtml(md) {
  const inline = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  let html = "", inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of String(md).split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^###\s+/.test(line)) { closeList(); html += "<h5>" + inline(line.replace(/^###\s+/, "")) + "</h5>"; }
    else if (/^##\s+/.test(line)) { closeList(); html += "<h4>" + inline(line.replace(/^##\s+/, "")) + "</h4>"; }
    else if (/^#\s+/.test(line)) { closeList(); html += "<h3>" + inline(line.replace(/^#\s+/, "")) + "</h3>"; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li>"; }
    else if (/^---+$/.test(line)) { closeList(); html += "<hr>"; }
    else if (line.trim() === "") { closeList(); }
    else { closeList(); html += "<p>" + inline(line) + "</p>"; }
  }
  closeList();
  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
