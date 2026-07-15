/* 맑은사주 — 만세력 계산 엔진
 * 모든 계산은 이 파일에서 결정론적으로 수행된다 (해석 없음).
 * 방법: 태양 황경 근사(±0.01°)로 절기 시각 산출, 일주는 2000-01-01=무오 앵커,
 * 진태양시 = 표준시 + 경도보정 + 균시차, 역사적 표준시(1908-11, 1954-61 UTC+8:30)와
 * 서머타임(1948-51, 1955-60, 1987-88) 반영.
 */
"use strict";

const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const STEMS_KO = ["갑","을","병","정","무","기","경","신","임","계"];
const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const BRANCHES_KO = ["자","축","인","묘","진","사","오","미","신","유","술","해"];
const STEM_ELEM = ["목","목","화","화","토","토","금","금","수","수"];
const STEM_YANG = [true,false,true,false,true,false,true,false,true,false];
const BRANCH_ELEM = ["수","토","목","목","토","화","화","토","금","금","토","수"];
const BRANCH_YANG = [true,false,true,false,true,false,true,false,true,false,true,false];
const BRANCH_ANIMAL = ["쥐","소","호랑이","토끼","용","뱀","말","양","원숭이","닭","개","돼지"];
// 지장간 (본기 마지막)
const HIDDEN_STEMS = {
  "子":["壬","癸"],"丑":["癸","辛","己"],"寅":["戊","丙","甲"],"卯":["甲","乙"],
  "辰":["乙","癸","戊"],"巳":["戊","庚","丙"],"午":["丙","己","丁"],"未":["丁","乙","己"],
  "申":["戊","壬","庚"],"酉":["庚","辛"],"戌":["辛","丁","戊"],"亥":["戊","甲","壬"]
};
const ELEM_GEN = {"목":"화","화":"토","토":"금","금":"수","수":"목"};   // 생
const ELEM_CTRL = {"목":"토","토":"수","수":"화","화":"금","금":"목"};  // 극

/* ---------- 천문: 태양 황경 ---------- */
function toJD(dateUTC){ // ms epoch → 율리우스일
  return dateUTC.getTime()/86400000 + 2440587.5;
}
function sunLongitude(jd){
  const n = jd - 2451545.0;
  const L = (280.460 + 0.9856474*n) % 360;
  const g = ((357.528 + 0.9856003*n) % 360) * Math.PI/180;
  let lam = (L + 1.915*Math.sin(g) + 0.020*Math.sin(2*g)) % 360;
  return (lam+360)%360;
}
// targetLon(도)에 도달하는 시각을 [t0,t1] 사이에서 이분탐색 (KST Date 반환)
function findTermTime(targetLon, t0, t1){
  let lo = t0.getTime(), hi = t1.getTime();
  for(let i=0;i<60;i++){
    const mid = (lo+hi)/2;
    let lam = sunLongitude(toJD(new Date(mid)));
    // 순환 보정: target 근방 ±180 범위로 정규화
    let diff = ((lam - targetLon + 540) % 360) - 180;
    if (diff < 0) lo = mid; else hi = mid;
  }
  return new Date((lo+hi)/2);
}
// 특정 KST 시각의 태양 황경
function sunLonAtKST(kstDate){
  return sunLongitude(toJD(new Date(kstDate.getTime() - 9*3600000 + 9*3600000))); // Date는 이미 UTC ms 기반
}

/* 절기(節) 12개: 입춘315 경칩345 청명15 입하45 망종75 소서105 입추135 백로165 한로195 입동225 대설255 소한285
 * month index 0=寅(입춘~) ... 11=丑(소한~) */
const JEOL = [
  {lon:315, name:"입춘"},{lon:345, name:"경칩"},{lon:15, name:"청명"},{lon:45, name:"입하"},
  {lon:75, name:"망종"},{lon:105, name:"소서"},{lon:135, name:"입추"},{lon:165, name:"백로"},
  {lon:195, name:"한로"},{lon:225, name:"입동"},{lon:255, name:"대설"},{lon:285, name:"소한"}
];

