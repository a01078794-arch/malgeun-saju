/* ===== 겹침 가드레일 =====
 * "다른 사람인데 결과가 똑같이 나온다"를 막는 회귀 테스트.
 * 무작위 사주 N개의 '해석 문장 집합'을 만들고 쌍마다 Jaccard 겹침을 잰다.
 * 핵심 원리: 텍스트 다양성이 사주 다양성을 따라가야 한다.
 *   - 구조(일간·강약·대표구조)가 다른 두 사주가 거의 같은 문장을 뱉으면 실패.
 *   - 구조가 같아서 겹치는 건 정당(같은 일간·같은 계절은 원래 본질을 공유).
 * cat: manseryeok.js + data.js + interp.js + overlap.test.js → node
 */

// 결정론적 PRNG (재현성 — Math.random 미사용)
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rand = mulberry32(20260715);
function ri(lo,hi){ return lo+Math.floor(rand()*(hi-lo+1)); }

const N = 60;
const LONS = [126.98,126.7,127.0,127.38,128.6,129.07,126.85,127.15,127.49,126.53];
const charts = [];
for (let i=0;i<charts.length || charts.length<N;){
  const y=ri(1960,2005), mo=ri(1,12), d=ri(1,28), h=ri(0,23), mi=ri(0,59);
  const g = rand()<0.5?"F":"M";
  const lon = LONS[ri(0,LONS.length-1)];
  const r = computeSaju({year:y,month:mo,day:d,hour:h,minute:mi,gender:g,longitude:lon});
  const it = interpret(r,"easy");
  // 비교 대상 = 해석 문장(본질+구조+관계). 코다/조건부노트 제외.
  const sents = [...it.essence, ...it.structures, ...it.branchRel, ...it.stemRel]
    .map(s=>s.replace(/<[^>]+>/g,"").trim()).filter(Boolean);
  const ds = STEMS[r.pillars.day.stem];
  const strengthTuple = strengthEstimate(r.pillars).label;
  const topStruct = godStructures(r.pillars)[0]?.key || "-";
  charts.push({y,mo,d,h,mi,g, ds, key:`${ds}/${strengthTuple}/${topStruct}`, sents:new Set(sents), list:sents});
  i++;
}

function jaccard(a,b){
  let inter=0; for(const s of a) if(b.has(s)) inter++;
  return inter / (a.size + b.size - inter);
}

let sumJ=0, pairs=0, maxJ=0, worst=null;
let badPairs=0; // 구조가 다른데 과도하게 겹치는 쌍
const BAD = 0.70;
for(let i=0;i<charts.length;i++) for(let j=i+1;j<charts.length;j++){
  const J = jaccard(charts[i].sents, charts[j].sents);
  sumJ+=J; pairs++;
  if(J>maxJ){ maxJ=J; worst=[i,j]; }
  if(J>=BAD && charts[i].key!==charts[j].key) badPairs++;
}
const meanJ = sumJ/pairs;
const uniqEssence = new Set(charts.map(c=>c.list[0]||"")).size;
const uniqKey = new Set(charts.map(c=>c.key)).size;
const uniqReadings = new Set(charts.map(c=>c.list.join("¦"))).size;

console.log(`\n===== 겹침 가드레일 (N=${N}, 쌍 ${pairs}) =====`);
console.log(`평균 Jaccard      : ${meanJ.toFixed(3)}  (낮을수록 다양)`);
console.log(`최대 Jaccard      : ${maxJ.toFixed(3)}  (쌍 ${worst})`);
console.log(`고유 본질 헤드라인 : ${uniqEssence}/${N}`);
console.log(`고유 구조 키       : ${uniqKey}/${N}  (일간/강약/대표구조)`);
console.log(`완전 고유 리딩     : ${uniqReadings}/${N}`);
console.log(`구조 다른데 과겹침(≥${BAD}) 쌍 : ${badPairs}`);
if(worst){
  const [a,b]=worst;
  console.log(`\n-- 최악 쌍 상세 --`);
  console.log(`  A: ${charts[a].y}-${charts[a].mo}-${charts[a].d} ${charts[a].g} [${charts[a].key}]`);
  console.log(`  B: ${charts[b].y}-${charts[b].mo}-${charts[b].d} ${charts[b].g} [${charts[b].key}]`);
  const shared=[...charts[a].sents].filter(s=>charts[b].sents.has(s));
  const onlyA=charts[a].list.filter(s=>!charts[b].sents.has(s));
  console.log(`  공유 문장 ${shared.length} / A고유 ${onlyA.length} / B고유 ${charts[b].list.filter(s=>!charts[a].sents.has(s)).length}`);
}

// ── 판정 ──
const GATE = { meanJ:0.35, maxJ_diffKey:0.85, badPairs:0, uniqKeyRatio:0.55, uniqReadingRatio:0.9 };
let fail=[];
if(meanJ > GATE.meanJ) fail.push(`평균 Jaccard ${meanJ.toFixed(3)} > ${GATE.meanJ}`);
if(badPairs > GATE.badPairs) fail.push(`구조 다른데 과겹침 쌍 ${badPairs}건`);
if(uniqKey/N < GATE.uniqKeyRatio) fail.push(`고유 구조키 비율 ${(uniqKey/N).toFixed(2)} < ${GATE.uniqKeyRatio}`);
if(uniqReadings/N < GATE.uniqReadingRatio) fail.push(`완전고유 리딩 비율 ${(uniqReadings/N).toFixed(2)} < ${GATE.uniqReadingRatio}`);
console.log("");
if(fail.length){ console.log("[FAIL] "+fail.join(" | ")); process.exit(1); }
else console.log("[PASS] 겹침 가드레일 통과 — 텍스트 다양성이 사주 다양성을 따라감");
