# saju-chat-vercel 백엔드

맑은사주 API (Vercel 서버리스 함수). 라이브: https://saju-chat-vercel.vercel.app

- Vercel 프로젝트: `saju-chat-vercel` (scope: `mary-jeon-s-projects`)
- 프론트엔드는 별도(GitHub Pages, `a01078794-arch.github.io`) — 여기 코드와 분리돼 있음

## 구조 (중요)

함수는 **반드시 `api/` 폴더 안**에 둔다. 그래야 Vercel이 `/api/chat`, `/api/admin`으로 라우팅한다.
`api/` 없이 `chat-backend/chat.js`처럼 평평하게 두면 라우팅이 안 잡혀 **전 경로 404**가 난다.

```
chat-backend/
├── api/
│   ├── chat.js     # /api/chat  (대화·리포트·로그)
│   └── admin.js    # /api/admin (이용기록 관리자, 비번 보호)
├── package.json
└── vercel.json
```

## 배포

GitHub push로는 자동 배포되지 않는다(git 연동 아님). Vercel CLI로 수동 배포:

```bash
vercel deploy --cwd chat-backend --prod --yes
```

배포 후 확인:
```bash
# 무단 호출 차단 확인 → 403 이어야 정상
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://saju-chat-vercel.vercel.app/api/chat \
  -H "content-type: application/json" -d '{"mode":"chat"}'
```

문제 시 롤백:
```bash
vercel promote <이전-deployment-url> --yes   # vercel ls saju-chat-vercel --prod 로 URL 확인
```

## 환경변수 (Vercel 프로젝트에 설정)

`ANTHROPIC_API_KEY`(필수) · `MODEL` · `REPORT_MODEL` · `ALLOW_ORIGIN`(허용 출처, 기본 github.io) · `BLOB_READ_WRITE_TOKEN` · `ADMIN_PW`(관리자 비번)
