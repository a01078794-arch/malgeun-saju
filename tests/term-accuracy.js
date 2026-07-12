const PUB = [
  ["입춘",1993,315,"1993-02-04 04:37"],
  ["소한",1992,285,"1993-01-05 16:56"],   // 소한은 전년도 기준 탐색 (year param = 절기 소속연도-1)
  ["입춘",1994,315,"1994-02-04 10:30"],
  ["경칩",1994,345,"1994-03-06 04:37"],
  ["입하",1995,45,"1995-05-06 08:30"],
  ["입춘",2025,315,"2025-02-03 23:10"],
  ["입춘",2026,315,"2026-02-04 05:02"],
  ["동지",2024,255,null],                  // 대설로 대체 불가 — 동지(270)는 節 아님, 스킵
  ["소한",2025,285,"2026-01-05 17:23"],
  ["망종",2026,75,"2026-06-06 00:48"]
];
let maxAbs=0, n=0;
for (const [name,y,lon,pub] of PUB){
  if(!pub) continue;
  const t = termTimeNear(y, lon, name);
  const k = new Date(t.getTime()+9*3600000);
  const got = `${k.getUTCFullYear()}-${String(k.getUTCMonth()+1).padStart(2,"0")}-${String(k.getUTCDate()).padStart(2,"0")} ${String(k.getUTCHours()).padStart(2,"0")}:${String(k.getUTCMinutes()).padStart(2,"0")}`;
  const diff = (t.getTime()+9*3600000 - new Date(pub.replace(" ","T")+":00Z").getTime())/60000;
  maxAbs = Math.max(maxAbs, Math.abs(diff)); n++;
  console.log(`${name} ${pub.slice(0,4)}: 공표 ${pub} | 계산 ${got} | 오차 ${diff>0?"+":""}${diff.toFixed(0)}분`);
}
console.log(`\n대조 ${n}건, 최대 오차 ${maxAbs.toFixed(0)}분`);
