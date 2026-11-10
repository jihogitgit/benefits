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
- Vercel Cron: `/api/cron/sync?housing=1` (KST 03:00, 12:00), `Authorization: Bearer $CRON_SECRET`.
  보조금24를 먼저 돌리고 `housing=1`이면 청약홈·LH 공고를 이어서 돌린다. Hobby는 cron이 2개까지라
  라우트를 하나로 합쳤다. 공고 단계의 실패는 응답 200의 `housing.error`에 실리고 보조금24 결과를 가리지 않는다.
  요청 시작 후 50초가 지나면 남은 주택형 조회와 소스를 다음 실행으로 미룬다(`aborted_reason`에 기록).
- 운영 첫 적재: `supabase/migrations/006_housing.sql`을 Supabase SQL Editor에서 실행한 뒤 `npm run sync:housing`으로 첫 적재. LH API(15058530)는 공공데이터포털 활용신청이 필요하다. `HOUSING_API_KEY`는 선택(비우면 `GOV24_API_KEY`).
- 공고 수동 적재: `npm run sync:housing` (청약홈 모집공고일 최근 180일 + LH 분양·임대·주거복지·신혼희망타운).
  변경 감지는 원문 해시(`content_hash`)와 날짜로 계산한 상태 비교. 주택형은 바뀐 APT·무순위 공고만 받는다.
  매 실행 `housing:lists`를 비우고 상세는 `housing:{slug}` 태그로 한 장씩. 샘플 응답은 `npm run fixtures:housing`.
- 안전장치: 직전 성공 대비 30% 이상 건수 감소 시 중단(409), `sync_runs.aborted_reason` 기록
- 마감·소멸 항목은 삭제하지 않고 `status`만 closed/removed로 변경
- 매 실행마다 `benefits:home`·`benefits:lists`(홈·목록 수십 장)를 비우고, 상세는 **바뀐 슬러그만**
  `benefit:{slug}` 태그로 한 장씩 비운다(변경·마감·소멸 합산). 300건을 넘는 대량 변경일 때만 `benefits:all`로
  전부 비운다. 예전처럼 `benefits:all`을 매번 쏘면 상세 1만 장이 낡은 것으로 표시되어 그 뒤 크롤러 방문마다
  재생성(ISR 쓰기)이 일어나 Vercel Hobby 한도(월 20만)를 넘겼다(2026-11)

## 캐시 TTL과 비용

페이지의 재생성 주기는 그 페이지가 쓰는 `unstable_cache` 중 **가장 짧은** `revalidate`로 내려간다.
그래서 TTL은 `src/lib/benefits/queries.ts`의 `DAY`·`WEEK` 상수로 모아 두고, 데이터 변경은 TTL이 아니라
태그 무효화로 반영한다.

| 대상 | TTL | 갱신 경로 |
|---|---|---|
| 상세 `/benefit/{slug}` (`getBenefitBySlug`·`listRelated`·`peerIndex`·`listWithArticlesForDetail`) | 일주일 | cron이 바뀐 슬러그의 `benefit:{slug}`를 비움. D-day는 `DdayBadge`가 클라이언트에서 다시 셈 |
| 홈·세그먼트·지역·전체목록·마감·비교 | 하루 | cron이 매 실행마다 `benefits:lists`·`benefits:home`을 비움 |
| 가이드 | 하루(백링크는 일주일) | 발행 스크립트가 `guides`를 비움 |
| 공고 목록·지역 집계·홈/my 블록 | 하루 | cron이 매번 `housing:lists`를 비운다 |
| 공고 상세 | 일주일 | `housing:{slug}`(+`housing:all`)를 바뀐 공고만 비움. D-day는 `DdayBadge`가 브라우저에서 센다 |

- 상세 페이지의 조회 함수에는 `benefits:lists`를 달지 않는다. 달면 상세 1만 장이 그 태그를 물려받아 목록을
  비울 때마다 전부 낡은 것으로 표시된다. 그래서 `listWithArticles`(허브용, lists 태그)와
  `listWithArticlesForDetail`(상세용, all 태그만)이 따로 있다
- `benefit:{slug}` 태그는 슬러그의 sha1 앞 16자리다. Next가 태그를 `x-next-cache-tags` 응답 헤더로 내보내는데
  한글은 헤더에 들어갈 수 없다(로컬 `next start`는 이 헤더를 지워서 재현되지 않는다). 태그를 만드는 쪽과
  비우는 쪽이 모두 `benefitTag()`를 쓴다
