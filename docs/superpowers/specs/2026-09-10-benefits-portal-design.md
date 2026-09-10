# 지원금 조회 포털 설계 문서

**날짜:** 2026-09-10
**단계:** Phase 1 MVP (세그먼트 3개)
**프로젝트 루트:** `/Users/mw/prodect/benefits`
**브랜드명:** 미정 (도메인 확인 후 결정, 코드에서는 `SITE_NAME` 환경변수로 관리)

---

## 1. 개요

### 목표

국가·지자체 지원금(보조금)을 나이·상황(생애주기)·지역·직업 조건으로 걸러 "내가 받을 수 있는 것"을 한 화면에서 확인하고, 각 지원금의 자격·금액·신청방법을 쉬운 말로 해설하는 사이트를 만든다. 수익은 Google AdSense + Kakao AdFit 광고로 낸다.

### 왜 만드는가

- 검색 수요는 검증됨: "청년 지원금", "출산 지원금", "소상공인 지원금" 계열 검색은 연중 발생하며 연초·정책 발표 시 급증한다.
- 공식 채널(정부24 보조금24, 복지로)은 본인인증이 필요하거나 원문 그대로 노출해 읽기 어렵다. 토스의 "숨은 정부지원금 찾기"는 2024년 8월 종료됐고, 현재 민간 대안은 웰로 정도다.
- 기존 자산 재사용: `real_estate`(청약마당)의 Next.js + Supabase + Vercel + AdSlot 구조와 `blogProgram`의 짠테크 콘텍스트를 그대로 잇는다.

### 확정된 결정 (브레인스토밍 결과)

| 항목 | 결정 |
|---|---|
| 1차 범위 | 청년 · 출산/육아 · 소상공인 3개 세그먼트, 이후 확장 |
| 스택 | 청약마당 스택 재사용, 신규 리포·신규 도메인 |
| 개인화 | 비로그인 조건 진단, 선택값은 localStorage |
| 콘텐츠 | AI 초안 + 사람 검수 후 게재, 미검수 페이지는 noindex |
| 홈 화면 | 조건 진단 우선형(목업 A) + 마감 임박/신규 블록 |
| 상세 페이지 | 요약 카드 + 30초 체크리스트 우선형(목업 A) |
| 반응형 | 단일 URL, 데스크톱 2단(본문+우측 레일) / 모바일 1단 |
| 수익 | AdSense + AdFit 이중, 제휴 링크는 2단계 |
| 데이터 | 배치 동기화 + DB (Vercel Cron 하루 2회) |

### 범위 밖 (Phase 1 제외)

- 회원 가입, 관심 지원금 저장, 마감 알림
- 본인인증 기반 자동 자격 판정
- 금융상품 제휴 링크
- 앱 출시
- 3개 세그먼트 외 전 범위 노출(데이터는 적재하되 색인하지 않음)

---

## 2. 기술 스택

```
프론트엔드:  Next.js 15 App Router + TypeScript + Tailwind CSS 4 + shadcn/ui
데이터베이스: Supabase (PostgreSQL)  — Auth는 관리자 검수 화면에만 사용
캐싱:        Upstash Redis (진단 검색 결과 10분)
배포:        Vercel (Cron Jobs 포함)
광고:        Google AdSense + Kakao AdFit (AdSlot 래퍼)
AI 초안:     Claude API (claude-sonnet-5 기본, 검수 화면에서 재생성 가능)
모니터링:    GA4 + Search Console + Vercel Analytics + Sentry
테스트:      Vitest + React Testing Library
```

`real_estate`에서 복사해 오는 것: `AdSlot.tsx`, `AdFitBanner.tsx`, `privacy/terms/about` 페이지, Supabase 클라이언트 설정, 루트 레이아웃의 GA4/AdSense 스크립트 로더, `.env` 키 구조, Vitest 설정.

---

## 3. 아키텍처

