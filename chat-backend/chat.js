/* 맑은사주 — Claude 대화 백엔드 (Vercel Node 서버리스 함수)
 *
 * ⚠️ 반드시 Node 런타임(기본) — Edge 런타임 쓰면 Cloudflare 위에서 돌아 Anthropic이 막음(403).
 *    이 파일은 runtime을 edge로 지정하지 않으므로 AWS(iad1)에서 실행 → Anthropic 정상.
 *
 * 브라우저가 계산한 사주를 근거로 Claude를 부르고 답을 JSON({text})으로 돌려준다.
 * API 키는 Vercel 환경변수(ANTHROPIC_API_KEY)에만 있고 브라우저엔 노출 안 됨.
 *
 * env: ANTHROPIC_API_KEY(필수) · MODEL(선택, 기본 haiku) · ALLOW_ORIGIN(선택)
 */

const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_ORIGIN = "https://a01078794-arch.github.io";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TURNS = 12;
const MAX_Q = 2000;

export const config = { maxDuration: 30 };

function systemPrompt(chartText) {
  return `당신은 "맑은사주"의 사주 상담가입니다. 아래 **이미 계산된 사주 데이터**에 근거해 한국어로 대화하세요.

<사주_데이터 — 이 값을 절대 다시 계산하거나 바꾸지 마세요>
${chartText}
</사주_데이터>

원칙:
1. 명식(여덟 글자)·대운·오행 개수 같은 계산값은 위 데이터가 진실입니다. 만세력을 새로 계산하거나 없는 글자를 지어내지 마세요.
2. 해석은 "전통 명리 통설"이며 사실이 아니라 참고입니다. "~ 경향", "통설로는 ~"처럼 단정 없이 말하고, 유파가 갈리면 갈린다고 밝히세요.
3. 겁주지 마세요. 신살·충·형은 공포가 아니라 관리 포인트로. 건강·죽음·이혼을 단정 예언하지 마세요.
4. 계산만 100% 정확하고 해석의 정확도 100%는 없다는 한계를 필요할 때 정직하게 말하세요.
5. 이 사람의 실제 구조(위 데이터의 대표 구조·합충형)에 연결해 답하세요. 일반론만 늘어놓지 마세요.
6. 따뜻하되 아첨하지 말고, 핵심부터 말한 뒤 근거를 설명하세요. 답변은 너무 길지 않게.
7. 의료·법률·투자 등은 참고일 뿐 전문가 상담이 우선임을 밝히세요.

사주와 무관한 요청(코드·번역 등)은 정중히 사주 상담 범위로 안내하세요.`;
}

function cors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

export default async function handler(req, res) {
  const origin = process.env.ALLOW_ORIGIN || DEFAULT_ORIGIN;
  cors(res, origin);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: "server not configured (no API key)" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const chartText = String(body.chartText || "").slice(0, 6000);
  const question = String(body.question || "").trim().slice(0, MAX_Q);
  if (!chartText) { res.status(400).json({ error: "chartText required" }); return; }
  if (!question) { res.status(400).json({ error: "question required" }); return; }

  const rawHist = Array.isArray(body.history) ? body.history : [];
  const history = rawHist
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_Q) }));
  const messages = [...history, { role: "user", content: question }];

  let upstream;
  try {
    upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.MODEL || DEFAULT_MODEL,
        max_tokens: 1500,
        system: systemPrompt(chartText),
        messages,
      }),
    });
  } catch (e) {
    res.status(502).json({ error: "upstream fetch failed" });
    return;
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok || !data) {
    res.status(upstream.status || 502).json({
      error: "upstream error",
      status: upstream.status,
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
