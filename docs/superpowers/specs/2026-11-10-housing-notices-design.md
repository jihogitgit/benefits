# 청약·임대 공고 섹션(/housing) 설계

작성 2026-11-10. 승인된 설계. 구현 계획은 이 문서를 바탕으로 따로 쓴다.

## 1. 목적과 범위

보조금24 지원금만 있던 사이트에 **매일 바뀌는 공공 데이터**를 하나 더 붙인다. 청약홈(한국부동산원)의
분양 공고와 LH의 분양·임대 공고를 모아 일정·지역·유형으로 보여주고, 자세한 조건은 원문으로 보낸다.
자격 판정은 하지 않는다. 진단(`/my`)이 이미 받고 있는 지역으로 "내 지역 공고"를 이어 준다.

선택한 방향과 이유:

- 청약홈과 LH **둘 다, 얕게**. 검색 수요가 큰 청약홈과 사이트 취지(주거 지원)에 가까운 LH를 동시에
  열고, 자격 판정을 하지 않아 틀릴 위험이 없다. 유형별 소득·자산 기준은 나중에 가이드 글로 얹는다.
- `/housing` 섹션 + **진단 결과와 홈에 지역으로 거른 블록**. 분야 허브(청년·출산육아)에 유형별로
  묶어 보여주는 것은 공고 유형이 실제로 어떻게 들어오는지 본 뒤에 정한다.
- 청약홈 공고는 **상세 페이지를 만들되 noindex**. LH 공고는 API가 주는 것이 적어 목록에서 LH 원문으로
  바로 보낸다. 색인은 `/housing`과 조건을 넘긴 지역 목록만.

범위 밖(이번에 하지 않음): 소득·자산 자격 판정, 세그먼트↔공고 유형 대응표, SH·GH 등 지방공사 공고,
알림·관심 공고 저장, 공고 상세 색인과 광고, 청약 경쟁률 API(2차).

## 2. 데이터 출처

| 출처 | API | 쓰는 오퍼레이션 | 주는 것 | 안 주는 것 |
|---|---|---|---|---|
| 청약홈 | 한국부동산원 청약홈 분양정보 조회 서비스 (data.go.kr 15098547, odcloud) | `getAPTLttotPblancDetail`, `getRemndrLttotPblancDetail`, `getUrbtyOfctlLttotPblancDetail` + 주택형 `getAPTLttotPblancMdl`, `getRemndrLttotPblancMdl` | 모집공고일, 특별공급·1순위·2순위 접수일, 당첨자 발표일, 계약 기간, 입주 예정월, 공급 세대수, 주택형별 최고 분양가(만원)·일반/특별공급 세대수·특별공급 세부(신혼부부·생애최초·다자녀·노부모·기관추천·기타), 공급지역명, 주소, 사업주체, 홈페이지 주소, 투기과열·조정대상·공공주택지구·분양가상한제 여부 | 소득·자산 기준, 모집공고문 URL(홈페이지 주소로 대신), 수정 시각 |
| LH | 한국토지주택공사 분양임대공고문 조회 서비스 (data.go.kr 15058530, `apis.data.go.kr/B552555/lhLeaseNoticeInfo1`) | 목록 1개 | 공고명, 공고유형(분양주택·임대주택·주거복지·신혼희망타운), 세부유형(행복주택·국민임대 등), 지역명, 공고상태(공고중·접수중·접수마감·정정공고중), 상세 URL | 접수 기간, 자격 기준, 세대수(공고문 PDF 안에 있음), 수정 시각 |

청약홈 `RENT_SECD`(분양/임대 구분) 코드값과 LH `CNP_CD` 지역 코드표는 문서에 없다. 첫 동기화 실측으로
확정하고 `raw`에 원문을 남겨 둔다. 분양임대공고별 상세정보(15057999)·공급정보(15056765)는 공고 ID로
부르는 하위 API라 이번에는 쓰지 않는다.

## 3. 데이터 모델

### `housing_notices` — 한 행이 공고 하나