```
사용자 브라우저
   │
   ▼
Next.js 15 App Router (Vercel)  ─ 단일 URL 반응형
   ├─ SSG/ISR 페이지: 세그먼트, 세그먼트×지역, 지원금 상세, 가이드   ← 색인 담당
   ├─ CSR 페이지: /my 진단 결과 (noindex)                         ← 개인화 담당
   └─ Route Handlers: /api/benefits/search (진단 필터 쿼리)
              │
   ┌──────────┼──────────────┐
   ▼          ▼              ▼
Supabase   Upstash Redis   공공 API (보조금24 / 복지로 / 온통청년 / 기업마당)
Postgres   (검색 캐시)      ▲
(원천+해설)                 │  Vercel Cron 매일 03:00, 12:00 (KST)
                           └─ scripts/sync-*.mjs → upsert → 변경분 revalidateTag
```

### 렌더링 전략

| 페이지 | 방식 | 재검증 |
|---|---|---|
| 홈 `/` | ISR | 1시간 |
| 세그먼트 허브 `/youth` 등 | ISR | 1시간 |
| 세그먼트×지역 | ISR | 6시간 |
| 지원금 상세 | ISR + 태그 재검증 | 6시간, 동기화 시 즉시 |
| 마감 캘린더 `/deadline` | ISR | 1시간 |
| 가이드 | SSG | 배포 시 |
| `/my`, 검색 결과 | CSR | 없음 |

---

## 4. 데이터 레이어

### 4.1 원천 소스

| 소스 | 제공처·식별자 | 형태 | 규모 | 개발계정 한도 | 이용허락 | 역할 |
|---|---|---|---|---|---|---|
| 보조금24 공공서비스(혜택) 정보 | 행정안전부, data.go.kr `15113968` | REST JSON/XML, 목록·상세·지원조건 3개 오퍼레이션 | 약 1만 건(중앙+지자체+공공기관+교육청) | 1일 10,000회, 자동승인 | 제한 없음(상업 이용 가능) | **주 소스** |
| 복지로 중앙부처 복지서비스 | 한국사회보장정보원, data.go.kr `15090532` | REST XML, 목록·상세 | 미확인 | 1일 100회 | 제한 없음 | 보조(Phase 5) |
| 복지로 지자체 복지서비스 | 한국사회보장정보원, data.go.kr `15108347` | REST XML, 목록·상세 | 미확인 | 1일 1,000회 | 제한 없음 | 보조(Phase 5) |
| 온통청년 청년정책 | 고용정보원, `youthcenter.go.kr/opi/youthPlcyList.do` | JSON, 온통청년 자체 키(담당자 승인) | 미확인 | 미확인 | 미확인 | 청년 세그먼트 보조(Phase 5) |
| 기업마당 지원사업 | 중소벤처기업부, `bizinfo.go.kr/uss/rss/bizinfoApi.do` | RSS/JSON, 기업마당 자체 키 | 약 1,400건 공고 | 미확인 | 미확인 | 소상공인 세그먼트 보조(Phase 5) |

확인 사항: 보조금24 오퍼레이션의 정확한 경로와 지원조건 필드 코드표는 data.go.kr에서 키 발급 후 Swagger 문서로 확정한다. Phase 1 첫 작업에서 샘플 응답을 `fixtures/`에 저장해 이후 모든 테스트의 기준으로 쓴다.

### 4.2 "실시간"의 정의

- 어떤 소스도 푸시·웹훅·RSS 변경 알림을 제공하지 않는다. 보조금24는 항목별 `수정일시`를 제공하므로 주기적으로 전체를 받아 변경분만 반영하는 것이 유일한 방법이다.
- 신선도 목표: 최대 12시간 지연 (Cron 03:00, 12:00).
- 마감 D-day, "오늘 새로 올라온" 배지는 요청 시점에 서버가 계산한다.
- 모든 페이지 하단에 "최종 확인 YYYY-MM-DD HH:mm"과 원문 링크를 표기한다. 마지막 성공 동기화가 24시간을 넘으면 회색 안내를 띄운다.

### 4.3 동기화 흐름 (보조금24)

