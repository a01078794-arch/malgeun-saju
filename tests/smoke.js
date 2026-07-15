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
  window.eval(["js/manseryeok.js","js/data.js","js/interp.js","js/app.js"].map(f=>fs.readFileSync(path.join(ROOT,f),"utf8").replace(/"use strict";/g,"")).join("\n"));
}
// DOMContentLoaded 발화
window.document.dispatchEvent(new window.Event("DOMContentLoaded", {bubbles:true}));

setTimeout(()=>{
  const doc = window.document;
  // URL 파라미터 복원 → 자동 렌더 확인
  const result = doc.getElementById("result");
  check("결과 렌더됨", !result.classList.contains("hidden"));
  check("부적 카드 존재", !!doc.getElementById("talisman"));
  const label = doc.querySelector(".tal-label");
  check("캐릭터 라벨 = 새벽 이슬 (케이스B 초봄생)", label && label.textContent==="새벽 이슬", label&&label.textContent);
  // 챕터 10개 (序~九)
  const chapters = doc.querySelectorAll("#result .chapter");
  check("챕터 10개 렌더", doc.querySelectorAll("#result .book .chapter").length===10, String(doc.querySelectorAll("#result .book .chapter").length));
  // 잠금 5개 (五·六·七·八·九)
  const locked = doc.querySelectorAll("#result .chapter.locked");
  check("잠금 챕터 5개", locked.length===5, String(locked.length));
  // 명식 글자 확인 (甲戌 丙寅 癸未 丙辰)
  const chars = [...doc.querySelectorAll("#ch-序 .p-char")].map(e=>e.textContent).join("");
  check("명식 글자 정확 (丙辰癸未丙寅甲戌 순)", chars==="丙辰癸未丙寅甲戌", chars);
  // 계산 로그 공개
  check("계산 과정 공개", doc.querySelectorAll(".calc-log li").length>=2);
  // 잠금 해제 동작
  const btn = doc.querySelector(".unlock-btn");
  btn.click();
  check("잠금 해제 동작", doc.querySelectorAll("#result .chapter.locked").length===4);
  // 링크 복사 버튼 존재
  check("공유 버튼 2종", !!doc.getElementById("copy-link") && !!doc.getElementById("save-card"));
  // 모드 토글: expert로 바꾸면 텍스트 변경
  const easyText = doc.querySelector("#ch-一 .lede").textContent;
  doc.querySelector('.mode-btn[data-mode="expert"]').click();
  const expertText = doc.querySelector("#ch-一 .lede").textContent;
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