| 열 | 뜻 |
|---|---|
| `id` uuid | PK |
| `source` text | `applyhome` \| `lh` |
| `source_id` text | 청약홈 `HOUSE_MANAGE_NO`+`PBLANC_NO`, LH `PAN_ID`. `(source, source_id)` unique |
| `slug` text unique | 공고명 기반 한글 슬러그(지원금과 같은 slugify). `REGIONS`의 영문 slug는 예약어로 막는다 |
| `title` text | 공고명 |
| `kind` text | `apt`(APT 분양) \| `apt_remainder`(무순위·잔여·계약취소) \| `officetel_etc`(오피스텔·도시형·민간임대) \| `lh_sale` \| `lh_rent` \| `lh_welfare`(주거복지) \| `newlywed_town`(신혼희망타운) |
| `kind_detail` text | 원문 세부 유형명 그대로(예: 행복주택). 없으면 null |
| `region_code` text | 우리 `REGIONS` 코드. 못 맞추면 `UNKNOWN`(전국 `ALL`로 두지 않는다 — 모든 지역 필터에 섞인다) |
| `address`, `supplier` text | 공급 위치, 사업주체 |
| `total_units` int | 공급 세대수 |
| `notice_date` date | 모집공고일 |
| `special_start`, `special_end`, `rank1_start`, `rank1_end`, `rank2_start`, `rank2_end`, `winner_date`, `contract_start`, `contract_end` date | 청약홈만. LH는 전부 null |
| `move_in_ym` text | 입주 예정월(YYYYMM) |
| `status` text | `upcoming` \| `open` \| `closed` \| `removed` |
| `detail_url` text | 청약홈 홈페이지 주소 또는 LH 상세 URL |
| `raw` jsonb | 원문 전체. 디버그와 필드 승격용 |
| `content_hash` text | 원문 해시. 변경 감지용 |
| `source_updated_at`, `synced_at`, `created_at` timestamptz | |

인덱스: `status`, `region_code`, `kind`, `(rank1_start)`, `(special_start)`. RLS 공개 읽기.

상태 계산: 청약홈은 날짜로 계산한다 — 첫 접수일(특별공급 또는 1순위 중 이른 날) 전이면 `upcoming`,
마지막 접수일(2순위 종료 또는 일반 접수 종료)까지 `open`, 지나면 `closed`. LH는 원문 `PAN_SS`를 매핑한다
(공고중→`upcoming`, 접수중→`open`, 접수마감→`closed`, 정정공고중→`open` 유지, 상담요청→`open`).
원천 목록에서 사라진 행은 `removed`.

### `housing_unit_types` — 청약홈 APT·무순위의 주택형별 행

| 열 | 뜻 |
|---|---|
| `notice_id` uuid FK | `housing_notices.id`, cascade |
| `house_type` text | 주택형(예: 084.9712A) |
| `supply_area` numeric | 공급면적 |
| `max_price_manwon` int | 최고 분양가(만원) |
| `general_units`, `special_units` int | 일반·특별공급 세대수 |
| `sp_newlywed`, `sp_first_life`, `sp_multi_child`, `sp_old_parents`, `sp_institution`, `sp_etc` int | 특별공급 세부 세대수 |

PK `(notice_id, house_type)`. 상세 페이지의 표와 목록 카드의 특별공급 배지(세부 세대수 1 이상)의 근거다.

## 4. 동기화

`lib/api/applyhome.ts`, `lib/api/lh.ts`(클라이언트 + zod 스키마), `lib/sync/housing-sync.ts`,
`lib/sync/housing-repo.ts`. 보조금24 동기화(`gov24-sync.ts`)와 같은 구조: repo 인터페이스로 Supabase를
분리하고 테스트는 가짜 repo로 한다.

- **범위**: 모집공고일(청약홈) / 공고게시일(LH) 기준 최근 180일. 2년 전 마감 공고는 사이트 가치가 없고
  DB와 ISR만 키운다. LH는 유형 분양주택(05)·임대주택(06)·주거복지(13)·신혼희망타운(39)만.