1. 목록 API를 1,000건 단위로 순회해 전체를 받는다(약 10회 호출). 지원조건 API도 같은 방식으로 받는다(약 10회). 하루 총 호출은 수십 회로 한도의 1% 미만이다.
2. 행마다 `source = 'gov24'`, `source_id = 서비스ID`로 기존 행을 찾고, `source_updated_at`(수정일시)이 다를 때만 upsert한다.
3. 지원조건 코드(나이·성별·소득·생애주기·가구·직업)를 우리 필터 스키마로 정규화해 `benefit_conditions`에 저장한다. 매핑 표는 `src/lib/conditions/codemap.ts`에 둔다.
4. 세그먼트 태깅: 생애주기·직업 조건과 제목·대상 텍스트 키워드로 `segments[]`를 부여한다(청년: 만 19~39세 조건 또는 "청년" 키워드, 출산/육아: 임신·출산·영유아·양육 조건 또는 키워드, 소상공인: 사업자·소상공인·자영업 조건 또는 키워드). 규칙은 `src/lib/segments/rules.ts`에 두고 단위 테스트로 고정한다.
5. 지역 태깅: 소관기관·접수기관 텍스트에서 시도 코드를 추출해 `region_code`에 저장한다. 중앙부처 소관은 `ALL`.
6. 변경된 행의 `benefit:{slug}` 태그와 소속 세그먼트·지역 목록 태그를 `revalidateTag`로 재생성한다.
7. `apply_end`가 지난 항목은 `status = 'closed'`로 바꾼다. 삭제하지 않는다. 원천에서 사라진 항목은 `status = 'removed'`로 표시하고 페이지는 "마감됨" 안내로 유지한다.
8. 실행 결과를 `sync_runs`에 기록한다.

보조 소스(Phase 5)는 같은 패턴으로 `source` 값만 다르게 적재하고, 제목·소관기관 정규화 문자열이 일치하는 보조금24 항목이 있으면 그 항목의 `alt_sources[]`에 붙여 중복 페이지를 만들지 않는다.

### 4.4 테이블

```sql
benefits
  id uuid pk
  source text            -- gov24 | bokjiro_central | bokjiro_local | youthcenter | bizinfo
  source_id text         -- 원천 식별자, (source, source_id) unique
  slug text unique       -- 한글 제목 기반 slug, 충돌 시 -2 접미
  title text
  summary text           -- 서비스목적요약
  amount_text text       -- 지원내용 원문
  target_text text       -- 지원대상 원문
  criteria_text text     -- 선정기준 원문
  apply_method text
  apply_url text         -- 상세조회URL(공식 신청/안내 페이지)
  agency text            -- 소관기관
  contact text
  deadline_type text     -- always | period | unknown
  apply_start date
  apply_end date
  region_code text       -- 시도 코드 또는 ALL
  segments text[]        -- youth | parenting | small_biz | other
  status text            -- open | closed | removed
  alt_sources jsonb      -- 보조 소스 중복 매핑
  source_updated_at timestamptz
  synced_at timestamptz
  created_at timestamptz

benefit_conditions
  benefit_id uuid pk fk
  age_min int, age_max int
  gender text            -- any | male | female
  income_bands text[]    -- 중위소득 구간 코드
  life_stages text[]     -- pregnancy | infant | child | youth | middle | senior ...
  household_types text[] -- single | multi_child | single_parent | ...
  occupations text[]     -- job_seeker | worker | self_employed | farmer | ...
  region_codes text[]

benefit_articles
  benefit_id uuid pk fk
  explainer_md text      -- 쉽게 풀어쓴 해설
  steps_md text          -- 신청 순서
  faq_json jsonb         -- [{q, a}] 5개
  checklist_json jsonb   -- [{label, condition_key}] 30초 체크 항목
  related_ids uuid[]
  review_status text     -- draft | reviewed | published | stale
  indexable boolean      -- published일 때만 true
  model text, drafted_at timestamptz
  reviewed_by text, reviewed_at timestamptz

segments (slug, name, description_md, order)
regions  (code, slug, name, description_md)   -- 시도 17개, 지역별 고유 안내문
guides   (slug, title, body_md, segment, published_at)

sync_runs
  id, source, started_at, finished_at, fetched, upserted, skipped, failed, error, aborted_reason
```

