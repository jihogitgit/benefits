# 지원금 포털 (benefits)

정부·지자체 지원금을 나이·상황·지역 조건으로 조회하는 사이트. 설계: `docs/superpowers/specs/2026-09-10-benefits-portal-design.md`

## 개발

    source ~/.nvm/nvm.sh && nvm use 22
    cp .env.local.example .env.local   # 값 채우기
    npm install
    # Supabase 대시보드 SQL Editor에서 supabase/migrations/001_initial.sql 실행
    npm run seed:static                # 시도·세그먼트
    npm run fixtures:capture           # 보조금24 샘플 응답 → fixtures/
    npm run sync:gov24                 # 전체 적재 (1~3분)
    npm run dev

## 동기화

- 로컬 전체 적재: `npm run sync:gov24`
- Vercel Cron: `/api/cron/sync-gov24` (KST 03:00, 12:00), `Authorization: Bearer $CRON_SECRET`
- 안전장치: 직전 성공 대비 30% 이상 건수 감소 시 중단(409), `sync_runs.aborted_reason` 기록
- 마감·소멸 항목은 삭제하지 않고 `status`만 closed/removed로 변경
- 변경된 항목은 `benefit:{slug}`, `segment:{seg}`, `benefits:home` 태그로 재검증

## 검색 API

`GET /api/benefits/search?age=30s&situations=pregnancy,single&region=seoul&count=1`

- `age`: 10s | 20s | 30s | 40s | 50s+
- `situations`: pregnancy, has_child, job_seeker, business, single, no_house, student (쉼표 구분)
- `region`: 시도 slug (seoul, gyeonggi …)
- `count=1`이면 총 개수만, 아니면 `limit`(최대 100)·`offset`으로 페이지

## 테스트

    npm run test:run
    npm run lint
    npm run build
