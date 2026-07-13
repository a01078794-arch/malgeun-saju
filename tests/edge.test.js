/* ===== 엣지케이스 테스트 ===== */
let pass=0, fail=0;
function check(name, cond, detail){
  if(cond){pass++; console.log(`[PASS] ${name}`);}
  else {fail++; console.log(`[FAIL] ${name} — ${detail||""}`);}
}
function pil(r){ const P=r.pillars; return [P.year,P.month,P.day,P.hour].map(p=>p?STEMS[p.stem]+BRANCHES[p.branch]:"??").join(" "); }

// 1. 자시 경계: 진태양시 23시 이후 → 다음날 일주 (정통) + 경고
const r1=computeSaju({year:1990,month:6,day:15,hour:23,minute:50,gender:'M',longitude:127.5});
const r2=computeSaju({year:1990,month:6,day:16,hour:1,minute:30,gender:'M',longitude:127.5});
check("자시(23:50) 시지=子", BRANCHES[r1.pillars.hour.branch]==="子");
check("자시 출생 경고 존재", r1.warnings.some(w=>w.includes("자시")));
// 23:50 진태양시(-30분+균시차)면 23:20대 → 다음날 일주 = 6/16 일주와 동일해야
const d16=dayPillarIndex(1990,6,16);
check("자시 일주 전진(다음날)", r1.pillars.day.stem===d16.stem && r1.pillars.day.branch===d16.branch, pil(r1));

// 2. 서머타임 1988: 1988-07-01 12:00 출생 → -1h 보정 note
const r3=computeSaju({year:1988,month:7,day:1,hour:12,minute:0,gender:'F',longitude:126.98});
check("1988 서머타임 감지", r3.calcLog.some(l=>l.includes("서머타임")));
// 서머타임 비적용 기간(1988-04-01)은 미감지
const r4=computeSaju({year:1988,month:4,day:1,hour:12,minute:0,gender:'F',longitude:126.98});
check("1988-04-01 서머타임 미적용", !r4.calcLog.some(l=>l.includes("서머타임")));

// 3. 1954-61 표준시(127.5): 1958-06-15 출생 → 경도보정 note에 127.5 기준
const r5=computeSaju({year:1958,month:6,day:15,hour:12,minute:0,gender:'M',longitude:127.5});
check("1954-61 표준시 감지", r5.calcLog.some(l=>l.includes("127.5")));
// 그리고 서머타임(1958-05-04~09-20)도 겹침
check("1958 여름 서머타임+127.5 동시", r5.calcLog.some(l=>l.includes("서머타임")));

// 4. 입춘 경계: 1993-02-03(전날) vs 1993-02-05(다음날)
const r6=computeSaju({year:1993,month:2,day:3,hour:12,minute:0,gender:'F',longitude:127.5});
const r7=computeSaju({year:1993,month:2,day:5,hour:12,minute:0,gender:'F',longitude:127.5});
check("입춘 전 연주=壬申", STEMS[r6.pillars.year.stem]+BRANCHES[r6.pillars.year.branch]==="壬申", pil(r6));
check("입춘 후 연주=癸酉", STEMS[r7.pillars.year.stem]+BRANCHES[r7.pillars.year.branch]==="癸酉", pil(r7));
check("입춘 ±48h 경고(2/3)", r6.warnings.some(w=>w.includes("입춘")));
check("입춘 ±48h 경고(2/5)", r7.warnings.some(w=>w.includes("입춘")));

// 5. 남성 순행: 케이스B와 동일 사주 남성 → 순행 (양년생 남 = 순행)
const r8=computeSaju({year:1994,month:2,day:26,hour:8,minute:30,gender:'M',longitude:127.5});
check("양년생 남성=순행", r8.forward===true);
check("음년생 여성=순행(케이스C)", computeSaju({year:1995,month:5,day:14,hour:15,minute:29,gender:'F',longitude:126.7}).forward===true);