인덱스: `benefits(status, segments)`, `benefits(region_code)`, `benefits(apply_end)`, `benefit_conditions(age_min, age_max)`, GIN 인덱스 `segments`, `life_stages`, `occupations`, `region_codes`.

### 4.5 진단 필터 쿼리

입력: `age_band`(10대/20대/30대/40대/50대+), `situations[]`(임신·출산, 자녀 있음, 구직 중, 사업자, 1인 가구 등), `region`.
처리: `benefit_conditions`에서 나이 범위 포함, 상황 → life_stages/household_types/occupations 매핑 중 하나 이상 일치, 지역 일치 또는 ALL, `status = open`. 조건 행이 없는 항목은 결과 끝에 "조건 확인 필요" 그룹으로 붙인다.
정렬: 마감 임박 순 → 상시 → 조건 확인 필요.
캐시: 입력 조합을 키로 Redis 10분.

---

## 5. 페이지 구조

```
/                         홈: 진단 칩(나이·상황·지역) + 결과 개수 버튼 + 마감 임박 + 오늘 새로 올라온
/my                       진단 결과 목록 (CSR, noindex)
/youth  /parenting  /small-biz
                          세그먼트 허브: 소개문 + 마감 임박 + 인기 + 지역별 보기 + 가이드
/{segment}/{region}       세그먼트×지역: 지역 안내문 + 해당 목록 (항목 3개 미만이면 noindex)
/benefit/{slug}           지원금 상세
/deadline                 이번 주/이번 달 마감 캘린더
/guide/{slug}             가이드 글
/about /privacy /terms /contact
/admin/review             검수 화면 (Supabase Auth, noindex, robots 차단)
/sitemap.xml /robots.txt /ads.txt
```

### 5.1 홈 (목업 A + 하이브리드)

- 히어로: "내가 받을 수 있는 지원금은?" + 칩 3줄(나이 / 상황 / 지역). 칩 클릭마다 `/api/benefits/search?count=1`로 개수만 받아 버튼 문구 갱신("내 지원금 27개 보기").
- 선택값은 localStorage `diagnosis` 키에 저장. 재방문 시 히어로가 "이어서 보기: 내 지원금 N개" 상태로 시작.
- 아래 블록: 마감 임박(D-14 이내 8개), 오늘 새로 올라온(24시간 내 등록 최대 8개), 세그먼트 3개 카드, 가이드 3편.
- 광고 1곳: 진단 블록 아래.

### 5.2 지원금 상세 (목업 A)

순서: 브레드크럼 → 제목 → 배지(D-day/지역/세그먼트/최종 확인일) → **한눈에 보기 4칸**(금액·대상·기간·신청처) → **30초 체크리스트**(진단값으로 프리필, "3개 중 2개 충족" 문장) → 광고 → 쉽게 풀어쓴 해설 → 신청 순서 → FAQ → 광고 → 함께 받을 수 있는 지원금(가로 스크롤 3~6개) → 출처·최종 확인·원문 링크.
데스크톱 우측 레일(sticky): 목차(현재 위치 강조) → "공식 사이트에서 신청" 버튼 → 광고 300×600 → "내 진단 결과 보기".
모바일: 하단 고정 "공식 사이트에서 신청" 버튼.
해설이 없는(미검수) 항목: 요약 4칸·원문 텍스트·신청 버튼만 표시, `noindex`.
마감된 항목: 상단에 "마감됨, 다음 공고 시 갱신" 안내 + 같은 세그먼트 대안 3개.

### 5.3 반응형 규칙

- 단일 URL. 분기점 1024px: 이상은 본문 + 우측 레일(320px), 미만은 1단.
- 모바일 우선 CSS. 광고 슬롯은 고정 높이를 예약해 CLS를 막는다.
- 터치 타깃 44px 이상, 칩은 줄바꿈 허용.

---

## 6. SEO · 색인 정책

### 6.1 대량 생성 콘텐츠 남용 회피

