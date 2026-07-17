const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = process.env.HOME + "/Projects/saju-web";

const html = fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const dom = new JSDOM(html, { runScripts:"outside-only", url:"https://example.com/?y=1994&mo=2&d=26&h=8&mi=30&g=F&c=0", pretendToBeVisual:true });
const { window } = dom;
// canvas/clipboard/fonts 스텁
window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {get:()=>()=>{}});
window.navigator.clipboard = { writeText: () => Promise.resolve() };
window.HTMLElement.prototype.scrollIntoView = function(){};
Object.defineProperty(window.document, "fonts", { value:{ load:()=>Promise.resolve(), ready:Promise.resolve() } });

let failures = [];
function check(name, cond, detail){ console.log((cond?"[PASS] ":"[FAIL] ")+name+(cond?"":" — "+(detail||""))); if(!cond) failures.push(name); }

{
  window.eval(["js/manseryeok.js","js/data.js","js/interp.js","js/chat.js","js/app.js"].map(f=>fs.readFileSync(path.join(ROOT,f),"utf8").replace(/"use strict";/g,"")).join("\n"));
}
window.document.dispatchEvent(new window.Event("DOMContentLoaded", {bubbles:true}));

setTimeout(()=>{
  const doc = window.document;
  // URL 파라미터 복원 → 자동 렌더 확인
  const result = doc.getElementById("result");
  check("결과 렌더됨", !result.classList.contains("hidden"));
  // v4: 공유 카드형 헤더
  check("공유 카드 존재", !!doc.getElementById("talisman"));
  const label = doc.querySelector(".id-label");
  check("캐릭터 라벨 = 새벽 이슬 (케이스B 초봄생)", label && label.textContent==="새벽 이슬", label&&label.textContent);
  check("카드에 한 줄 총평", (doc.querySelector(".id-verdict")?.textContent||"").length>10);
  // v4: 섹션 7개 이상 (본질/오행/명식/대운/질문/별/팁)
  const sects = doc.querySelectorAll("#result .sect");
  check("섹션 7개 이상 렌더", sects.length>=7, String(sects.length));
  // 명식 글자 확인 (연월일시 순: 甲戌 丙寅 癸未 丙辰)
  const chars = [...doc.querySelectorAll(".pillar-grid .p-char")].map(e=>e.firstChild.textContent).join("");
  check("명식 글자 정확 (甲戌丙寅癸未丙辰 순)", chars==="甲戌丙寅癸未丙辰", chars);
  // 한자 밑 한글 읽기
  check("한자에 한글 읽기 병기", doc.querySelectorAll(".pillar-grid .p-read").length===8, String(doc.querySelectorAll(".pillar-grid .p-read").length));
  // 오행 5색 지도
  check("오행 5색 셀", doc.querySelectorAll(".elem-cell").length===5);
  // Do/Don't
  check("Do/Don't 존재", doc.querySelectorAll(".dodont li").length>=2);
  // 계산 로그 공개
  check("계산 과정 공개", doc.querySelectorAll(".calc-log li").length>=2);
  // 대화 패널 렌더
  check("대화 패널 렌더", !!doc.getElementById("saju-chat") && !!doc.getElementById("chat-input"));
  check("대화 추천질문 버튼", doc.querySelectorAll("#saju-chat .chat-suggest button").length>=3, String(doc.querySelectorAll("#saju-chat .chat-suggest button").length));
  // 심층 리포트 CTA + 가격 앵커
  check("심층 리포트 버튼 존재", !!doc.getElementById("report-go"));
  check("리포트 가격 앵커(9,900원)", /9,900원/.test(doc.querySelector(".report-cta")?.innerHTML||""));
  check("리포트 목차 칩", doc.querySelectorAll(".report-toc span").length>=5);
  // '더 깊게' 훅 (summary-then-paywall 동선)
  check("도메인 → 리포트 훅", doc.querySelectorAll(".go-deep").length>=3, String(doc.querySelectorAll(".go-deep").length));
  // 인연 연도 표기
  check("인연운 연도 표기", /인연 기운이 켜지는 해/.test(result.innerHTML));
  // 공유 버튼
  check("공유 버튼 2종", !!doc.getElementById("copy-link") && !!doc.getElementById("save-card"));
  // 자기방어 카피 제거 확인
  check("방어적 카피 없음('겁주' 문구)", !/겁주/.test(doc.body.innerHTML));
  // 모드 토글: expert로 바꾸면 텍스트 변경
  const easyText = doc.querySelector("#result .sect .lede").textContent;
  doc.querySelector('.mode-btn[data-mode="expert"]').click();
  const expertText = doc.querySelector("#result .sect .lede").textContent;
  check("쉬운말/전문가 토글 동작", easyText!==expertText);
  check("전문가 모드에 한자 포함", /癸水|雨露/.test(expertText), expertText.slice(0,40));
  // 시간모름 흐름
  doc.getElementById("hour-unknown").checked = true;
  doc.getElementById("year").value="1985"; doc.getElementById("month").value="8"; doc.getElementById("day").value="20";
  doc.getElementById("saju-form").dispatchEvent(new window.Event("submit",{bubbles:true,cancelable:true}));
  setTimeout(()=>{
    const unknown = doc.querySelector(".pillar.unknown");
    check("시간모름 시주 '—' 표시", !!unknown);
    console.log("\n===== SMOKE " + (failures.length? "FAIL: "+failures.join(", ") : "ALL PASS") + " =====");
    process.exit(failures.length?1:0);
  }, 100);
}, 300);
