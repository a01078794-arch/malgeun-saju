
/* ===== TESTS ===== */
function show(name, input, expected){
  const r = computeSaju(input);
  const P = r.pillars;
  const got = [P.year,P.month,P.day,P.hour].map(p=>p?STEMS[p.stem]+BRANCHES[p.branch]:'??').join(' ');
  const ok = got === expected ? 'PASS' : 'FAIL';
  console.log(`[${ok}] ${name}: got ${got} | expected ${expected} | 대운수 ${r.luckStart} ${r.forward?'순행':'역행'} | 진태양시 ${r.trueSolar}`);
  if(ok==='FAIL'){ console.log('  calcLog:', r.calcLog.join(' / ')); }
  return r;
}
show('케이스A', {year:1993,month:1,day:10,hour:11,minute:22,gender:'F',longitude:126.7}, '壬申 癸丑 辛卯 癸巳');
show('케이스B', {year:1994,month:2,day:26,hour:8,minute:30,gender:'F',longitude:127.5}, '甲戌 丙寅 癸未 丙辰');
show('케이스C', {year:1995,month:5,day:14,hour:15,minute:29,gender:'F',longitude:126.7}, '乙亥 辛巳 乙巳 癸未');
show('케이스D', {year:1992,month:8,day:20,hour:8,minute:30,gender:'F',longitude:127.5}, '壬申 戊申 戊辰 丙辰');
const r5 = computeSaju({year:1993,month:1,day:10,hourUnknown:true,gender:'F',longitude:127.5});
console.log('[INFO] 시간모름 hour pillar:', r5.pillars.hour);
console.log('[CHECK] 辛-卯:', tenGodBranch(7,3), twelveStage(7,3), '| 辛-酉:', twelveStage(7,9), '| 癸-未:', twelveStage(9,7), '| 癸-亥:', twelveStage(9,11));
const r1 = computeSaju({year:1993,month:1,day:10,hour:11,minute:22,gender:'F',longitude:126.7});
console.log('[CHECK] 케이스A 신살:', shinsal(r1.pillars, r1.sajuYear).map(s=>s.name).join(', '));
const r2 = computeSaju({year:1994,month:2,day:26,hour:8,minute:30,gender:'F',longitude:127.5});
console.log('[CHECK] 케이스B 신살:', shinsal(r2.pillars, r2.sajuYear).map(s=>s.name).join(', '));
console.log('[CHECK] 케이스A 2026:', JSON.stringify(yearlyFortune(r1.pillars,2026,1)[0].events));
console.log('[CHECK] 케이스B 2026:', JSON.stringify(yearlyFortune(r2.pillars,2026,1)[0].events));
console.log('[CHECK] 케이스A 대운 목록:', r1.luckPillars.map(l=>STEMS[l.stem]+BRANCHES[l.branch]+'('+l.startAge+')').join(' '));
console.log('[CHECK] 케이스B 대운 목록:', r2.luckPillars.map(l=>STEMS[l.stem]+BRANCHES[l.branch]+'('+l.startAge+')').join(' '));