구글 스팸 정책(2024-03 이후 강화)은 템플릿에 값만 바꿔 넣은 대량 페이지를 제재한다. 따라서:

- 색인 대상은 (a) `benefit_articles.indexable = true`인 상세, (b) 세그먼트 허브, (c) 항목 3개 이상이고 `regions.description_md`가 있는 세그먼트×지역, (d) 가이드로 한정한다.
- 그 외 모든 상세 페이지는 `noindex, follow`로 두고 사이트맵에서 제외한다. 링크는 유지해 크롤러가 구조를 이해하게 한다.
- `/my`, 검색 결과, `/admin/*`는 항상 `noindex`. `/admin`은 robots.txt에서도 차단.
- 애드센스 심사 신청 조건: 검수 완료 상세 150개 이상, 가이드 10편 이상, 색인 페이지 본문 800자 이상, 서치콘솔에서 색인 확인.

### 6.2 메타·구조화 데이터

- 상세 title: `{지원금명} 자격조건·신청방법 ({연도})`. description: 금액·대상·기간을 120자 이내.
- 세그먼트 허브 title: `{연도} {세그먼트명} 지원금 총정리 · 조건별 조회`.
- JSON-LD: 상세에 `GovernmentService`(name, provider.name = agency, areaServed, audience, url = apply_url) + `BreadcrumbList` + `FAQPage`(faq_json). 허브·지역 페이지에 `BreadcrumbList` + `ItemList`.
- 캐노니컬은 각 페이지 자기 URL. 쿼리스트링 변형은 캐노니컬로 통합.
- 사이트맵: `sitemap.xml`은 인덱스, 하위 `sitemap-benefits-{segment}.xml`, `sitemap-regions.xml`, `sitemap-guides.xml`, `sitemap-static.xml`. `lastmod`는 상세는 `max(source_updated_at, reviewed_at)`.
- OG 이미지: 제목·금액·마감을 넣은 동적 이미지(`opengraph-image.tsx`).

### 6.3 내부 링크

- 상세 → 함께 받는 지원금 3~6개(같은 세그먼트·지역 우선), 브레드크럼으로 허브·지역.
- 허브 → 지역별 보기 17개, 마감 임박, 가이드.
- 가이드 → 본문 내 관련 상세 링크 3개 이상.
- 고립 페이지 0을 배포 전 스크립트로 검증.

---

## 7. 광고 · 애드센스 요건

- 필수 페이지: 소개, 개인정보처리방침(광고 쿠키·GA4·애드핏 명시), 이용약관, 문의(이메일 + 간단 폼). 청약마당 페이지를 복사해 서비스명·연락처만 교체.
- `public/ads.txt`에 애드센스 퍼블리셔 ID. 루트 레이아웃 애드센스 스크립트는 `NEXT_PUBLIC_ADSENSE_CLIENT` 환경변수가 있을 때만 삽입(승인 후 설정).
- 애드핏은 승인 전부터 운영. `AdSlot` 컴포넌트의 `type` prop으로 슬롯별 전환.
- 슬롯 위치(고정): 홈 1(진단 블록 아래), 상세 3(체크리스트 아래, FAQ 아래, 데스크톱 우측 레일), 목록 1(5번째 항목 뒤). 첫 화면 정보 위에는 두지 않는다.
- 광고 로드 실패 시 슬롯을 접어 레이아웃이 밀리지 않게 한다.
- 심사 전 점검: 모든 색인 페이지에 광고 정책 위반 요소(과도한 클릭 유도 문구, 팝업) 없음, 콘텐츠와 광고 구분 표시("광고" 라벨).

---

## 8. 콘텐츠 제작 파이프라인

