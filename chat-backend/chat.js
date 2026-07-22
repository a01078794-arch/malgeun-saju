/* 맑은사주 — Claude 백엔드 (Vercel Node 서버리스 함수)
 *
 * ⚠️ 반드시 Node 런타임(기본) — Edge 런타임 쓰면 Cloudflare 위에서 돌아 Anthropic이 막음(403).
 *
 * 모드 3개:
 *  - chat   : 사주 상담 대화 (haiku, JSON {text})
 *  - report : 유료급 심층 리포트 (sonnet, **스트리밍** — 텍스트가 실시간으로 흘러온다)
 *             잘림 원천 차단: max_tokens 16000 + stop_reason=max_tokens면 이어쓰기 최대 2회
 *  - log    : 이용 기록 저장 (Vercel Blob)
 *
 * env: ANTHROPIC_API_KEY(필수) · MODEL(대화, 기본 haiku) · REPORT_MODEL(리포트, 기본 sonnet)
 *      · ALLOW_ORIGIN · BLOB_READ_WRITE_TOKEN
 */

const DEFAULT_MODEL = "claude-haiku-4-5";          // 대화용 (빠르고 저렴)
const DEFAULT_REPORT_MODEL = "claude-sonnet-4-6";  // 리포트용 (유료 상품 품질)
const DEFAULT_ORIGIN = "https://a01078794-arch.github.io";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TURNS = 12;
const MAX_Q = 2000;
const MAX_CHART = 16000;          // 풍부한 계산 컨텍스트 허용
const REPORT_MAX_TOKENS = 16000;  // 리포트 1회 예산 (한국어 6천자 리포트도 여유)
const REPORT_CONTINUATIONS = 2;   // 그래도 잘리면 이어쓰기 횟수

export const config = { maxDuration: 300, supportsResponseStreaming: true };

/* ---------------- 대화 프롬프트 ---------------- */
function systemPrompt(chartText) {
  return `당신은 "맑은사주"의 사주 상담가입니다. 아래 **이미 계산된 사주 데이터**에 근거해 한국어로 대화하세요.

<사주_데이터 — 이 값을 절대 다시 계산하거나 바꾸지 마세요>
${chartText}
</사주_데이터>

원칙:
1. 명식(여덟 글자)·대운·오행 개수 같은 계산값은 위 데이터가 진실입니다. 만세력을 새로 계산하거나 없는 글자를 지어내지 마세요.
2. 해석은 "전통 명리 통설"이며 사실이 아니라 참고입니다. 단정 대신 "~한 경향이에요"처럼 말하고, 유파가 갈리면 갈린다고 밝히세요.
3. **쉬운 한국어로.** 한자 단독 표기 금지. 전문용어(식신, 편관, 충 등)는 꼭 필요할 때만 쓰되 반드시 쉬운 풀이를 함께 붙이세요. 예: "식신(내가 만들어내는 재능 기운)".
4. 겁주지 마세요. 신살·충·형은 공포가 아니라 관리 포인트로. 건강·죽음·이혼을 단정 예언하지 마세요.
5. **이 사람 사주에만 해당하는 말을 하세요.** 누구에게나 맞는 두루뭉술한 말(바넘 문장)은 금지. 답할 때 "당신 사주의 ○○ 때문에"처럼 위 데이터의 실제 글자·구조를 근거로 연결하세요.
6. 시기 질문에는 위 데이터의 대운·세운에서 **구체적인 연도**를 짚어 답하세요.
7. 따뜻하되 아첨하지 말고, 핵심부터 말한 뒤 근거를 설명하세요. 답변은 너무 길지 않게.
8. 의료·법률·투자 등은 참고일 뿐 전문가 상담이 우선임을 밝히세요.
9. 데이터에 [본인]과 [상대] 두 사람 + "궁합 관계"가 있으면 궁합 상담입니다. 계산된 관계를 근거로 좋은 점과 조심할 점을 균형 있게 짚으세요. 궁합은 참고이지 운명 판정이 아니며, 관계는 두 사람의 노력으로 달라진다는 점을 밝히세요.

사주와 무관한 요청(코드·번역 등)은 정중히 사주 상담 범위로 안내하세요.`;
}