// 해당 연도의 절기 시각(KST Date). lon<180은 이듬해 상반기 소속이므로 year+1 근처 탐색
function termTimeNear(year, lon, name){
  // 대략적 월 추정
  const approxMonth = {315:2,345:3,15:4,45:5,75:6,105:7,135:8,165:9,195:10,225:11,255:12,285:1};
  let m = approxMonth[lon];
  let y = (m===1) ? year+1 : year; // 소한은 이듬해 1월
  const t0 = new Date(Date.UTC(y, m-1, 1) - 9*3600000);
  const t1 = new Date(Date.UTC(y, m-1, 15) - 9*3600000);
  // 넓게 잡기: 1일~15일 사이에 모든 節 존재
  return findTermTime(lon, t0, t1);
}

/* ---------- 역사적 시간 보정 ---------- */
// 반환: {stdMeridian, dstOffsetMin, notes[]}
function historicalTime(y, m, d, hh, mm){
  const notes = [];
  let meridian = 135;
  let dst = 0;
  const dnum = y*10000 + m*100 + d;
  if (dnum >= 19080401 && dnum < 19120101){ meridian = 127.5; notes.push("당시 대한제국 표준시(동경 127.5도) 적용"); }
  if (dnum >= 19540321 && dnum <= 19610809){ meridian = 127.5; notes.push("당시 한국 표준시(동경 127.5도, 1954–61) 적용"); }
  // 서머타임 (시행 기간 출생 시 표준시로 -1h)
  // 1948-60: 자정 전환(일 단위 정확). 1987-88: 02:00 시작 / 03:00 종료 (시각 단위 판정)
  const DST = [
    [19480601,19480912],[19490403,19490910],[19500401,19500909],[19510506,19510908],
    [19550505,19550908],[19560520,19560929],[19570505,19570921],[19580504,19580920],
    [19590503,19590919],[19600501,19600917]
  ];
  for (const [a,b] of DST){
    if (dnum>=a && dnum<=b){ dst = -60; notes.push("서머타임 시행 기간 출생 — 1시간 보정(-60분) 적용"); break; }
  }
  const tnum = dnum*10000 + hh*100 + mm; // yyyymmddHHMM
  const DST_HM = [
    [198705100200, 198710110300],
    [198805080200, 198810090300]
  ];
  for (const [a,b] of DST_HM){
    if (tnum>=a && tnum<b){ dst = -60; notes.push("서머타임 시행 기간 출생 — 1시간 보정(-60분) 적용"); break; }
  }
  return {meridian, dst, notes};
}

// 균시차(분)
function equationOfTime(y, m, d){
  const start = Date.UTC(y,0,1);
  const cur = Date.UTC(y,m-1,d);
  const n = Math.floor((cur-start)/86400000) + 1;
  const B = 2*Math.PI*(n-81)/364;
  return 9.87*Math.sin(2*B) - 7.53*Math.cos(B) - 1.5*Math.sin(B);
}

/* ---------- 사주 계산 ---------- */
function dayPillarIndex(y, m, d){
  // 앵커: 2000-01-01 = 무오 (stem 4, branch 6). UTC 날짜 산술로 시차 문제 제거.
  const diff = Math.round((Date.UTC(y,m-1,d) - Date.UTC(2000,0,1))/86400000);
  return { stem: ((4+diff)%10+10)%10, branch: ((6+diff)%12+12)%12 };
}

/**
 * 메인 계산.
 * input: {year,month,day,hour,minute, hourUnknown, gender:'F'|'M', longitude, placeName}
 */
