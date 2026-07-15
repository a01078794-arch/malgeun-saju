# 맑은사주 — Claude 대화 백엔드 (Cloudflare Worker)

사주 사이트의 "대화" 기능이 API 키를 숨긴 채 Claude를 호출하도록 하는 작은 프록시입니다.
브라우저가 계산한 사주(명식·구조·대운)를 근거로 넘기고, 답변을 스트리밍으로 돌려줍니다.

## 마리가 할 일 (한 번만)

### 1. Anthropic API 키 발급
1. https://console.anthropic.com 접속 → 로그인/가입
2. **Settings → API Keys → Create Key** → 키 복사 (`sk-ant-...`)
3. **Billing** 에서 결제수단 등록 + 소액 크레딧 충전(예: $5). 대화당 비용은 몇 원 수준.
   - ⚠️ 이 키는 비밀입니다. 채팅창·깃허브·코드에 붙여넣지 마세요. 아래 3-b에서 `wrangler`로만 넣습니다.

### 2. Cloudflare 계정 (무료)
1. https://dash.cloudflare.com 가입 (무료 플랜으로 충분 — 일 10만 요청)

### 3. 배포
터미널에서:
```bash
cd ~/Projects/saju-web/worker
npm install -g wrangler          # 최초 1회
wrangler login                   # 브라우저로 Cloudflare 로그인
wrangler secret put ANTHROPIC_API_KEY   # 프롬프트가 뜨면 위 sk-ant-... 키 붙여넣기(화면에 안 보임)
wrangler deploy
```
배포가 끝나면 `https://malgeun-saju-chat.<계정서브도메인>.workers.dev` 같은 **워커 URL**이 출력됩니다. 그 URL을 복사해서 프론트에 넣으면 됩니다(아래 4).

### 4. 프론트에 워커 URL 연결
사이트 저장소의 `js/chat.js` 맨 위 `WORKER_URL` 값을 방금 받은 URL로 바꾸고 커밋·푸시:
```js
const WORKER_URL = "https://malgeun-saju-chat.<계정>.workers.dev";
```
비워두면(`""`) 대화창은 "준비 중"으로 표시되고 사이트의 나머지 기능은 정상 동작합니다.

## 설정값 (선택)
`wrangler.toml`의 `[vars]`:
- `MODEL` — 기본 `claude-opus-4-8`(품질 최우선). 무료/저비용 티어로 돌리려면 `claude-haiku-4-5`로 교체 후 `wrangler deploy`.
- `ALLOW_ORIGIN` — 대화를 허용할 사이트 주소. 기본은 GitHub Pages 주소. 커스텀 도메인 쓰면 바꾸기.

## 비용·안전 메모
- 키는 워커 시크릿에만 있음 → 브라우저/저장소에 노출 0.
- 히스토리 최근 12턴·질문 2000자로 제한(비용 방어).
- 공개 사이트라 누구나 대화 가능 → 남용이 걱정되면 Cloudflare 대시보드에서 Rate Limiting 룰 추가 권장.
- 수익화 연결: 무료는 `claude-haiku-4-5`, 990/4900원 유료 심층은 `claude-opus-4-8`로 워커를 2개 두거나 MODEL을 분기하면 됨(후속 작업).