1. `scripts/draft-articles.mjs`: `benefit_articles`가 없거나 `stale`인 항목을 세그먼트 우선순위(청년 → 출산/육아 → 소상공인) 및 마감 임박 순으로 N개 골라 Claude API에 원문(제목·요약·지원대상·선정기준·지원내용·신청방법·기한)을 넘긴다. 출력은 JSON: `explainer_md`, `steps_md`, `faq`(5개), `checklist`(3~5개, 각 항목에 `condition_key`), `related_keywords`. `review_status = draft`로 저장.
2. 프롬프트 규칙: 원문에 없는 금액·나이·기간·기관을 만들지 않는다. 불확실하면 "공식 페이지에서 확인"으로 쓴다. 문장은 중학생이 읽을 수 있는 수준, 각 섹션 길이 상한 명시.
3. 자동 대조: 초안에 등장하는 숫자(원, 세, 개월, 일자)와 기관명이 원문에 존재하는지 검사해 불일치 목록을 `draft_warnings`에 저장.
4. `/admin/review`: 원문(왼쪽)과 초안(오른쪽) 나란히, 경고 표시, 인라인 수정, 관련 지원금 선택, "게재" 버튼 → `published`, `indexable = true`, `reviewed_at`. "재생성" 버튼으로 초안 다시 요청.
5. `source_updated_at > reviewed_at`이 되면 동기화가 `review_status = stale`로 바꾼다. 페이지는 유지하되 상단에 "내용 확인 중" 배지.
6. 가이드 10편은 같은 검수 화면에서 마크다운으로 직접 작성·게재.

---

## 9. 오류 처리

- 소스별 독립 실행. 한 소스 실패가 다른 소스를 막지 않는다. 실패 시 `sync_runs.error` 기록, 마지막 성공 데이터 유지.
- 응답 스키마는 Zod로 검증. 행 단위로 건너뛰고 `skipped` 카운트. 필수 필드(서비스ID, 서비스명) 누락은 건너뜀.
- 전체 건수가 직전 성공 대비 30% 이상 감소하면 upsert를 중단하고 `aborted_reason` 기록(잘못된 대량 삭제 방지). Sentry 알림.
- 마감·소멸 항목은 삭제 대신 상태 변경. URL 영구 유지.
- 진단 필터에서 조건 미정규화 항목은 "조건 확인 필요" 그룹으로 노출.
- API 키 만료·403은 즉시 중단하고 알림.
- 광고 스크립트 실패는 빈 슬롯 접기.
- 상세 페이지 slug 미존재는 404 + 같은 세그먼트 인기 지원금 6개 안내.

---

## 10. 테스트

- **단위(Vitest)**: 조건 코드 → 필터 스키마 정규화(`codemap`), 세그먼트 태깅 규칙, 지역 추출, slug 생성·충돌, 마감 상태 계산(D-day, closed 전환), 수정일시 diff 판정, 초안 자동 대조.
- **통합**: 동기화 스크립트를 fixture 응답으로 실행 → upsert/skip 건수, revalidate 태그 목록, 30% 급감 차단, `stale` 전환 검증.
- **컴포넌트(RTL)**: 진단 칩 선택 → 개수 갱신 → localStorage 저장·복원, 30초 체크 프리필과 충족 문장, AdSlot 실패 시 접힘.
- **SEO 회귀 스크립트**: 빌드 산출물에서 색인 페이지의 title/description/canonical/JSON-LD 존재, noindex 페이지의 사이트맵 미포함, 고립 페이지 0.
- **성능 기준**: Lighthouse 모바일 성능 90 이상, CLS 0.1 미만, LCP 2.5초 미만.

---

## 11. 단계 계획

| 단계 | 범위 | 완료 기준 |
|---|---|---|
| 1. 기반 | 프로젝트 생성(청약마당 복사·정리), Supabase 스키마·마이그레이션, 보조금24 키 발급·fixture 저장, 동기화 스크립트, 세그먼트·지역 태깅, Cron 설정 | 약 1만 건 적재, Cron 2회/일 성공, 단위·통합 테스트 통과 |
| 2. 화면 | 홈 진단, `/my`, 세그먼트 허브, 세그먼트×지역, 상세(A안), 마감 캘린더, 필수 페이지, AdSlot(애드핏), 반응형 | 컴포넌트 테스트 통과, Lighthouse 기준 통과 |
| 3. 콘텐츠 | 초안 스크립트, 검수 화면, 핵심 지원금 150개 검수·게재, 가이드 10편, 지역 안내문 17개 | 색인 대상 페이지 160개 이상, SEO 회귀 스크립트 통과 |
| 4. 런칭 | 도메인·브랜드 확정, GA4·Sentry·서치콘솔, 사이트맵 제출, 색인 확인, 애드센스 신청 | 신청 완료, 애드핏 운영 중 |
| 5. 확장 | 복지로·온통청년·기업마당 소스, 전 세그먼트 확대, 상세 요청 시 개별 재확인, 저장·알림 | 별도 스펙 |