function computeSaju(input){
  const {year:y, month:m, day:d, gender} = input;
  const hourUnknown = !!input.hourUnknown;
  const hh = hourUnknown ? 12 : input.hour;
  const mm = hourUnknown ? 0 : input.minute;
  const lon = input.longitude || 127.5;

  const calcLog = [];   // 계산 과정 투명 공개용
  const warnings = [];

  // 1) 시간 보정
  const hist = historicalTime(y,m,d,hh,mm);
  hist.notes.forEach(n=>calcLog.push("⏰ "+n));
  const lonCorr = (lon - hist.meridian) * 4;            // 분
  const eot = equationOfTime(y,m,d);                    // 분
  const clockMin = hh*60+mm + hist.dst;
  const lmtMin = clockMin + lonCorr;
  const tstMin = lmtMin + eot;
  if(!hourUnknown){
    calcLog.push(`표준시 ${pad(hh)}:${pad(mm)}${hist.dst? " → 서머타임 보정 "+fmtMin(clockMin):""} → 경도(${lon.toFixed(1)}°) 보정 ${lonCorr>=0?"+":""}${lonCorr.toFixed(0)}분 → 평균태양시 ${fmtMin(lmtMin)} → 균시차 ${eot>=0?"+":""}${eot.toFixed(1)}분 → 진태양시 ${fmtMin(tstMin)}`);
  }

  // 2) 시지 판정 (진태양시 기준, 子=23:00~00:59)
  let hourBranch = null, dayShift = 0;
  if(!hourUnknown){
    let t = ((tstMin % 1440)+1440)%1440;
    let dayAdj = Math.floor(tstMin/1440); // 보정으로 날짜가 넘어간 경우
    if (t >= 23*60){ hourBranch = 0; dayShift = dayAdj + 1; } // 정통 자시법: 23시 이후 다음날 일주
    else { hourBranch = Math.floor((t+60)/120) % 12; dayShift = dayAdj; }
    // 경계 근접 경고 (±10분)
    const boundaries = [];
    for(let b=0;b<12;b++){ boundaries.push(((b*120 - 60)+1440)%1440); }
    for(const bd of boundaries){
      let dist = Math.min(Math.abs(t-bd), 1440-Math.abs(t-bd));
      if (dist <= 10 && dist > 0){ warnings.push(`진태양시가 시(時) 경계에서 ${dist.toFixed(0)}분 이내입니다 — 출생 기록이 몇 분만 달라도 시주가 바뀔 수 있어요.`); break; }
    }
    if (((tstMin%1440)+1440)%1440 >= 23*60){
      calcLog.push("🌙 진태양시 23시 이후 → 정통 자시법에 따라 다음 날 일주를 씁니다 (야자시 학파는 당일 유지 — 학파 차이 고지)");
      warnings.push("자시(23시~1시) 출생 — 야자시/정통 학파에 따라 일주가 달라질 수 있는 구간입니다. 여기서는 정통(다음날) 기준.");
    }
  }

  // 3) 연주 (입춘 기준)
  const birthKST = new Date(Date.UTC(y, m-1, d, (hourUnknown?12:input.hour)-9, hourUnknown?0:input.minute));
  const ipchunThis = termTimeNear(y, 315, "입춘");
  let sajuYear = y;
  if (birthKST < ipchunThis) sajuYear = y-1;
  const yearStem = ((sajuYear-4)%10+10)%10;
  const yearBranch = ((sajuYear-4)%12+12)%12;
  if (sajuYear !== y) calcLog.push(`입춘(${fmtDate(ipchunThis)}) 전 출생 → 연주는 ${sajuYear}년(${STEMS_KO[yearStem]}${BRANCHES_KO[yearBranch]}) — 띠는 ${BRANCH_ANIMAL[yearBranch]}띠`);
  else calcLog.push(`입춘(${fmtDate(ipchunThis)}) 이후 출생 → 연주 ${sajuYear}년 (${BRANCH_ANIMAL[yearBranch]}띠)`);
  // 입춘 경계 근접 경고
  if (Math.abs(birthKST - ipchunThis) < 48*3600000) warnings.push("입춘 경계 ±48시간 이내 출생 — 출생 시각 기록의 정확성이 연주를 좌우합니다.");

  // 4) 월주 (절기 기준)
  const lam = sunLongitude(toJD(birthKST));
  let monthIdx = Math.floor((((lam - 315)+360)%360)/30); // 0=寅 ... 11=丑
  const monthBranch = (monthIdx+2)%12;
  // 월두법: 연간별 寅월 천간
  const inStemByYear = [2,4,6,8,0]; // 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲
  const monthStem = (inStemByYear[yearStem%5] + monthIdx) % 10;
  // 절기 경계 근접 경고
  const lamMod = ((lam-315)+360)%360;
  const distToBoundary = Math.min(lamMod%30, 30-(lamMod%30));
  if (distToBoundary < 1.0) warnings.push("월 경계 절기 ±24시간 이내 출생 — 월주가 절기 시각에 따라 갈릴 수 있는 구간입니다 (본 계산은 천문 시각 기준).");

  // 5) 일주
  let dp = dayPillarIndex(y,m,d);
  if (dayShift !== 0){
    dp = { stem: ((dp.stem+dayShift)%10+10)%10, branch: ((dp.branch+dayShift)%12+12)%12 };
  }

  // 6) 시주 (오서둔)
  let hourStem = null;
  if (!hourUnknown){
    const ziStart = [0,2,4,6,8][dp.stem%5]; // 甲己→甲子시, 乙庚→丙子시...
    hourStem = (ziStart + hourBranch) % 10;
  }

  // 7) 대운
  const yangYear = STEM_YANG[yearStem];
  const forward = (yangYear && gender==="M") || (!yangYear && gender==="F");
  // 다음/이전 節 시각
  const curTermLon = 315 + monthIdx*30;
  const nextTermLon = (curTermLon+30)%360;
  // 근처 탐색
  const nextTerm = findTermTime(nextTermLon%360, birthKST, new Date(birthKST.getTime()+40*86400000));
  const prevTerm = findTermTime(curTermLon%360, new Date(birthKST.getTime()-40*86400000), birthKST);
  const daysTo = forward ? (nextTerm-birthKST)/86400000 : (birthKST-prevTerm)/86400000;
  let luckStart = Math.round(daysTo/3); if(luckStart<1) luckStart=1; if(luckStart>10) luckStart=10;
  const luckPillars = [];
  for(let i=1;i<=8;i++){
    const s = ((monthStem + (forward?i:-i))%10+10)%10;
    const b = ((monthBranch + (forward?i:-i))%12+12)%12;
    luckPillars.push({stem:s, branch:b, startAge: luckStart + (i-1)*10, startYear: sajuYear + luckStart + (i-1)*10});
  }
  calcLog.push(`대운: ${gender==="F"?"여성":"남성"}·${yangYear?"양":"음"}년생 → ${forward?"순행":"역행"}, 대운수 ${luckStart} (절기까지 ${daysTo.toFixed(1)}일 ÷ 3)`);

  return {
    input, calcLog, warnings,
    pillars: {
      year: {stem: yearStem, branch: yearBranch},
      month:{stem: monthStem, branch: monthBranch},
      day:  {stem: dp.stem,  branch: dp.branch},
      hour: hourUnknown? null : {stem: hourStem, branch: hourBranch}
    },
    sajuYear, monthIdx, forward, luckStart, luckPillars,
    trueSolar: hourUnknown? null : fmtMin(tstMin)
  };
}

