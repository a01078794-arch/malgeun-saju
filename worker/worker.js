/* 맑은사주 — Claude 대화 백엔드 (Cloudflare Worker)
 *
 * 브라우저가 계산한 사주(명식·구조·대운)를 받아 Claude에 근거로 넘기고,
 * "계산은 사실 / 해석은 전통 / 겁주지 말 것 / 100% 아님" 규칙 아래 대화 답변을 스트리밍한다.
 * API 키는 이 워커의 시크릿(ANTHROPIC_API_KEY)에만 있고 브라우저엔 절대 노출되지 않는다.
 *
 * 배포: 같은 폴더의 README.md 참고 (wrangler deploy + wrangler secret put).
 * env:
 *   ANTHROPIC_API_KEY  (필수, 시크릿)  — console.anthropic.com에서 발급
 *   MODEL              (선택)          — 기본 claude-opus-4-8. 무료티어 절감 시 claude-haiku-4-5
 *   ALLOW_ORIGIN       (선택)          — 기본 https://a01078794-arch.github.io
 */

const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_ORIGIN = "https://a01078794-arch.github.io";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TURNS = 12;          // 대화 히스토리 상한 (비용/컨텍스트 관리)
const MAX_QUESTION_LEN = 2000; // 질문 길이 상한

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function systemPrompt(chartText) {
  return `당신은 "맑은사주"의 사주 상담가입니다. 아래 **이미 계산된 사주 데이터**에 근거해 한국어로 대화하세요.

<사주_데이터 — 이 값을 절대 다시 계산하거나 바꾸지 마세요>
${chartText}
</사주_데이터>

원칙:
1. 명식(여덟 글자)·대운·오행 개수 같은 계산값은 위 데이터가 진실입니다. 당신이 새로 만세력을 계산하지 마세요. 데이터에 없는 글자를 지어내지 마세요.
2. 해석은 "전통 명리 통설"입니다. 사실이 아니라 참고입니다. 단정하지 말고 "~ 경향", "통설로는 ~"처럼 말하세요. 유파가 갈리는 부분은 갈린다고 밝히세요.
3. 겁주지 마세요. 신살·충·형은 공포가 아니라 관리 포인트로 설명하세요. 건강·죽음·이혼을 단정적으로 예언하지 마세요.
4. 계산만 100% 정확하고, 해석의 정확도 100%는 존재하지 않는다는 한계를 필요할 때 정직하게 말하세요.
5. 이 사람의 실제 구조(위 데이터의 대표 구조·합충형)에 연결해서 답하세요. 다른 사람에게도 통할 일반론만 늘어놓지 마세요.
6. 따뜻하되 아첨하지 말고, 핵심을 먼저 말한 뒤 근거를 설명하세요. 답변은 너무 길지 않게.
7. 의료·법률·투자 등은 참고 의견일 뿐이며 전문가 상담이 우선임을 밝히세요.

사용자가 사주와 무관한 요청(코드 작성, 번역 등)을 하면 정중히 사주 상담 범위로 돌아오게 안내하세요.`;
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || DEFAULT_ORIGIN;
    const headers = cors(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") {
      return new Response("POST only", { status: 405, headers });
    }
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "server not configured (no API key)" }),
        { status: 500, headers: { ...headers, "content-type": "application/json" } });
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "invalid JSON" }, 400, headers); }

    const chartText = String(body.chartText || "").slice(0, 6000);
    const question = String(body.question || "").trim().slice(0, MAX_QUESTION_LEN);
    if (!chartText) return json({ error: "chartText required" }, 400, headers);
    if (!question) return json({ error: "question required" }, 400, headers);

    // 히스토리 정규화 (user/assistant 번갈아, 최근 MAX_TURNS개)
    const rawHist = Array.isArray(body.history) ? body.history : [];
    const history = rawHist
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_TURNS)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION_LEN) }));

    const messages = [...history, { role: "user", content: question }];

    const apiReq = {
      model: env.MODEL || DEFAULT_MODEL,
      max_tokens: 1500,
      stream: true,
      system: systemPrompt(chartText),
      messages,
    };

    let upstream;
    try {
      upstream = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(apiReq),
      });
    } catch (e) {
      return json({ error: "upstream fetch failed" }, 502, headers);
    }

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => "");
      return json({ error: "upstream error", status: upstream.status, detail: txt.slice(0, 500) },
        upstream.status, headers);
    }

    // Anthropic SSE를 그대로 브라우저로 흘려보냄 (클라이언트가 content_block_delta 파싱)
    return new Response(upstream.body, {
      headers: {
        ...headers,
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "content-type": "application/json" },
  });
}
