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
- 변경이 있으면 `benefits:home`·`benefits:all` 두 태그만 재검증한다. `unstable_cache`의 태그는 함수 단위라
  `benefit:{slug}`·`segment:{seg}` 태그를 가진 캐시 항목은 존재하지 않는다(그런 루프는 no-op이면서
  전건 변경 시 만 번 넘는 호출이 되어 `maxDuration` 60초를 위협한다)

## 검색 API

`GET /api/benefits/search?age=30s&situations=pregnancy,single&region=seoul&count=1`

- `age`: 10s | 20s | 30s | 40s | 50s+
- `situations`: pregnancy, has_child, job_seeker, business, single, no_house, student (쉼표 구분)
- `region`: 시도 slug (seoul, gyeonggi …)
- `count=1`이면 총 개수만, 아니면 `limit`(최대 100)·`offset`으로 페이지
- 정렬: 조건 일치 점수(상황 2·지역 1·나이 1) 내림차순 → 마감 임박 → 상시 → 조건 확인 필요.
  조건이 아예 등록되지 않은 전 국민 대상 항목은 점수 0이라 뒤로 간다

## 페이지

| 경로 | 내용 | 색인 |
|---|---|---|
| `/` | 조건 진단 + 마감 임박 + 분야 + 해설 링크 한 줄 | O |
| `/my` | 진단 결과 (localStorage 기반) | X |
| `/youth` `/parenting` `/small-biz` | 세그먼트 허브 | O |
| `/{segment}/{region}` | 세그먼트×지역 (항목 3개 이상 + 지역 안내문 있을 때만) | 조건부 |
| `/benefit/{slug}` | 상세 (검수 게재된 해설이 있을 때만) | 조건부 |
| `/deadline` | 마감 캘린더 | O |
| `/guide/{slug}` | 가이드 | O |
| `/sitemap.xml` | 사이트맵 인덱스 | — |

색인 규칙은 `src/lib/seo/index-policy.ts` 한 곳에서 결정하고 페이지 robots 메타와 사이트맵이 모두 따른다.

사이트맵은 `generateSitemaps`로 분할되며 실제 경로는 `/sitemap/0.xml`(정적 + 지역 허브)과
`/sitemap/1~3.xml`(공개 세그먼트별 상세)이다. **`generateSitemaps`는 인덱스를 만들지 않으므로**
`/sitemap.xml`은 `src/app/sitemap.xml/route.ts`가 직접 연다(검색엔진 등록 도구가 기본값으로
가정하는 경로라 한 번만 제출하면 된다). `robots.txt`는 인덱스와 분할 파일을 함께 나열한다 —
인덱스를 따라가지 않는 크롤러도 있기 때문이다. `sitemapPaths()`가 세 곳의 단일 출처다.

해설이 게재된 지원금은 허브의 "마감 임박 순" 정렬(`apply_end` 오름차순)에서 맨 뒤로 밀린다
(대부분 상시 접수라 `apply_end`가 null). 그대로 두면 본문이 가장 충실한 페이지가 내부 링크
0인 고아 페이지가 되므로, `listWithArticles()`가 이들을 따로 뽑아 홈 한 줄과 허브 상단
"자세히 정리한 지원금"에 링크한다. 이 함수는 `benefit_articles`를 부모로 조회한다 —
정렬 기준(`reviewed_at`)이 해설 쪽 열이라 그래야 `LIMIT`이 색인 대상 집합에만 걸린다.

## 광고

`AdPlacement` 컴포넌트가 유일한 진입점. `NEXT_PUBLIC_ADSENSE_CLIENT`와 해당 슬롯 ID가 **둘 다** 있으면
애드센스, 없고 `NEXT_PUBLIC_ADFIT_UNIT_*`가 있으면 애드핏, 둘 다 없으면 렌더하지 않는다.

## 테스트

    npm run test:run
    npm run lint
    npm run build