/* ---------- 십성 · 십이운성 · 오행 ---------- */
function tenGod(dayStem, otherStem){
  const de = STEM_ELEM[dayStem], oe = STEM_ELEM[otherStem];
  const same = STEM_YANG[dayStem] === STEM_YANG[otherStem];
  if (de===oe) return same? "비견":"겁재";
  if (ELEM_GEN[de]===oe) return same? "식신":"상관";
  if (ELEM_CTRL[de]===oe) return same? "편재":"정재";
  if (ELEM_CTRL[oe]===de) return same? "편관":"정관";
  if (ELEM_GEN[oe]===de) return same? "편인":"정인";
  return "?";
}
function tenGodBranch(dayStem, branch){
  const hs = HIDDEN_STEMS[BRANCHES[branch]];
  const main = hs[hs.length-1];
  return tenGod(dayStem, STEMS.indexOf(main));
}
// 십이운성 (전통: 음간 역행)
const TWELVE = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"];
const GROWTH_START = {0:11, 2:2, 4:2, 6:5, 8:8};   // 양간 장생지: 甲亥 丙寅 戊寅 庚巳 壬申
const GROWTH_START_YIN = {1:6, 3:9, 5:9, 7:0, 9:3}; // 음간 장생지: 乙午 丁酉 己酉 辛子 癸卯
function twelveStage(stem, branch){
  if (STEM_YANG[stem]){
    const start = GROWTH_START[stem];
    return TWELVE[ ((branch - start)%12+12)%12 ];
  } else {
    const start = GROWTH_START_YIN[stem];
    return TWELVE[ ((start - branch)%12+12)%12 ];
  }
}
function elementCount(pillars){
  const cnt = {"목":0,"화":0,"토":0,"금":0,"수":0};
  for (const key of ["year","month","day","hour"]){
    const p = pillars[key]; if(!p) continue;
    cnt[STEM_ELEM[p.stem]]++; cnt[BRANCH_ELEM[p.branch]]++;
  }
  return cnt;
}
// 신강약 참고치: 득령/득지/득세
function strengthEstimate(pillars){
  const ds = pillars.day.stem, de = STEM_ELEM[ds];
  const helps = e => (e===de || ELEM_GEN[e]===de);
  const wolji = BRANCH_ELEM[pillars.month.branch];
  const ilji = BRANCH_ELEM[pillars.day.branch];
  let score = 0, detail=[];
  if (helps(wolji)) { score+=2; detail.push("득령"); } else detail.push("실령");
  if (helps(ilji)) { score+=1; detail.push("득지"); }
  // 득세: 일간(자기 자신)을 제외한 모든 글자 중 나를 돕는(같은 오행+생하는 오행) 비율.
  // 일간 천간은 분모/분자에서 제외, 일지 포함(궁의 뿌리 반영). 규칙 고정 — 재현성 보장.
  let cnt=0, total=0;
  for (const key of ["year","month","day","hour"]){
    const p = pillars[key]; if(!p) continue;
    if (key!=="day"){ if(helps(STEM_ELEM[p.stem])) cnt++; total++; }
    if (helps(BRANCH_ELEM[p.branch])) cnt++; total++;
  }
  if (cnt >= Math.ceil(total/2)) { score+=1; detail.push("득세"); }
  const label = score>=3 ? "신강(참고)" : score===2 ? "중화(참고)" : "신약(참고)";
  return {label, detail};
}