- **지역 매핑**: 청약홈 `SUBSCRPT_AREA_CODE_NM`(시도명), LH `CNP_CD_NM`을 `REGIONS[].keywords`로 맞춘다.
  실패는 `UNKNOWN` + 로그.
- **변경 감지**: 원문에 수정 시각이 없으므로 정규화한 원문의 해시(`content_hash`)를 비교한다. 같으면
  skip, 다르면 upsert. 상태 전이는 날짜가 지나면 동기화 때 다시 계산해 갱신한다.
- **캐시**: 매 실행 `housing:lists`를 비우고, 바뀐 공고는 `housing:<sha1(slug) 앞 16자리>`로 한 장씩.
  바뀐 수가 100을 넘거나 실패하면 `housing:all`. 지원금과 같은 규칙(`cache-tags.ts`).
- **안전장치**: 건수가 직전 성공 대비 급감하면 중단(`aborted_reason`), 소스별로 `sync_runs`에 기록
  (`source`=`applyhome`/`lh`), 수동 실행 `scripts/sync-housing.ts`.
- **실행**: Vercel Hobby는 cron 2개가 한도이고 보조금24 2회가 이미 쓰고 있다. `/api/cron/sync-gov24`를
  `/api/cron/sync`로 일반화해 한 호출에 보조금24 → 청약홈 → LH를 차례로 돌린다. 한 소스의 실패가 다른
  소스를 막지 않고, 응답은 소스별 결과를 싣는다. `maxDuration` 60초를 위협하면 공고 동기화는 둘 중
  새벽 실행에서만 돈다. 인증은 기존 `CRON_SECRET` 그대로.

비용(추정): 180일치 공고 수백 건 + 주택형 수천 행으로 Supabase 500MB의 1% 미만. API 호출은 하루 10회
안팎이라 개발계정 한도 안이다.

## 5. 페이지

| 경로 | 내용 | 색인 | 광고 | ISR |
|---|---|---|---|---|
| `/housing` | 전국 목록. 탭 접수중·접수 예정·마감, 필터 유형·지역. 기본 접수중+예정, 마감 임박 순 | O | X | 하루 |
| `/housing/[slug]` (slug가 `REGIONS`의 영문 slug) | 지역별 목록. 그 지역 공고(접수중+예정) 5건 이상일 때만 색인 | 조건부 | X | 하루 |
| `/housing/[slug]` (그 외) | 청약홈 공고 상세: 일정(특별공급·1·2순위·당첨자 발표·계약·입주), 세대수, 주택형별 표(면적·최고가·일반/특별·특별 세부), 지역 여부(투기과열·조정대상·공공주택지구·분양가상한제), 원문 링크. LH 공고는 상세 없음(목록에서 원문으로) | X | X | 일주일 |

`[slug]` 하나로 받아 `REGIONS`에 있으면 지역 목록, 아니면 공고로 분기한다. 공고 slug가 지역 slug와
같아지는 일은 slugify의 예약어로 막는다.