// 6. 윤년 2월 29일
const r9=computeSaju({year:2000,month:2,day:29,hour:10,minute:0,gender:'F',longitude:127.5});
check("2000-02-29 계산 성공", !!r9.pillars.day);
// 2000-02-29 일주: 2000-01-01 무오 + 59일 = stem (4+59)%10=3 丁, branch (6+59)%12=5 巳 → 丁巳
check("2000-02-29 일주=丁巳", STEMS[r9.pillars.day.stem]+BRANCHES[r9.pillars.day.branch]==="丁巳", pil(r9));

// 7. 시간모름: hour null, 시주 없음, 대운은 정오 기준 산출
const r10=computeSaju({year:1985,month:8,day:20,hourUnknown:true,gender:'F',longitude:127.5});
check("시간모름 시주 null", r10.pillars.hour===null);
check("시간모름도 대운 산출", r10.luckPillars.length===8);

// 8. 범위 경계: 1900, 2049
check("1900-03-01 계산", !!computeSaju({year:1900,month:3,day:1,hour:12,minute:0,gender:'M',longitude:127.5}).pillars.day);
check("2049-12-31 계산", !!computeSaju({year:2049,month:12,day:31,hour:12,minute:0,gender:'F',longitude:127.5}).pillars.day);

// 9. 월두법 전수 검증: 년간별 寅월 천간 (甲己→丙寅, 乙庚→戊寅, 丙辛→庚寅, 丁壬→壬寅, 戊癸→甲寅)
const expectIn={0:2,5:2,1:4,6:4,2:6,7:6,3:8,8:8,4:0,9:0};
let mOK=true;
for(let ys=0; ys<10; ys++){
  // 해당 년간이 나오는 연도 찾기: sajuYear%10 = (ys+4)%10... year Y: stem=(Y-4)%10=ys → Y=2004+ys
  const Y=2004+ys;
  const rr=computeSaju({year:Y,month:3,day:10,hour:12,minute:0,gender:'M',longitude:127.5}); // 3/10 = 卯月... 寅월 확인 위해 2/20 사용
  const rr2=computeSaju({year:Y,month:2,day:20,hour:12,minute:0,gender:'M',longitude:127.5});
  if(rr2.pillars.month.branch!==2 || rr2.pillars.month.stem!==expectIn[ys]){ mOK=false; console.log("  월두법 불일치:", Y, STEMS[rr2.pillars.month.stem]+BRANCHES[rr2.pillars.month.branch]); }
}
check("월두법 10년간 전수 일치", mOK);

// 10. 시두법 전수: 일간별 子시 천간 (甲己→甲子, 乙庚→丙子, 丙辛→戊子, 丁壬→庚子, 戊癸→壬子)
// twelveStage/tenGod 대칭성
check("십이운성 양간 예: 甲-亥=장생", twelveStage(0,11)==="장생");
check("십이운성 음간 예: 乙-午=장생", twelveStage(1,6)==="장생");
check("십성 대칭: 甲→戊=편재", tenGod(0,4)==="편재");
check("십성 대칭: 戊→甲=편관", tenGod(4,0)==="편관");

// 11. 오행 카운트 합=8 (시간 있을 때)
const cnt=elementCount(computeSaju({year:1993,month:1,day:10,hour:11,minute:22,gender:'F',longitude:126.7}).pillars);
check("오행 합=8", Object.values(cnt).reduce((a,b)=>a+b,0)===8);

// 12. 삼재 계산: 1992 申띠 → 寅卯辰
const s=shinsal(computeSaju({year:1993,month:1,day:10,hour:11,minute:22,gender:'F',longitude:126.7}).pillars, 1992);
const sj=s.find(x=>x.name==="삼재(민속)");
check("申띠 삼재=인묘진", sj && sj.where.includes("인·묘·진"), sj&&sj.where);

console.log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail?1:0);