/* ---------------- 심층 리포트 프롬프트 ----------------
 * 설계 근거 (2026-07 딥리서치, 적대 검증 통과 결론만 반영):
 *  - '돈 값 한다' 3대 동인: 나이대별 타임라인 / 행동 지침 구체성 / 성격 개인화 체감
 *  - 최대 실패 패턴: 품질 비일관성 → 고정 목차 + 필수 요소 하드코딩
 *  - 분량-만족 상관은 기각됨 → 길이가 아니라 밀도
 *  - 미제공 변수 도입 금지(환각 방지) / 고전 인용 빼고 담백 직설(강헌 톤)
 */
function reportPrompt(chartText) {
  return `당신은 "맑은사주"의 수석 사주 상담가입니다. 아래 **이미 계산된 사주 데이터**만 근거로, 이 사람 한 명을 위한 **프리미엄 심층 리포트**를 한국어로 씁니다. 시중 유료 리포트(수만 원대)보다 나은 품질이 목표입니다.

<사주_데이터 — 이 값을 절대 다시 계산하거나 바꾸지 마세요>
${chartText}
</사주_데이터>

## 데이터 규칙 (환각 방지 — 어기면 실패)
- 위 데이터에 **있는 것만** 쓰세요. 데이터에 없는 개념(태원·명궁·공망·귀문관살 등)이나 없는 글자·연도를 도입하지 마세요.
- 명식·대운·세운·오행 개수는 위 값이 진실입니다. 재계산 금지.

## 문체 규칙
- 독자는 사주를 처음 보는 사람입니다. **중학생도 술술 읽는 쉬운 한국어**로만 쓰세요.
- **한자 단독 표기 금지.** 간지 글자는 "계수(癸)"처럼 한글을 앞에. 전문용어는 처음 1회만 "식신(내 손으로 만들어내는 재능 기운)"처럼 풀이를 붙이고, 이후에는 풀이한 쉬운말 쪽을 쓰세요.
- **고전 인용·현학적 설명 금지.** 책 이름, 옛 문헌 이야기로 빙 돌지 말고 본론 직행. 담백한 단문으로.
- 결론 먼저, 근거 다음: "당신은 ~한 사람이에요. 사주에 ~가 있거든요." 한 문단 2~4문장.
- 독자를 부를 땐 데이터의 캐릭터 라벨을 쓰세요 (예: "새벽 이슬로 태어난 당신은"). 지금 계절(오늘 날짜 참고)의 계절감을 살린 표현을 리포트에 한두 번 녹이세요.

## 내용 규칙
1. **바넘 문장 금지.** "때로는 외향적이고 때로는 내향적" 같은 누구에게나 맞는 말은 한 문장도 쓰지 마세요. 모든 단락은 이 사주의 실제 글자·구조·수치에서만 나와야 합니다. 성격 묘사는 뭉개지 말고 **단정적으로 구체적으로** — 근거가 계산 데이터에 있으니 자신 있게.
2. **근거를 보여주세요.** 중요한 주장마다 "당신 사주에 ○○이 ○개라서" 식으로 데이터와 연결. 근거를 못 대는 말은 쓰지 마세요.
3. **연도와 나이를 구체적으로.** 대운·세운의 실제 연도(예: 2028년, 35세)를 짚으세요. "언젠가", "곧" 금지.
4. **과거 검증(백캐스팅) 2~3개.** 이미 지나간 대운·세운에서 "○○년 무렵(○세) ~한 변화가 있었을 가능성이 커요 — 맞다면 이 풀이가 당신에게 잘 작동하는 겁니다"처럼 독자가 스스로 확인할 대목을. 단, 계산된 글자 관계에서 나온 것만.
5. **겁주기 금지, 좋은 말 잔치도 금지.** 그림자·조심할 시기를 정직하게 쓰되, 반드시 "그래서 이렇게 하면 된다"는 처방을 붙이세요. 건강·죽음·이혼 단정 금지.
6. **모든 섹션에 행동 지침 최소 1개.** "긍정적으로 사세요" 금지. "동업 계약서는 쓰기 전 3일 묵히세요"처럼 당장 실행 가능한 것.
7. 해석이 유파에 따라 갈리는 대목은 갈린다고 한 줄로 밝히세요. 그게 이 서비스의 신뢰 포인트입니다.

## 구성 (마크다운, 아래 ## 제목 그대로. 길이보다 밀도 — 전체 한국어 4,000~5,500자)

## 당신을 한 문장으로
(이 사주 전체를 꿰뚫는 비유 한 문장 — 굵게. 이어서 그 이유 2~3문장)

## 여덟 글자에 새겨진 것
(명식의 핵심 글자 2~3개가 무슨 뜻인지, 이 사주의 가장 큰 특징 하나 — 초보자용)

## 나는 어떤 사람인가 — 빛과 그림자
(강점 3가지 + 그림자 2가지. 각각 사주 근거. 그림자엔 관리법 한 줄씩)

## 어떤 일을 하며 살면 좋을까
(맞는 일의 종류·일하는 스타일·피해야 할 환경. 구체 직군 예시)

## 내 돈은 언제, 어떻게 모일까
(버는 방식, 새는 구멍, 돈이 움직이는 실제 연도. 재물 수치 근거)

## 사랑은 언제 오고, 어떤 사람이 맞을까
(연애 스타일, 잘 맞는 상대 유형, 인연 기운이 켜지는 실제 연도)

## 내 몸의 배터리 사용법
(이 사주의 방전 패턴과 회복법 — 오행 균형 근거. 의학적 조언이 아님을 명시)

## 내 인생의 큰 지도 — 나이대별 타임라인
(대운을 나이 구간별로: "17~26세(2011~2020) — ..." 형식. 지나간 구간 1~2개는 과거 검증으로, 현재 구간은 지금 상황 해석으로, 다가올 구간은 준비 포인트로. 이 섹션이 이 리포트의 심장입니다 — 가장 공들여서)

## 다가오는 10년, 해마다 한 줄
(연도별 한 줄 + 그중 중요한 해 2~3개는 3~4문장 깊게: 좋은 해엔 무엇을 하고, 조심할 해엔 무엇을 미룰지)

## 올해는 어떤 해인가
(올해 전체 기운 + 상반기/하반기 리듬. 월별 데이터 참고)

## 처방전 — 오늘부터 할 것 5가지
- (이 사주 전용 실천 5개, 각각 근거 한 줄 포함)

## 마치며
(2~3문장 격려 + "계산은 100% 검증 가능하지만 해석은 전통 통설이며 참고입니다" 정직 고지 1문장)

**반드시 "## 마치며"까지 완성하고 끝내세요.**`;
}

