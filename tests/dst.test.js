let p=0,f=0;
function check(n,c,d){ if(c){p++;console.log("[PASS] "+n);} else {f++;console.log("[FAIL] "+n+" — "+(d||""));} }
// 1987-05-10 01:30 (전환 전) → 미적용 / 03:00 → 적용 / 1987-10-11 02:30 (종료 전) → 적용 / 04:00 → 미적용
check("87-05-10 01:30 DST 미적용", !computeSaju({year:1987,month:5,day:10,hour:1,minute:30,gender:'F',longitude:127}).calcLog.some(l=>l.includes("서머")));
check("87-05-10 03:00 DST 적용", computeSaju({year:1987,month:5,day:10,hour:3,minute:0,gender:'F',longitude:127}).calcLog.some(l=>l.includes("서머")));
check("87-10-11 02:30 DST 적용", computeSaju({year:1987,month:10,day:11,hour:2,minute:30,gender:'F',longitude:127}).calcLog.some(l=>l.includes("서머")));
check("87-10-11 04:00 DST 미적용", !computeSaju({year:1987,month:10,day:11,hour:4,minute:0,gender:'F',longitude:127}).calcLog.some(l=>l.includes("서머")));
check("88-07-01 정오 DST 적용", computeSaju({year:1988,month:7,day:1,hour:12,minute:0,gender:'F',longitude:127}).calcLog.some(l=>l.includes("서머")));
check("58-06-15 DST+127.5 유지", computeSaju({year:1958,month:6,day:15,hour:12,minute:0,gender:'M',longitude:127.5}).calcLog.some(l=>l.includes("서머")));
console.log(`\n${p} PASS / ${f} FAIL`); process.exit(f?1:0);