---

## 12. 열린 질문과 Plan 1에서 확정된 사실

### Plan 1(2026-09-10)에서 확정

- 보조금24 API: 총 10,947건, odcloud `gov24/v3/serviceList`·`supportConditions`, 한글 키 그대로. 일시 필드는 `YYYYMMDDHHmmss`(KST). 개발계정 키로 전체 적재는 약 22회 호출.
- 지원조건 코드표는 `src/lib/conditions/codemap.ts`에 확정(fixture 커버리지 테스트로 누락 0). 나이 코드 `JA0110`/`JA0111`(숫자, 상한 120은 무제한).
- **조건 코드 규약**: 한 그룹(성별·소득·가구 등)의 코드가 전부 `Y`면 "제한 없음"이다. 이를 개별 조건으로 읽으면 세그먼트 오탐이 폭증한다(출산·육아 9,915건 → 규칙 수정 후 3,186건).
- 신청기한 분포: 상시 6,781 / 미확정 3,552 / 기간 614. 달력에 없는 날짜(`2026.03.00.`, `04-31`)가 실데이터에 있어 파서가 검증한다.
- 세그먼트 적재 결과: 청년 956, 출산·육아 3,186, 소상공인 1,142, 기타 6,292. 지역: 전국(ALL) 2,366, 서울 1,009, 경기 1,141.
- 마감 지난 항목 451건은 `closed`로 적재됨.
- 재정규화(코드맵·태깅 규칙 변경 후)는 `npm run sync:gov24 -- --force`.

### Plan 2로 넘기는 질문

- 검색 랭킹: 상황 조건이 없는(전 국민 대상) 항목이 상황 필터를 통과해 결과 상단을 차지한다(예: 20대·구직 검색에 인플루엔자 예방접종). Plan 2에서 (a) 사용자 지역 일치 항목을 ALL보다 위로, (b) 상황 조건이 실제로 일치한 항목을 "조건 무관" 항목보다 위로 올리는 정렬을 넣는다.
- 세그먼트 오탐 잔여: "아동" 키워드가 장애아동·아동복지시설 등을 출산·육아로 잡는다. 색인은 검수된 항목만 하므로 Phase 1 영향은 없고, Plan 3 검수 화면에서 세그먼트 수정 기능으로 보정한다.
- 브랜드명·도메인 → Phase 4 전까지 결정. 코드에서는 `SITE_NAME`, `NEXT_PUBLIC_SITE_URL` 환경변수.
- 지역 안내문 17개의 작성 → 검수 화면에서 AI 초안 + 검수로 동일 처리.

## 참고 자료

- 보조금24 API: https://www.data.go.kr/data/15113968/openapi.do
- 복지로 중앙부처: https://www.data.go.kr/data/15090532/openapi.do
- 복지로 지자체: https://www.data.go.kr/data/15108347/openapi.do
- 온통청년 Open API: https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiDoc
- 기업마당 API 안내: https://www.bizinfo.go.kr/web/lay1/program/S1T175C174/apiList.do
- 정부24 Open API 안내: https://www.gov.kr/openapi
- 토스 숨은 정부지원금 찾기 종료 관련: https://toss.im/tossfeed/article/toss-subsidy
- 브레인스토밍 목업: `/Users/mw/prodect/.superpowers/brainstorm/71802-1789004000/content/` (home-layout.html, detail-layout.html)
- 재사용 원본: `/Users/mw/prodect/real_estate` (청약마당)