/* ---------- 신살 ---------- */
function shinsal(pillars, sajuYear){
  const out = [];
  const ds = pillars.day.stem;
  const branches = ["year","month","day","hour"].filter(k=>pillars[k]).map(k=>({pos:k, b:pillars[k].branch}));
  const stems = ["year","month","day","hour"].filter(k=>pillars[k]).map(k=>({pos:k, s:pillars[k].stem}));
  const posKo = {year:"연지",month:"월지",day:"일지",hour:"시지"};

  // 천을귀인 (일간 기준)
  const CHEONEUL = {0:[1,7],4:[1,7],6:[1,7],1:[0,8],5:[0,8],2:[11,9],3:[11,9],8:[5,3],9:[5,3],7:[2,6]};
  const cb = CHEONEUL[ds];
  const hitC = branches.filter(x=>cb.includes(x.b));
  if (hitC.length) out.push({name:"천을귀인", where: hitC.map(x=>posKo[x.pos]).join("·"), good:true});
  else out.push({name:"천을귀인", where:`원국에 없음 (${cb.map(i=>BRANCHES_KO[i]).join("·")}운에서 들어옴)`, good:true, absent:true, luckBranches: cb});

  // 문창귀인
  const MUNCHANG = {0:5,1:6,2:8,3:9,4:8,5:9,6:11,7:0,8:2,9:3};
  const mc = MUNCHANG[ds];
  const hitM = branches.filter(x=>x.b===mc);
  if (hitM.length) out.push({name:"문창귀인", where: hitM.map(x=>posKo[x.pos]).join("·"), good:true});

  // 역마/도화/화개 (연지·일지 기준 둘 다)
  const groupOf = b => [ [8,0,4].includes(b)?0 : [2,6,10].includes(b)?1 : [5,9,1].includes(b)?2 : 3 ][0];
  // 삼합 그룹: 0=신자진(수) 1=인오술(화) 2=사유축(금) 3=해묘미(목)
  const YEOKMA = {0:2, 1:8, 2:11, 3:5}; // 역마
  const DOHWA  = {0:9, 1:3, 2:6, 3:0};
  const HWAGAE = {0:4, 1:10, 2:1, 3:7};
  for (const baseKey of ["year","day"]){
    const base = pillars[baseKey].branch, g = groupOf(base);
    for (const [salName, table] of [["역마",YEOKMA],["도화",DOHWA],["화개",HWAGAE]]){
      const t = table[g];
      const hits = branches.filter(x=>x.b===t && x.pos!==baseKey);
      if (hits.length) {
        const label = `${salName}(${baseKey==="year"?"연":"일"}지 기준)`;
        if (!out.some(o=>o.name.startsWith(salName))) out.push({name:label, where:hits.map(x=>posKo[x.pos]).join("·"), good:null});
      }
    }
  }

  // 일주 단위 신살
  const dayGZ = STEMS[pillars.day.stem]+BRANCHES[pillars.day.branch];
  const BAEKHO = ["甲辰","乙未","丙戌","丁丑","戊辰","壬戌","癸丑"];
  const EUMCHAK = ["丙子","丙午","丁丑","丁未","戊寅","戊申","辛卯","辛酉","壬辰","壬戌","癸巳","癸亥"];
  const GOERAN = ["甲寅","乙巳","丁巳","戊申","辛亥"];
  const GWAEGANG = ["庚辰","庚戌","壬辰","壬戌","戊戌"];
  if (BAEKHO.includes(dayGZ)) out.push({name:"백호대살(일주)", where:"일주", good:false});
  if (EUMCHAK.includes(dayGZ)) out.push({name:"음착살(일주)", where:"일주", good:false});
  if (GOERAN.includes(dayGZ)) out.push({name:"고란살(일주)", where:"일주", good:null});
  if (GWAEGANG.includes(dayGZ)) out.push({name:"괴강(일주)", where:"일주", good:null});

  // 현침 (甲辛卯午未申)
  const NEEDLE_S = ["甲","辛"], NEEDLE_B = ["卯","午","未","申"];
  let needles = 0;
  stems.forEach(x=>{ if(NEEDLE_S.includes(STEMS[x.s])) needles++; });
  branches.forEach(x=>{ if(NEEDLE_B.includes(BRANCHES[x.b])) needles++; });
  if (needles >= 2) out.push({name:`현침살 ×${needles}`, where:"원국", good:null});

  // 홍란·천희 (연지 기준: 홍란 = 卯에서 子년 역행)
  const yb = pillars.year.branch;
  const hongran = ((3 - yb)%12+12)%12;
  const cheonhui = (hongran+6)%12;
  out.push({name:"홍란·천희", where:`홍란=${BRANCHES_KO[hongran]} · 천희=${BRANCHES_KO[cheonhui]} (해당 글자의 해·대운에 경사 기운)`, good:true, info:true, hongran, cheonhui});

  // 삼재 (민속)
  const g = groupOf(yb);
  const SAMJAE_START = {0:2, 1:8, 2:11, 3:5}; // 신자진→인묘진(寅 시작), 인오술→신유술(申), 사유축→해자축(亥), 해묘미→사오미(巳)
  out.push({name:"삼재(민속)", where:`${BRANCHES_KO[SAMJAE_START[g]]}·${BRANCHES_KO[(SAMJAE_START[g]+1)%12]}·${BRANCHES_KO[(SAMJAE_START[g]+2)%12]}년`, good:null, info:true, samjaeStart: SAMJAE_START[g]});

  return out;
}