/* ---------------- 공용 ---------------- */
function cors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Vary", "Origin");
}

// 허용 출처 목록 (env ALLOW_ORIGIN 에 쉼표로 여러 개 지정 가능, 기본값은 DEFAULT_ORIGIN)
function allowedOrigins() {
  const raw = process.env.ALLOW_ORIGIN || DEFAULT_ORIGIN;
  return raw.split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
}

// 요청이 실제로 온 출처. 브라우저는 교차출처 POST에 Origin을 자동으로 붙인다.
// Origin이 없으면 Referer의 출처로 대체 판정한다. (curl/봇은 보통 둘 다 없다)
function requestOrigin(req) {
  let o = req.headers.origin;
  if (!o && req.headers.referer) { try { o = new URL(req.headers.referer).origin; } catch { o = ""; } }
  return (o || "").replace(/\/+$/, "");
}

async function logEvent(payload) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return "no-token";
  try {
    const { put } = await import("@vercel/blob");
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    await put(`logs/${id}.json`, JSON.stringify(payload), {
      access: "private", contentType: "application/json", addRandomSuffix: false,
    });
    return null;
  } catch (e) { return String((e && e.message) || e); }
}

function anthropicBody(model, maxTokens, system, messages, stream) {
  return JSON.stringify({ model, max_tokens: maxTokens, system, messages, stream: !!stream });
}
function anthropicHeaders() {
  return {
    "content-type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
}

/* Anthropic SSE 스트림을 읽어 텍스트 델타마다 onText 호출. {stopReason} 반환 */
async function pipeAnthropicStream(upstream, onText) {
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = "", stopReason = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop(); // 마지막 불완전 라인은 보류
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let ev;
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === "content_block_delta" && ev.delta && typeof ev.delta.text === "string") {
        onText(ev.delta.text);
      } else if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason) {
        stopReason = ev.delta.stop_reason;
      } else if (ev.type === "error") {
        throw new Error((ev.error && ev.error.message) || "stream error");
      }
    }
  }
  return { stopReason };
}