**목록 카드**: 공고명, 유형 배지, 지역, 접수 기간과 D-day(`DdayBadge` 재사용, 접수 예정은 "D-n 접수
시작"), 공급 세대수, 특별공급 배지(신혼부부·생애최초·다자녀 세대수 1 이상일 때). LH 카드는 유형명·
지역·상태·원문 링크만.

**연결**:
- `/my` 하단 "내 지역 청약·임대 공고": 진단 지역으로 거른 접수중·예정 최대 4건 + `/housing/[region]`
  링크. 지역 없으면 전국 접수중 4건. 0건이면 블록 자체를 숨긴다. 상황 값은 배지로만 보인다.
- 홈 "접수 중인 청약·임대 공고" 4건 + `/housing` 링크(기존 마감 임박 섹션과 같은 카드 격자).
- 헤더·모바일 메뉴 "청약·임대"(`nav-links.ts`), `/benefits`의 "다른 방법으로 찾기"에 링크.
- 사이트맵은 `/housing`과 색인 조건을 넘긴 지역 목록만. `llms.txt`에 `/housing` 한 줄.

**색인 정책**: `index-policy.ts`에 `housingRegionIndexable({ count })`(임계값 5). 페이지 robots와
사이트맵이 같은 함수를 본다. 공고 상세는 항상 noindex로 시작하고 공고별 해설이 생기면 그때 연다.

**캐시 태그**: `housing:lists`(목록·홈·my 블록, 하루), `housing:<해시>`(상세, 일주일), `housing:all`.
D-day는 브라우저에서 다시 세므로 상세를 매일 비울 필요가 없다. 목록의 접수 예정→접수중 전환은 날짜로
계산해 보여주고 DB `status`는 동기화 때 맞춘다.

**빈 상태·오류**: 접수중 0건 지역은 "지금 접수 중인 공고가 없습니다. 접수 예정 n건"으로 섹션을 유지한다.
Supabase 실패는 `/housing` 전용 `error.tsx`.

## 6. 테스트

- 파싱: 청약홈·LH 응답을 fixtures로 저장(`scripts/capture-fixtures.ts` 방식)해 zod 스키마, 날짜 형식
  (`20260115` / `2026.01.15`), 지역 매핑(실패→`UNKNOWN`), 상태 계산, slug 예약어 충돌을 단위 테스트.
- 동기화: 가짜 repo로 해시 같으면 skip, 상태 전이, 건수 급감 중단, 소스 하나 실패 시 다른 소스 계속,
  캐시 태그 호출 집합. `gov24-sync.test.ts` 구조를 따른다.
- cron: 통합 `/api/cron/sync`가 소스별 결과를 싣고 기존 보조금24 테스트가 그대로 통과.
- 색인·광고: `index-policy.test.ts`에 `housingRegionIndexable`, `sitemap-entries.test.ts`에 지역 목록
  조건. `adsense-scope.test.ts`는 허용 목록 방식이라 새 페이지가 자동으로 광고 없음 검사를 받는다.
- 화면: 카드·배지(특별공급 배지 조건, LH 카드는 원문 링크만), `/my` 블록(지역 없으면 전국, 0건이면 숨김).

## 7. 배포 순서

각 단계가 독립적으로 배포 가능하다.

1. 마이그레이션 `006_housing.sql`(테이블·인덱스·RLS) + API 클라이언트 + 동기화 모듈 + 수동 스크립트.
   키가 나오면 로컬에서 한 번 돌려 데이터 모양(유형 코드값, 지역명)을 실측하고 매핑을 확정.
2. cron 통합(`/api/cron/sync`)과 `vercel.json` 경로 변경. 운영 응답으로 보조금24 동작 불변 확인.
3. `/housing` 목록·지역·상세, 캐시 태그, 색인 정책, 사이트맵.
4. 홈·`/my` 블록, 헤더 메뉴, README.

## 8. 열어 둔 가정

- 청약홈 `RENT_SECD` 코드값, LH `CNP_CD` 코드표: 첫 동기화 실측으로 확정.
- 개발계정 일 호출 한도: 활용신청 화면에서 확인. 하루 10회 안팎이라 어느 한도든 넉넉할 것으로 본다(추정).
- 통합 cron의 소요 시간: 실측 후 공고 동기화를 새벽 1회로 줄일지 결정.

## 변경 (2026-11-11)

- 유형별 공통 신청 자격 안내를 상세와 카드에 붙였다. 두 API에 자격 본문이 없어(공고문 PDF에만 있다) 공고가 아니라 유형 단위로 법령·지침을 검수해 싣는다. 근거: `docs/research/2026-11-11-housing-eligibility-*.md`.
- 그래서 LH 공고도 상세 페이지를 연다(카드가 원문이 아니라 상세로 간다). 위 표의 "LH 공고는 상세 없음"은 이 변경으로 바뀌었다. 상세는 여전히 noindex.
- 청약홈 규제 표시(투기과열지구·청약과열지역·분양가상한제 등)를 신청자에게 미치는 영향과 함께 보여준다.