- 가이드 발행(`guides` 태그)은 상세 1만 장의 백링크 캐시(`guideBacklinks`)에도 걸려 상세 전부가 낡은 것으로
  표시된다. 가이드는 드물게 발행하므로 감수한다
- 제목의 연도(`kstYear`)는 KST 1월 1일에 cron이 `benefits:all`을 비워서 바꾼다. cron이 중간에 실패한 날도
  어떤 행이 반영됐는지 알 수 없어 전부 비운다
- **수동 동기화(`npm run sync:gov24`, `seed:curated`)는 캐시를 비우지 않는다.** 바뀐 슬러그를
  `npm run revalidate -- --url=https://naemok.com <슬러그> ...`로 비우거나, 대량이면 한 번에:
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" -H 'content-type: application/json' -d '{"tags":["benefits:all","benefits:lists","benefits:home"]}' https://naemok.com/api/revalidate`

## 해설 발행

해설을 DB에 넣는 것만으로는 화면에 나오지 않는다. 조회 함수(`unstable_cache`)와 페이지(ISR)가
각각 캐시를 갖고 있어 최악의 경우 12시간 동안 이전 응답이 나간다. 그 사이 크롤러가 새로 생긴
내부 링크를 타고 들어오면 아직 `noindex`인 상세 페이지를 받는데, 이는 링크가 없는 것보다 나쁘다 —
검색엔진에 "색인하지 말라"고 명시적으로 알려주는 꼴이 된다. 그래서 발행 직후 재검증한다.

    npm run revalidate -- --url=https://naemok.com <슬러그> [<슬러그> ...]

- 대상은 `--url` 또는 `REVALIDATE_TARGET`으로 명시한다. `.env.local`의 `NEXT_PUBLIC_SITE_URL`은
  로컬 개발용이고, 로컬 캐시를 비우는 것은 의미가 없다
- 슬러그는 **원형(한글)** 으로 넘긴다. 스크립트가 퍼센트 인코딩해서 보낸다
- 경로는 반드시 퍼센트 인코딩되어야 한다. 프로덕션에서 두 형태를 교차 측정한 결과 인코딩된
  경로만 무효화되고(4/4) 한글 원형은 캐시가 그대로 `HIT`였다. 이 값이 틀리면 API는 `ok`를 주지만
  아무 일도 일어나지 않는다
- 무효화 직후 스크립트가 각 경로를 한 번씩 훑어 재생성까지 끝낸다. 그러지 않으면 첫 요청이
  stale을 받는데, 그 한 번을 크롤러가 가져가면 아직 `noindex`인 HTML이 넘어간다
- 서버가 처리한 목록을 보낸 것과 대조한다. 이 검사가 없으면 서버가 버린 항목을 성공으로
  출력하게 되어, 없애려던 '거짓 성공'이 스크립트 쪽에 그대로 남는다
- 태그는 `benefits:lists`·`benefits:home`과 발행한 슬러그의 `benefit:{slug}`를 보낸다. `benefits:all`은 보내지
  않는다 — 상세 1만 장이 낡은 것으로 표시되어 해설 하나 발행에 ISR 쓰기가 쏟아진다(캐시 TTL과 비용 절 참고).
  다른 상세 페이지의 "자세히 정리한 지원금" 목록에는 최대 일주일 늦게 오른다
- 사이트맵은 `revalidate` 1시간이라 따로 손대지 않아도 반영된다. `/rss.xml`은 스크립트가 매번 함께 비운다
- `/deadline`·`/{segment}/{region}`은 경로 재검증 대상이 아니다. `listWithArticles`를 쓰지 않아
  해설 발행으로 내용이 바뀌지 않는다 — 태그 무효화와 각자의 ISR로 충분하다

캐시 태그는 `src/lib/cache-tags.ts` 한 곳에서 나오고 `/api/revalidate`가 그 목록으로 검증한다.
알려진 태그가 아니면 400이다 — `revalidateTag`는 존재하지 않는 태그도 조용히 성공시키므로,
그냥 통과시키면 호출자는 무효화됐다고 믿은 채 낡은 응답이 계속 나간다(실제로 겪은 사고다).

