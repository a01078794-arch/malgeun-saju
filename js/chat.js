/* 맑은사주 — 대화 UI (Claude 백엔드 연동)
 *
 * 계산된 사주를 근거 텍스트로 만들어 백엔드로 보내고, 답변(JSON {text})을 표시한다.
 * 백엔드는 chat-backend/ 의 Vercel Node 서버리스 함수(AWS egress → Anthropic).
 * (Cloudflare Workers는 Anthropic이 egress를 403으로 막아 Vercel로 이전함.)
 */
"use strict";

// 대화 백엔드 URL (Vercel Node 서버리스 — chat-backend/ 참고). 비우면 대화창은 "준비 중".
const WORKER_URL = "https://saju-chat-vercel.vercel.app/api/chat";

let CHAT_HISTORY = [];   // {role, content}
let CHAT_CTX = "";       // 근거 사주 텍스트

/* 계산된 사주 → Claude에 넘길 근거 텍스트 */
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
  lines.push(`일간: ${STEMS[ds]}(${STEMS_KO[ds]})`);
  lines.push(`오행 개수: 목${cnt.목} 화${cnt.화} 토${cnt.토} 금${cnt.금} 수${cnt.수}`);
  lines.push(`신강약(참고): ${st}`);
  if (it.structures.length) lines.push(`대표 구조: ${it.structures.join(" / ")}`);
  const rel = [...it.stemRel, ...it.branchRel];
  if (rel.length) lines.push(`글자 관계(합충형): ${rel.slice(0, 6).join(" / ")}`);
  lines.push(`대운(${r.forward ? "순행" : "역행"}): ${r.luckPillars.map(l => `${STEMS[l.stem]}${BRANCHES[l.branch]}(${l.startAge}세~)`).join(", ")}`);
  if (cur) lines.push(`현재 대운: ${STEMS[cur.stem]}${BRANCHES[cur.branch]} (${cur.startAge}~${cur.startAge + 9}세), 십성 ${tenGod(ds, cur.stem)}`);
  lines.push(`올해(${now}년 ${STEMS[yf.stem]}${BRANCHES[yf.branch]}): ${yf.stemGod}·${yf.branchGod}${yf.events.length ? " — " + yf.events.join("; ") : ""}`);
  const g = r.input.gender === "M" ? "남성" : "여성";
  lines.push(`성별: ${g}`);
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
  CHAT_CTX = buildChartText(r);
  const host = document.getElementById("result");
  if (!host) return;

  // 기존 채팅 제거 후 재부착
  const old = document.getElementById("saju-chat");
  if (old) old.remove();

  const box = el("section", "chat-box");
  box.id = "saju-chat";
  box.innerHTML = `
    <div class="chat-head"><span class="ch-no">問</span><h2>사주에게 물어보기</h2>
      <span class="badge badge-interp">대화</span></div>
    <p class="chat-note">계산된 내 사주에 근거해 답합니다. 해석은 전통 통설 참고용이에요.</p>
    <div class="chat-log" id="chat-log"></div>
    <div class="chat-input-row">
      <input id="chat-input" type="text" placeholder="예: 올해 이직해도 될까요? / 나랑 잘 맞는 사람은?" autocomplete="off">
      <button class="btn" id="chat-send">보내기</button>
    </div>
    <div class="chat-suggest">
      <button data-q="올해 전체 운을 짧게 요약해줘">올해 운세</button>
      <button data-q="내 성격의 장점과 약점을 알려줘">내 성격</button>
      <button data-q="어떤 일이나 직업이 잘 맞아?">직업 적성</button>
      <button data-q="돈은 어떻게 관리하는 게 좋아?">재물 관리</button>
    </div>`;
  host.appendChild(box);

  const input = box.querySelector("#chat-input");
  const sendBtn = box.querySelector("#chat-send");
  const send = () => submitChat(input.value);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  box.querySelectorAll(".chat-suggest button").forEach(b =>
    b.addEventListener("click", () => submitChat(b.dataset.q)));

  if (!WORKER_URL) {
    // 워커 미연결(=오픈 준비 중): 방문자에겐 친절한 안내만. 켜는 법은 worker/README.md.
    addMsg("assistant", "사주에게 직접 물어보는 대화 기능을 준비 중이에요 🙏 곧 열립니다 — 그 전에도 위의 사주 리포트는 전부 보실 수 있어요.");
    const inp = box.querySelector("#chat-input"); if (inp) inp.placeholder = "대화 기능 준비 중이에요";
  }
};

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
