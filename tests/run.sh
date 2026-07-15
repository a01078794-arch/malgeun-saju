#!/bin/bash
# 엔진 테스트: cat 방식 (브라우저 전역 공유를 에뮬레이트)
cd "$(dirname "$0")/.."
for t in charts edge dst; do
  cat js/manseryeok.js tests/$t.test.js > /tmp/_t.js && node /tmp/_t.js || exit 1
done
cat js/manseryeok.js tests/term-accuracy.js > /tmp/_t.js && node /tmp/_t.js
# 해석 겹침 가드레일 (manseryeok+data+interp 필요)
cat js/manseryeok.js js/data.js js/interp.js tests/overlap.test.js > /tmp/_t.js && node /tmp/_t.js || exit 1
echo "smoke.js는 jsdom 필요: cd tests && npm i jsdom && node smoke.js"