/* ---------- 세운 ---------- */
function yearlyFortune(pillars, fromYear, count){
  const ds = pillars.day.stem;
  const natalBranches = ["year","month","day","hour"].filter(k=>pillars[k]).map(k=>pillars[k].branch);
  const res = [];
  const HAP = {0:5,5:0,1:6,6:1,2:7,7:2,3:8,8:3,4:9,9:4}; // 천간합 쌍
  const TRIADS = [[8,0,4],[2,6,10],[5,9,1],[11,3,7]]; // 수화금목국
  const TRIAD_ELEM = ["수","화","금","목"];
  const YUKHAP = {0:1,1:0,2:11,11:2,3:10,10:3,4:9,9:4,5:8,8:5,6:7,7:6};
  for(let i=0;i<count;i++){
    const yy = fromYear+i;
    const s = ((yy-4)%10+10)%10, b = ((yy-4)%12+12)%12;
    const ev = [];
    if (HAP[s]===ds) ev.push("천간이 일간과 합 — 인연·계약·발탁의 강한 신호");
    // 삼합 완성 체크
    TRIADS.forEach((tri,ti)=>{
      if (tri.includes(b)){
        const others = tri.filter(x=>x!==b);
        if (others.every(o=>natalBranches.includes(o))) ev.push(`원국과 ${tri.map(x=>BRANCHES_KO[x]).join("")} 삼합(${TRIAD_ELEM[ti]}국) 완성 — 해당 기운의 큰 변동`);
      }
    });
    // 일지 관계
    const ilji = pillars.day.branch;
    if (YUKHAP[b]===ilji) ev.push("배우자궁(일지)과 합 — 인연·관계 활성");
    if (((b - ilji)%12+12)%12 === 6) ev.push("배우자궁(일지)과 충 — 자리·관계의 변동");
    if (b===ilji) ev.push("일지 복음(같은 글자) — 같은 주제가 다시 표면화");
    res.push({year:yy, stem:s, branch:b, stemGod: tenGod(ds,s), branchGod: tenGodBranch(ds,b), events:ev});
  }
  return res;
}

/* ---------- 유틸 ---------- */
function pad(n){ return String(n).padStart(2,"0"); }
function fmtMin(min){ const t=((min%1440)+1440)%1440; return `${pad(Math.floor(t/60))}:${pad(Math.floor(t%60))}`; }
function fmtDate(d){
  const k = new Date(d.getTime()+9*3600000);
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth()+1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}
