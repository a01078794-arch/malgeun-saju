/* 맑은사주 — 이용 기록 관리자 페이지 (비밀번호 보호)
 * 열기: https://saju-chat-vercel.vercel.app/api/admin?pw=<ADMIN_PW>
 * 저장소: Vercel Blob(private) logs/*.json — logEvent가 이벤트당 1파일로 저장.
 */
export const config = { maxDuration: 30 };

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export default async function handler(req, res) {
  const PW = process.env.ADMIN_PW || "";
  const given = (req.query && (req.query.pw || req.query.PW)) || "";
  res.setHeader("content-type", "text/html; charset=utf-8");
  if (!PW || String(given) !== PW) {
    res.status(401).send(`<meta charset=utf-8><body style="font-family:sans-serif;padding:40px;max-width:520px;margin:auto">
      <h3>🔒 기록 보기</h3><p>주소 끝에 <code>?pw=비밀번호</code>를 붙여 열어주세요.</p>
      <form onsubmit="location.href=location.pathname+'?pw='+encodeURIComponent(this.pw.value);return false">
      <input name=pw type=password placeholder=비밀번호 style="padding:10px;font-size:16px;width:70%">
      <button style="padding:10px 16px;font-size:16px">열기</button></form></body>`);
    return;
  }

  let rows = [];
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "logs/", limit: 1000 });
    blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1)); // 최신순 (파일명에 타임스탬프)
    const top = blobs.slice(0, 500);
    const auth = { Authorization: "Bearer " + process.env.BLOB_READ_WRITE_TOKEN };
    const datas = await Promise.all(top.map(async b => {
      try {
        let r = await fetch(b.downloadUrl || b.url, { headers: auth });
        if (!r.ok && b.url && b.url !== b.downloadUrl) r = await fetch(b.url, { headers: auth });
        return await r.json();
      } catch { return null; }
    }));
    rows = datas.filter(Boolean);
  } catch (e) {
    res.status(500).send("<meta charset=utf-8><h3>불러오기 오류: " + esc(e.message || e) + "</h3>");
    return;
  }

  const fmt = ts => { try { return new Date(ts).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }); } catch { return ts || ""; } };
  const counts = {};
  rows.forEach(r => { counts[r.type || "?"] = (counts[r.type || "?"] || 0) + 1; });
  const summary = Object.entries(counts).map(([k, v]) => `${esc(k)} ${v}`).join(" · ");

  const trs = rows.map(r => `<tr>
    <td class=t>${esc(fmt(r.ts))}</td>
    <td><b>${esc(r.type)}</b></td>
    <td>${esc(r["생년월일"])}</td>
    <td>${esc(r["시"])}</td>
    <td>${esc(r["성별"])}</td>
    <td>${esc(r["지역"])}</td>
    <td class=m>${esc(r["명식"])}</td>
    <td class=q>${esc(r.question)}</td>
  </tr>`).join("");

  res.status(200).send(`<!doctype html><html lang=ko><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>맑은사주 기록</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;margin:0;background:#f3ecdd;color:#241f18}
  header{padding:18px 16px;background:#b5493a;color:#fff}
  header h1{font-size:1.1rem;margin:0}
  header p{margin:6px 0 0;font-size:.85rem;opacity:.9}
  .wrap{padding:14px}
  table{width:100%;border-collapse:collapse;background:#fff;font-size:.82rem}
  th,td{border:1px solid #e5dbc4;padding:7px 9px;text-align:left;vertical-align:top}
  th{background:#ede4d0;position:sticky;top:0}
  td.t{white-space:nowrap;color:#8a7a5c;font-size:.76rem}
  td.m{font-family:"Noto Serif KR",serif;white-space:nowrap}
  td.q{max-width:320px;word-break:break-word}
  tr:nth-child(even){background:#faf6ec}
  .empty{padding:40px;text-align:center;color:#8a7a5c}
</style>
<header><h1>🔮 맑은사주 — 이용 기록</h1><p>총 ${rows.length}건 · ${summary || "아직 없음"} · <a href="?pw=${encodeURIComponent(given)}" style="color:#fff">새로고침</a></p></header>
<div class=wrap>
${rows.length ? `<table><thead><tr><th>시각</th><th>종류</th><th>생년월일</th><th>시</th><th>성별</th><th>지역</th><th>명식</th><th>질문</th></tr></thead><tbody>${trs}</tbody></table>`
    : `<p class=empty>아직 기록이 없어요. 사이트에서 사주를 조회하거나 질문하면 여기 쌓입니다.</p>`}
</div></html>`);
}