라우트는 입력이 조금이라도 모호하면 **아무것도 무효화하지 않고** 400을 낸다. `tags`가 배열이
아니거나(배열을 빼먹는 것이 가장 흔한 실수다), 경로가 `/`로 시작하지 않거나, 모르는 태그가
하나라도 섞이면 전부 거절한다. 일부만 도는 것은 전부 실패보다 나쁘다 — 성공으로 보이기 때문이다.

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
| `/` | 조건 진단 + 마감 임박 + 분야 + 해설 링크 한 줄 (광고 없음. 애드센스 사이트 확인은 `google-adsense-account` 메타 태그) | O |
| `/my` | 진단 결과 (localStorage 기반) | X |
| `/benefits` | 전체 목록 — 분야 탭·지역·신청 상태·해설 필터, 마감 임박/최근 갱신 정렬, 20건씩 페이지 (필터를 건 주소는 noindex·follow) | 기본 주소만 O |
| `/youth` `/parenting` `/small-biz` | 세그먼트 허브 (연결된 게재 해설 3편 이상일 때만, `HUB_MIN_EXPLAINED`) | 조건부 |
| `/{segment}/{region}` | 세그먼트×지역 (그 지역 전용 항목 10개 이상 + 지역 안내문 있을 때만) | 조건부 |
| `/benefit/{slug}` | 상세 (검수 게재된 해설이 있을 때만) | 조건부 |
| `/deadline` | 마감 캘린더 | O |
| `/guide/{slug}` | 가이드 | O |
| `/housing` | 청약홈·LH 공고 목록. 탭 접수중·예정/마감, 종류 필터(필터 주소는 noindex) | 기본 주소만 O |
| `/housing/{region}` | 지역별 공고(그 지역 전용 접수중·예정 5건 이상일 때만, `HOUSING_REGION_MIN_ACTIVE`) | 조건부 |
| `/housing/{slug}` | 청약홈 공고 상세(일정·세대수·주택형). LH는 상세 없이 원문으로. 광고 없음 | X |
| `/about` `/contact` `/privacy` `/terms` | 소개·편집 원칙, 문의, 개인정보처리방침, 약관. 운영 주체는 `NEXT_PUBLIC_OPERATOR_NAME`이 있을 때만 적는다 | O |
| 404 | `src/app/not-found.tsx`(루트)와 `(site)/not-found.tsx`가 같은 한국어 본문을 낸다. 루트 레이아웃에 robots를 적지 않는 이유가 여기 있다(적으면 404에 index와 noindex가 같이 나간다) | X |
| `/sitemap.xml` | 사이트맵 인덱스 | — |
| `/rss.xml` | 발행 해설·가이드 최신 50건 (네이버 서치어드바이저 RSS 제출용, 사이트맵과 같은 색인 기준) | — |

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

애드센스 스크립트(`AdsenseScript`)와 광고 슬롯은 **해설이 게재된 상세(`/benefit/{slug}`)와 가이드(`/guide/{slug}`)에만**
넣는다. 홈을 포함한 허브·목록·마감·계산기·정책 페이지에는 둘 다 없다(애드센스 사이트 확인은 홈의
`google-adsense-account` 메타 태그와 `/ads.txt`가 맡는다) — 카드 반복이 본문의 대부분인 페이지에 광고가 붙으면 심사에서 "가치가 별로 없는 콘텐츠"로
거절된다(2026-10, 2026-11 두 번). `BenefitList`의 `showAd` 기본값도 이 때문에 꺼져 있다. 범위는
`src/app/__tests__/adsense-scope.test.ts`가 **허용 목록**으로 지킨다 — 모든 `page.tsx`를 훑어 상세·가이드 외에
광고 관련 식별자(`showAd` 포함)가 보이면 실패하므로 새 페이지는 기본적으로 광고가 없다.

상세는 검수된 해설(`review_status`가 published·stale, `indexable`)만 본문에 싣는다. 초안은 DB에 있어도 페이지에
나오지 않는다(`/about#editorial`의 약속). 해설·가이드 상단의 검수 표기는 `EditorialByline`이 낸다. 이름은 `NEXT_PUBLIC_EDITOR_NAME`, 없으면
"{SITE_NAME} 편집팀". 편집 원칙 본문은 `/about#editorial`.

## 테스트

    npm run test:run
    npm run lint
    npm run build