/* ---------------- 핸들러 ---------------- */
export default async function handler(req, res) {
  const allow = allowedOrigins();
  const reqOrigin = requestOrigin(req);
  const isAllowed = !!reqOrigin && allow.includes(reqOrigin);
  cors(res, isAllowed ? reqOrigin : allow[0]);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  // 오리진 검증 — 브라우저 밖(curl·봇)의 무단 프록시 사용 차단 (API 요금 방어)
  if (!isAllowed) { res.status(403).json({ error: "forbidden origin" }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: "server not configured (no API key)" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // 기록 모드
  if (body.mode === "log") {
    const err = await logEvent({ ...(body.event || {}), ts: new Date().toISOString() });
    res.status(200).json({ ok: !err, err: err || undefined });
    return;
  }

  const mode = body.mode === "report" ? "report" : "chat";
  const chartText = String(body.chartText || "").slice(0, MAX_CHART);
  if (!chartText) { res.status(400).json({ error: "chartText required" }); return; }

  await logEvent({
    type: mode,
    question: mode === "report" ? "[심층리포트]" : String(body.question || "").slice(0, 300),
    chart: chartText.slice(0, 200),
    ts: new Date().toISOString(),
  });

  if (mode === "report") { await handleReport(res, chartText); return; }

  /* ---- 대화 (JSON) ---- */
  const question = String(body.question || "").trim().slice(0, MAX_Q);
  if (!question) { res.status(400).json({ error: "question required" }); return; }
  const rawHist = Array.isArray(body.history) ? body.history : [];
  const history = rawHist
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_Q) }));

  let upstream;
  try {
    upstream = await fetch(API_URL, {
      method: "POST", headers: anthropicHeaders(),
      body: anthropicBody(process.env.MODEL || DEFAULT_MODEL, 2000, systemPrompt(chartText),
        [...history, { role: "user", content: question }], false),
    });
  } catch (e) { res.status(502).json({ error: "upstream fetch failed" }); return; }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data) {
    res.status(upstream.status || 502).json({
      error: "upstream error", status: upstream.status,
      detail: (data && data.error && data.error.message) || "",
    });
    return;
  }
  if (data.stop_reason === "refusal") {
    res.status(200).json({ text: "이 질문에는 답변을 드리기 어려워요. 사주 상담 범위에서 다시 물어봐 주세요." });
    return;
  }
  const text = Array.isArray(data.content)
    ? data.content.filter(b => b.type === "text").map(b => b.text).join("")
    : "";
  res.status(200).json({ text: text || "(응답이 비어 있어요. 다시 시도해 주세요.)" });
}

/* ---- 리포트 (스트리밍 텍스트 + 잘림 시 이어쓰기) ---- */
async function handleReport(res, chartText) {
  const model = process.env.REPORT_MODEL || DEFAULT_REPORT_MODEL;
  const system = reportPrompt(chartText);
  const userMsg = { role: "user", content: "위 사주 데이터로 심층 리포트를 써주세요. 반드시 '## 마치며'까지 완성해서 끝내세요." };

  let acc = "";            // 지금까지 만든 전체 리포트 (이어쓰기용)
  let started = false;     // 스트리밍 헤더를 이미 보냈는가

  const startStream = () => {
    if (started) return;
    started = true;
    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
  };

  for (let attempt = 0; attempt <= REPORT_CONTINUATIONS; attempt++) {
    const messages = acc
      ? [userMsg, { role: "assistant", content: acc }]  // 잘린 지점부터 이어쓰기
      : [userMsg];
    let upstream;
    try {
      upstream = await fetch(API_URL, {
        method: "POST", headers: anthropicHeaders(),
        body: anthropicBody(model, REPORT_MAX_TOKENS, system, messages, true),
      });
    } catch (e) {
      if (!started) res.status(502).json({ error: "upstream fetch failed" });
      else res.end("\n\n*(연결이 잠시 끊겼어요 — '리포트 다시 받기'를 눌러주세요.)*");
      return;
    }
    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => null);
      if (!started) {
        res.status(upstream.status || 502).json({
          error: "upstream error", status: upstream.status,
          detail: (errData && errData.error && errData.error.message) || "",
        });
      } else {
        res.end("\n\n*(생성 중 오류가 났어요 — '리포트 다시 받기'를 눌러주세요.)*");
      }
      return;
    }

    startStream();
    let stopReason = null;
    try {
      const r = await pipeAnthropicStream(upstream, t => { acc += t; res.write(t); });
      stopReason = r.stopReason;
    } catch (e) {
      res.end("\n\n*(생성 중 오류가 났어요 — '리포트 다시 받기'를 눌러주세요.)*");
      return;
    }
    if (stopReason !== "max_tokens") { res.end(); return; }  // 정상 완결
    // max_tokens로 잘림 → 루프 계속(이어쓰기)
  }
  res.end("\n\n*(리포트가 예외적으로 길어 여기서 마칩니다.)*");
}
