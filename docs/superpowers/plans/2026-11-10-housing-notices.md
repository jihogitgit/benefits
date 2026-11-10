# 청약·임대 공고 섹션(/housing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 청약홈(한국부동산원)과 LH의 분양·임대 공고를 매일 동기화해 `/housing` 목록·지역별 목록·공고 상세로 보여주고, 홈과 진단 결과(`/my`)에 사용자의 지역으로 거른 공고를 붙인다.

**Architecture:** 보조금24 동기화와 같은 3층 구조다 — zod 스키마를 가진 API 클라이언트(`lib/api/applyhome.ts`, `lib/api/lh.ts`) → 정규화·해시·상태 계산(`lib/sync/housing-normalize.ts`) → repo 인터페이스 뒤의 Supabase(`lib/sync/housing-repo.ts`)를 `lib/sync/housing-sync.ts`가 조율한다. 기존 cron 라우트를 `/api/cron/sync`로 일반화해 보조금24 → 청약홈 → LH를 한 호출에 돌리고, 조회는 `lib/housing/queries.ts`가 `unstable_cache`에 `housing:*` 태그를 달아 제공한다. 공고 상세는 noindex·광고 없음.

**Tech Stack:** Next.js 15.5 App Router, React 19, Supabase(Postgres), zod, vitest + testing-library, Node 22 (`source ~/.nvm/nvm.sh && nvm use 22`), tsx 스크립트.

**설계 문서:** `docs/superpowers/specs/2026-11-10-housing-notices-design.md`. 이 계획은 그 문서의 결정을 바꾸지 않는다.

**실행 전 준비:** `.env.local`에 `HOUSING_API_KEY`(공공데이터포털 일반 인증키 Decoding)가 있어야 Task 3·4의 실측 단계와 Task 13의 수동 동기화가 돈다. 같은 계정이면 `GOV24_API_KEY`와 같은 값이다 — 코드는 `HOUSING_API_KEY`가 없으면 `GOV24_API_KEY`로 떨어진다. 키가 아직 없으면 실측 단계만 건너뛰고 나머지는 단위 테스트로 진행한다(실측 단계는 "키 있을 때"로 표시).

**모든 명령은 저장소 루트(`/Users/mw/prodect/benefits`)에서, Node 22로:** `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`. `next build`와 `next dev`는 `.next`를 공유하므로 같이 돌리지 않는다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/006_housing.sql` | `housing_notices`, `housing_unit_types` 테이블·인덱스·RLS |
| `src/types/housing.ts` | 공고·주택형 행 타입, 종류·상태 enum |
| `src/lib/api/applyhome-schema.ts` | 청약홈(odcloud) 응답 zod 스키마 5개 오퍼레이션 |
| `src/lib/api/applyhome.ts` | 청약홈 호출(상세 3종 전체 + 주택형 공고별), 키·페이지 처리 |
| `src/lib/api/lh-schema.ts` | LH 공고문 응답 zod 스키마(배열 래퍼 허용) |
| `src/lib/api/lh.ts` | LH 호출(유형 4종, 페이지 처리) |
| `src/lib/sync/housing-types.ts` | `HousingRepo` 인터페이스, 동기화 결과 타입 |
| `src/lib/sync/housing-normalize.ts` | 날짜·지역·종류·상태·해시·슬러그 예약어 — 순수 함수 |
| `src/lib/sync/housing-repo.ts` | `HousingRepo`의 Supabase 구현 |
| `src/lib/sync/housing-sync.ts` | 소스별 독립 실행, 변경 감지, 주택형은 바뀐 공고만 |
| `src/lib/cache-tags.ts` | `housing:lists`·`housing:all`·`housing:<해시>` 추가 |
| `src/app/api/cron/sync/route.ts` | 보조금24 + 공고 통합 cron (기존 `sync-gov24` 라우트 대체) |
| `src/lib/housing/queries.ts` | 목록·지역 집계·상세 조회(`unstable_cache`) |
| `src/lib/housing/labels.ts` | 종류·상태 한글 라벨 |
| `src/lib/seo/index-policy.ts` | `housingRegionIndexable` |
| `src/lib/seo/sitemap-entries.ts` | `housingEntries` |
| `src/components/housing/HousingCard.tsx` 외 | 카드·목록·일정표·주택형표·내 지역 블록 |
| `src/app/(site)/housing/page.tsx`, `[slug]/page.tsx`, `error.tsx` | 목록·지역/상세 분기·오류 화면 |
| `scripts/sync-housing.ts`, `scripts/capture-housing-fixtures.ts` | 수동 동기화, 샘플 응답 저장 |

---

### Task 1: 마이그레이션과 타입

**Files:**
- Create: `supabase/migrations/006_housing.sql`
- Create: `src/types/housing.ts`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 청약홈(한국부동산원)·LH 분양임대 공고. 설계: docs/superpowers/specs/2026-11-10-housing-notices-design.md
--
-- 지원금(benefits)과 테이블을 나눈다. 공고는 접수 일정 6종·주택형별 가격·공고 상태를 가져
-- benefits에 넣으면 열 절반이 비고 검색·진단에 분기가 생긴다. 지역 코드(region_code)는
-- benefits와 같은 체계(data/regions.ts의 slug, 전국은 'ALL')를 쓰되, 매핑 실패는 'UNKNOWN'으로
-- 둔다 — 'ALL'로 두면 모든 지역 필터에 섞인다.
create table housing_notices (
  id uuid primary key default uuid_generate_v4(),
  source text not null check (source in ('applyhome','lh')),
  source_id text not null,
  slug text unique not null,
  title text not null,
  kind text not null check (kind in ('apt','apt_remainder','officetel_etc','lh_sale','lh_rent','lh_welfare','newlywed_town')),
  kind_detail text,
  region_code text not null default 'UNKNOWN',
  address text,
  supplier text,
  total_units int,
  notice_date date,
  special_start date,
  special_end date,
  rank1_start date,
  rank1_end date,
  rank2_start date,
  rank2_end date,
  winner_date date,
  contract_start date,
  contract_end date,
  move_in_ym text,
  -- 접수 전체 구간. 일정 6종 중 가장 이른 시작과 가장 늦은 종료. 목록 정렬·D-day·상태 계산이 이것만 본다.
  receipt_start date,
  receipt_end date,
  -- 주택형별 특별공급 세대수 합계. 목록 카드의 배지 근거(주택형 테이블을 조인하지 않기 위해 비정규화).
  sp_newlywed_units int not null default 0,
  sp_first_life_units int not null default 0,
  sp_multi_child_units int not null default 0,
  status text not null default 'open' check (status in ('upcoming','open','closed','removed')),
  detail_url text,
  raw jsonb not null default '{}'::jsonb,
  content_hash text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index housing_notices_status_idx on housing_notices (status);
create index housing_notices_region_idx on housing_notices (region_code);
create index housing_notices_kind_idx on housing_notices (kind);
create index housing_notices_receipt_end_idx on housing_notices (receipt_end);

-- 청약홈 APT·무순위 공고의 주택형별 행. LH는 없다.
create table housing_unit_types (
  notice_id uuid not null references housing_notices(id) on delete cascade,
  house_type text not null,
  supply_area numeric,
  max_price_manwon int,
  general_units int,
  special_units int,
  sp_newlywed int,
  sp_first_life int,
  sp_multi_child int,
  sp_old_parents int,
  sp_institution int,
  sp_etc int,
  primary key (notice_id, house_type)
);

alter table housing_notices enable row level security;
alter table housing_unit_types enable row level security;
create policy "public read housing_notices" on housing_notices for select using (true);
create policy "public read housing_unit_types" on housing_unit_types for select using (true);

comment on column housing_notices.region_code is 'data/regions.ts의 slug. 전국 ALL, 매핑 실패 UNKNOWN';
comment on column housing_notices.content_hash is '원문 항목의 안정 해시. 원천에 수정 시각이 없어 이것으로 변경을 감지한다';
```

- [ ] **Step 2: Supabase에 적용**

Supabase 대시보드 → SQL Editor에 위 파일 내용을 붙여 실행한다(README "개발" 절과 같은 방식). 성공하면 Table Editor에 `housing_notices`, `housing_unit_types`가 보인다.

- [ ] **Step 3: 타입 작성**

```ts
// src/types/housing.ts
export type HousingSource = 'applyhome' | 'lh'

/**
 * 공고 종류. 청약홈은 오퍼레이션·주택구분으로, LH는 공고유형코드(UPP_AIS_TP_CD)로 정한다.
 * 신혼희망타운은 두 출처 모두에서 올 수 있어 하나로 모은다.
 */
export type HousingKind = 'apt' | 'apt_remainder' | 'officetel_etc' | 'lh_sale' | 'lh_rent' | 'lh_welfare' | 'newlywed_town'

export type HousingStatus = 'upcoming' | 'open' | 'closed' | 'removed'

/** 지역 매핑 실패. 'ALL'(전국)과 구별한다 — ALL로 두면 모든 지역 필터에 섞인다. */
export const HOUSING_REGION_UNKNOWN = 'UNKNOWN'

export interface HousingNoticeRow {
  source: HousingSource
  source_id: string
  slug: string
  title: string
  kind: HousingKind
  kind_detail: string | null
  region_code: string
  address: string | null
  supplier: string | null
  total_units: number | null
  notice_date: string | null // YYYY-MM-DD
  special_start: string | null
  special_end: string | null
  rank1_start: string | null
  rank1_end: string | null
  rank2_start: string | null
  rank2_end: string | null
  winner_date: string | null
  contract_start: string | null
  contract_end: string | null
  move_in_ym: string | null // YYYYMM
  receipt_start: string | null
  receipt_end: string | null
  sp_newlywed_units: number
  sp_first_life_units: number
  sp_multi_child_units: number
  status: HousingStatus
  detail_url: string | null
  raw: unknown
  content_hash: string
  synced_at: string
}

export interface HousingUnitTypeInput {
  house_type: string
  supply_area: number | null
  max_price_manwon: number | null
  general_units: number | null
  special_units: number | null
  sp_newlywed: number | null
  sp_first_life: number | null
  sp_multi_child: number | null
  sp_old_parents: number | null
  sp_institution: number | null
  sp_etc: number | null
}

export interface HousingUnitTypeRow extends HousingUnitTypeInput {
  notice_id: string
}
```

- [ ] **Step 4: 타입 검사와 커밋**

Run: `npx tsc --noEmit`
Expected: 출력 없음(성공)

```bash
git add supabase/migrations/006_housing.sql src/types/housing.ts
git commit -m "housing: 공고·주택형 테이블과 타입"
```

---

### Task 2: 캐시 태그 확장

**Files:**
- Modify: `src/lib/cache-tags.ts`
- Modify: `src/lib/__tests__/cache-tags.test.ts`
- Modify: `src/app/api/revalidate/route.ts:57`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/__tests__/cache-tags.test.ts` 끝에 추가:

```ts
import { housingTag, CACHE_TAGS as TAGS, isCacheTag as isTag } from '../cache-tags'

describe('housing 태그', () => {
  it('목록·전체 태그가 고정 목록에 있다', () => {
    expect(TAGS.housingLists).toBe('housing:lists')
    expect(TAGS.housingAll).toBe('housing:all')
    expect(isTag('housing:lists')).toBe(true)
  })

  // 한글 슬러그를 헤더(x-next-cache-tags)에 그대로 실으면 Vercel에서 500이 난다(benefitTag 주석).
  it('공고 태그는 해시이고 isCacheTag가 받아들인다', () => {
    const t = housingTag('래미안-원베일리')
    expect(t).toMatch(/^housing:[0-9a-f]{16}$/)
    expect(isTag(t)).toBe(true)
    expect(housingTag('래미안-원베일리')).toBe(t)
    expect(() => housingTag('a b')).toThrow()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/cache-tags.test.ts`
Expected: FAIL — `housingTag`가 export되지 않음

- [ ] **Step 3: 구현**

`src/lib/cache-tags.ts`의 `CACHE_TAGS`에 두 줄, 타입·정규식·함수 추가:

```ts
export const CACHE_TAGS = {
  benefitsAll: 'benefits:all',
  benefitsLists: 'benefits:lists',
  benefitsHome: 'benefits:home',
  guides: 'guides',
  regions: 'regions',
  /** 공고 목록·지역 집계·홈/my 블록. 동기화가 매번 비운다. */
  housingLists: 'housing:lists',
  /** 공고 상세 전부. 대량 변경·실패 시에만. */
  housingAll: 'housing:all',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS] | `benefit:${string}` | `housing:${string}`
```

`BENEFIT_TAG_RE` 아래에:

```ts
/** 공고 상세 한 장. benefitTag와 같은 이유로 해시한다. */
export const HOUSING_TAG_PREFIX = 'housing:'
const HOUSING_TAG_RE = /^housing:[0-9a-f]{16}$/

export function housingTag(slug: string): CacheTag {
  if (!isSlugLike(slug)) throw new Error(`슬러그가 아니다: ${slug}`)
  return `${HOUSING_TAG_PREFIX}${createHash('sha1').update(slug).digest('hex').slice(0, 16)}`
}
```

`isCacheTag` 마지막 줄을:

```ts
  return BENEFIT_TAG_RE.test(v) || HOUSING_TAG_RE.test(v)
```

`src/app/api/revalidate/route.ts:57`의 `valid` 배열에 항목 추가:

```ts
  if (unknownTags.length) return bad('알 수 없는 태그', { unknown: unknownTags, valid: [...ALL_CACHE_TAGS, 'benefit:<sha1(slug) 앞 16자리 — scripts/revalidate.ts가 만든다>', 'housing:<sha1(slug) 앞 16자리>'] })
```

- [ ] **Step 4: 통과 확인과 커밋**

Run: `npx vitest run src/lib/__tests__/cache-tags.test.ts src/app/api/__tests__`
Expected: PASS (기존 cache-tags 테스트에 `CACHE_TAGS` 고정 객체 비교가 있으면 `housingLists`·`housingAll`을 기대값에 추가한다)

```bash
git add src/lib/cache-tags.ts src/lib/__tests__/cache-tags.test.ts src/app/api/revalidate/route.ts
git commit -m "housing: 캐시 태그 추가"
```

---

### Task 3: 청약홈 API 클라이언트

**Files:**
- Create: `src/lib/api/applyhome-schema.ts`
- Create: `src/lib/api/applyhome.ts`
- Create: `src/lib/api/__tests__/applyhome-schema.test.ts`
- Create: `scripts/capture-housing-fixtures.ts`

청약홈 API는 odcloud(`https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/<op>`)다. 보조금24와 같은 래퍼(`totalCount`·`data`)를 쓰고 검색 조건은 `cond[필드::GTE]=값` 형식이다. 필드명은 공공데이터포털 15098547 문서 기준이며, 날짜 표기(`2026-01-15` / `20260115`)는 실측으로 확정한다 — 그래서 스키마는 모든 값을 문자열로 받고 정규화는 Task 5가 한다.

- [ ] **Step 1: 실패하는 스키마 테스트**

```ts
// src/lib/api/__tests__/applyhome-schema.test.ts
import { describe, it, expect } from 'vitest'
import { aptDetailResponse, aptMdlResponse, urbtyDetailResponse } from '../applyhome-schema'

const envelope = (data: unknown[]) => ({ currentCount: data.length, matchCount: data.length, page: 1, perPage: 10, totalCount: data.length, data })

describe('청약홈 스키마', () => {
  it('APT 상세는 식별자 두 개가 필수이고 나머지는 비어도 된다', () => {
    const r = aptDetailResponse.parse(envelope([{ HOUSE_MANAGE_NO: 2026000001, PBLANC_NO: 2026000001, HOUSE_NM: '래미안 테스트', RCEPT_BGNDE: '2026-01-15', TOT_SUPLY_HSHLDCO: '320', SUBSCRPT_AREA_CODE_NM: '서울' }]))
    const item = r.data[0]
    expect(item.HOUSE_MANAGE_NO).toBe('2026000001') // 숫자가 와도 문자열로
    expect(item.TOT_SUPLY_HSHLDCO).toBe('320')
    expect(item.RCRIT_PBLANC_DE).toBeNull()
  })

  it('식별자가 없으면 거부한다', () => {
    expect(() => aptDetailResponse.parse(envelope([{ HOUSE_NM: '이름만' }]))).toThrow()
  })

  it('주택형 행은 특별공급 세부 세대수를 문자열로 받는다', () => {
    const r = aptMdlResponse.parse(envelope([{ HOUSE_MANAGE_NO: '1', PBLANC_NO: '1', HOUSE_TY: '084.9712A', SUPLY_AR: '84.97', LTTOT_TOP_AMOUNT: '98000', SUPLY_HSHLDCO: 100, SPSPLY_HSHLDCO: 50, NWWDS_HSHLDCO: 20 }]))
    expect(r.data[0].NWWDS_HSHLDCO).toBe('20')
    expect(r.data[0].LFE_FRST_HSHLDCO).toBeNull()
  })

  it('오피스텔 상세는 일반 접수일 필드를 쓴다', () => {
    const r = urbtyDetailResponse.parse(envelope([{ HOUSE_MANAGE_NO: '2', PBLANC_NO: '2', SUBSCRPT_RCEPT_BGNDE: '2026-02-01', SUBSCRPT_RCEPT_ENDDE: '2026-02-03' }]))
    expect(r.data[0].SUBSCRPT_RCEPT_BGNDE).toBe('2026-02-01')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/api/__tests__/applyhome-schema.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 스키마 작성**

```ts
// src/lib/api/applyhome-schema.ts
import { z } from 'zod'
import { odcloudEnvelope } from './gov24-schema'

/**
 * 청약홈 분양정보 조회 서비스(공공데이터포털 15098547, odcloud).
 * 값은 전부 문자열로 받고 정규화(날짜·숫자)는 sync/housing-normalize.ts가 한다 — 날짜 표기가
 * 문서에 없어 실측 전까지 형식을 고정하지 않는다. 숫자가 와도 문자열로 바꾼다(보조금24와 같은 str).
 */
const str = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => (v == null ? null : String(v).trim() || null))

const id = z.union([z.string(), z.number()]).transform((v) => String(v).trim())

const common = {
  HOUSE_MANAGE_NO: id, // 주택관리번호
  PBLANC_NO: id, // 공고번호
  HOUSE_NM: str, // 주택명
  HOUSE_SECD: str, // 주택구분코드
  HOUSE_SECD_NM: str,
  HOUSE_DTL_SECD: str, // 주택상세구분코드
  HOUSE_DTL_SECD_NM: str,
  RENT_SECD: str, // 분양/임대 구분
  RENT_SECD_NM: str,
  SUBSCRPT_AREA_CODE: str,
  SUBSCRPT_AREA_CODE_NM: str, // 공급지역명(시도)
  HSSPLY_ZIP: str,
  HSSPLY_ADRES: str, // 공급위치
  TOT_SUPLY_HSHLDCO: str, // 공급규모(세대)
  RCRIT_PBLANC_DE: str, // 모집공고일
  PRZWNER_PRESNATN_DE: str, // 당첨자발표일
  CNTRCT_CNCLS_BGNDE: str, // 계약 시작
  CNTRCT_CNCLS_ENDDE: str,
  MVN_PREARNGE_YM: str, // 입주예정월
  BSNS_MBY_NM: str, // 사업주체
  CNSTRCT_ENTRPS_NM: str, // 시공사
  MDHS_TELNO: str,
  HMPG_ADRES: str, // 홈페이지
  PBLANC_URL: str, // 문서에는 없으나 일부 응답에 있다는 보고가 있어 받아 둔다
  SPECLT_RDN_EARTH_AT: str, // 투기과열지구
  MDAT_TRGET_AREA_SECD: str, // 조정대상지역
  PARCPRC_ULS_AT: str, // 분양가상한제
  PUBLIC_HOUSE_EARTH_AT: str, // 공공주택지구
  LRSCL_BLDLND_AT: str, // 대규모택지
  NPLN_PRVOPR_PUBLIC_HOUSE_AT: str,
  IMPRMN_BSNS_AT: str, // 정비사업
}

/** getAPTLttotPblancDetail — APT(민간사전청약·신혼희망타운 포함) */
export const aptDetailItem = z
  .object({
    ...common,
    SPSPLY_RCEPT_BGNDE: str, // 특별공급 접수
    SPSPLY_RCEPT_ENDDE: str,
    RCEPT_BGNDE: str, // 청약접수(전체)
    RCEPT_ENDDE: str,
    GNRL_RNK1_CRSPAREA_RCEPT_PD: str, // 1순위 해당지역 '2026-01-15 ~ 2026-01-15'
    GNRL_RNK1_ETC_GG_RCPTDE_PD: str,
    GNRL_RNK1_ETC_AREA_RCPTDE_PD: str,
    GNRL_RNK2_CRSPAREA_RCEPT_PD: str,
    GNRL_RNK2_ETC_GG_RCPTDE_PD: str,
    GNRL_RNK2_ETC_AREA_RCPTDE_PD: str,
  })
  .passthrough()
export type AptDetailItem = z.infer<typeof aptDetailItem>

/** getRemndrLttotPblancDetail — 무순위·잔여세대·계약취소 */
export const remainderDetailItem = z
  .object({
    ...common,
    SPSPLY_RCEPT_BGNDE: str,
    SPSPLY_RCEPT_ENDDE: str,
    GNRL_RCEPT_BGNDE: str, // 일반공급 접수
    GNRL_RCEPT_ENDDE: str,
    SUBSCRPT_RCEPT_BGNDE: str,
    SUBSCRPT_RCEPT_ENDDE: str,
  })
  .passthrough()
export type RemainderDetailItem = z.infer<typeof remainderDetailItem>

/** getUrbtyOfctlLttotPblancDetail — 오피스텔·도시형·민간임대·공공지원민간임대 */
export const urbtyDetailItem = z
  .object({
    ...common,
    SEARCH_HOUSE_SECD: str,
    SUBSCRPT_RCEPT_BGNDE: str,
    SUBSCRPT_RCEPT_ENDDE: str,
  })
  .passthrough()
export type UrbtyDetailItem = z.infer<typeof urbtyDetailItem>

/** getAPTLttotPblancMdl / getRemndrLttotPblancMdl — 주택형별 */
export const mdlItem = z
  .object({
    HOUSE_MANAGE_NO: id,
    PBLANC_NO: id,
    MODEL_NO: str,
    HOUSE_TY: str, // 주택형
    SUPLY_AR: str, // 공급면적
    LTTOT_TOP_AMOUNT: str, // 분양최고금액(만원)
    SUPLY_HSHLDCO: str, // 일반공급 세대수
    SPSPLY_HSHLDCO: str, // 특별공급 세대수
    NWWDS_HSHLDCO: str, // 신혼부부
    LFE_FRST_HSHLDCO: str, // 생애최초
    MNYCH_HSHLDCO: str, // 다자녀
    OLD_PARNTS_SUPORT_HSHLDCO: str, // 노부모부양
    INSTT_RECOMEND_HSHLDCO: str, // 기관추천
    TRANSR_INSTT_ENFSN_HSHLDCO: str, // 이전기관
    ETC_HSHLDCO: str,
  })
  .passthrough()
export type MdlItem = z.infer<typeof mdlItem>

export const aptDetailResponse = odcloudEnvelope(aptDetailItem)
export const remainderDetailResponse = odcloudEnvelope(remainderDetailItem)
export const urbtyDetailResponse = odcloudEnvelope(urbtyDetailItem)
export const aptMdlResponse = odcloudEnvelope(mdlItem)
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/api/__tests__/applyhome-schema.test.ts`
Expected: PASS 4건

- [ ] **Step 5: 클라이언트 작성**

```ts
// src/lib/api/applyhome.ts
import { z } from 'zod'
import {
  aptDetailResponse,
  remainderDetailResponse,
  urbtyDetailResponse,
  aptMdlResponse,
  type AptDetailItem,
  type RemainderDetailItem,
  type UrbtyDetailItem,
  type MdlItem,
} from './applyhome-schema'

const BASE_URL = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1'

export type ApplyhomeDetailOp = 'getAPTLttotPblancDetail' | 'getRemndrLttotPblancDetail' | 'getUrbtyOfctlLttotPblancDetail'
export type ApplyhomeMdlOp = 'getAPTLttotPblancMdl' | 'getRemndrLttotPblancMdl'

/** 공공데이터포털 인증키는 계정 단위라 보조금24 키와 같은 값인 경우가 대부분이다. 따로 두면 그것을 우선한다. */
export function housingApiKey(): string {
  const key = process.env.HOUSING_API_KEY?.trim() || process.env.GOV24_API_KEY?.trim()
  if (!key) throw new Error('HOUSING_API_KEY(또는 GOV24_API_KEY) 환경변수가 없습니다')
  return key
}

const SCHEMA: Record<ApplyhomeDetailOp | ApplyhomeMdlOp, z.ZodTypeAny> = {
  getAPTLttotPblancDetail: aptDetailResponse,
  getRemndrLttotPblancDetail: remainderDetailResponse,
  getUrbtyOfctlLttotPblancDetail: urbtyDetailResponse,
  getAPTLttotPblancMdl: aptMdlResponse,
  getRemndrLttotPblancMdl: aptMdlResponse,
}

interface Page<T> { data: T[]; totalCount: number }

async function fetchPage<T>(op: ApplyhomeDetailOp | ApplyhomeMdlOp, page: number, perPage: number, cond: Record<string, string>): Promise<Page<T>> {
  const url = new URL(`${BASE_URL}/${op}`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', housingApiKey())
  // odcloud 검색 조건: cond[필드::연산자]=값. 연산자는 EQ·GT·GTE·LT·LTE·LIKE.
  for (const [k, v] of Object.entries(cond)) url.searchParams.set(`cond[${k}]`, v)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`applyhome ${op} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const parsed = SCHEMA[op].parse(await res.json()) as { data: T[]; totalCount: number }
  return { data: parsed.data, totalCount: parsed.totalCount }
}

export interface ApplyhomeFetchOptions {
  perPage?: number
  delayMs?: number
  onPage?: (op: string, page: number, totalPages: number) => void
}

async function fetchAll<T>(op: ApplyhomeDetailOp | ApplyhomeMdlOp, cond: Record<string, string>, opts: ApplyhomeFetchOptions): Promise<T[]> {
  const perPage = opts.perPage ?? 500
  const delayMs = opts.delayMs ?? 300
  const all: T[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const r = await fetchPage<T>(op, page, perPage, cond)
    totalPages = Math.max(1, Math.ceil(r.totalCount / perPage))
    all.push(...r.data)
    opts.onPage?.(op, page, totalPages)
    page++
    if (page <= totalPages && delayMs > 0) await new Promise((res) => setTimeout(res, delayMs))
  }
  return all
}

export interface ApplyhomeDetails {
  apt: AptDetailItem[]
  remainder: RemainderDetailItem[]
  urbty: UrbtyDetailItem[]
}

/** 모집공고일이 since(YYYY-MM-DD) 이후인 공고 3종. 과거 전체를 받지 않는다(설계 4절). */
export async function fetchApplyhomeDetails(since: string, opts: ApplyhomeFetchOptions = {}): Promise<ApplyhomeDetails> {
  const cond = { 'RCRIT_PBLANC_DE::GTE': since }
  const [apt, remainder, urbty] = await Promise.all([
    fetchAll<AptDetailItem>('getAPTLttotPblancDetail', cond, opts),
    fetchAll<RemainderDetailItem>('getRemndrLttotPblancDetail', cond, opts),
    fetchAll<UrbtyDetailItem>('getUrbtyOfctlLttotPblancDetail', cond, opts),
  ])
  return { apt, remainder, urbty }
}

/**
 * 공고 하나의 주택형 행. 바뀐 공고에 대해서만 부른다 — 전체 주택형을 매일 받으면 수만 행이고,
 * 공고마다 부르면 첫 적재 때만 수백 번이다(이후 하루 몇 번).
 */
export async function fetchApplyhomeUnits(kind: 'apt' | 'remainder', houseManageNo: string, pblancNo: string, opts: ApplyhomeFetchOptions = {}): Promise<MdlItem[]> {
  const op: ApplyhomeMdlOp = kind === 'apt' ? 'getAPTLttotPblancMdl' : 'getRemndrLttotPblancMdl'
  return fetchAll<MdlItem>(op, { 'HOUSE_MANAGE_NO::EQ': houseManageNo, 'PBLANC_NO::EQ': pblancNo }, { ...opts, perPage: 100 })
}
```

- [ ] **Step 6: 샘플 응답 저장 스크립트(키 있을 때)**

```ts
// scripts/capture-housing-fixtures.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { housingApiKey } from '../src/lib/api/applyhome'

/**
 * 청약홈·LH 샘플 응답을 fixtures/housing/에 저장한다. 두 API 모두 문서에 날짜 표기와 코드값이
 * 없어, 스키마·정규화는 이 파일을 보고 확정한다. 저장소에 커밋한다(개인정보 없음 — 공고 공개 정보).
 */
const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
const key = housingApiKey()

async function applyhome(op: string, cond: Record<string, string>) {
  const url = new URL(`https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/${op}`)
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', '5')
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', key)
  for (const [k, v] of Object.entries(cond)) url.searchParams.set(`cond[${k}]`, v)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${op} ${res.status} ${await res.text()}`)
  const json = await res.json()
  writeFileSync(`fixtures/housing/${op}.sample.json`, JSON.stringify(json, null, 2))
  console.log(`${op}: totalCount=${json.totalCount}, keys=${Object.keys(json.data?.[0] ?? {}).join(', ')}`)
  return json
}

async function lh(uppAisTpCd: string) {
  const url = new URL('https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1')
  url.searchParams.set('serviceKey', key)
  url.searchParams.set('PG_SZ', '5')
  url.searchParams.set('PAGE', '1')
  url.searchParams.set('UPP_AIS_TP_CD', uppAisTpCd)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`lh ${uppAisTpCd} ${res.status} ${await res.text()}`)
  const text = await res.text()
  writeFileSync(`fixtures/housing/lh-${uppAisTpCd}.sample.json`, text)
  console.log(`lh ${uppAisTpCd}: ${text.slice(0, 300)}`)
}

async function main() {
  mkdirSync('fixtures/housing', { recursive: true })
  const apt = await applyhome('getAPTLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': since })
  await applyhome('getRemndrLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': since })
  await applyhome('getUrbtyOfctlLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': since })
  const first = apt.data?.[0]
  if (first) await applyhome('getAPTLttotPblancMdl', { 'HOUSE_MANAGE_NO::EQ': String(first.HOUSE_MANAGE_NO), 'PBLANC_NO::EQ': String(first.PBLANC_NO) })
  for (const cd of ['05', '06', '13', '39']) await lh(cd)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

`package.json`의 `scripts`에 추가:

```json
    "fixtures:housing": "tsx --env-file=.env.local scripts/capture-housing-fixtures.ts",
```

Run: `npm run fixtures:housing`
Expected: `fixtures/housing/`에 파일 8개. 콘솔의 `keys=`에 `RCRIT_PBLANC_DE`, `RCEPT_BGNDE`가 보인다. 날짜 값이 `2026-01-15` 또는 `20260115` 중 어느 형식인지 메모한다(Task 5의 `toIsoDate`는 둘 다 받는다). LH 출력은 `[{"resHeader":[...]},{"dsList":[...]}]` 또는 `{"dsList":[...]}` 모양이다 — Task 4의 파서가 둘 다 받는다.

만약 `cond[RCRIT_PBLANC_DE::GTE]`가 400을 내면 odcloud가 그 필드의 조건 검색을 지원하지 않는 것이다. 그때는 `fetchApplyhomeDetails`에서 cond를 빼고 전체를 받은 뒤 `RCRIT_PBLANC_DE >= since`로 코드에서 거른다(아래 Step 7의 대체 코드).

- [ ] **Step 7 (조건 검색이 안 될 때만): 코드에서 거르기**

`fetchApplyhomeDetails`를 다음으로 바꾼다:

```ts
export async function fetchApplyhomeDetails(since: string, opts: ApplyhomeFetchOptions = {}): Promise<ApplyhomeDetails> {
  const keep = <T extends { RCRIT_PBLANC_DE: string | null }>(rows: T[]) =>
    rows.filter((r) => (r.RCRIT_PBLANC_DE ?? '').replace(/[.-]/g, '').slice(0, 8) >= since.replace(/-/g, ''))
  const [apt, remainder, urbty] = await Promise.all([
    fetchAll<AptDetailItem>('getAPTLttotPblancDetail', {}, opts),
    fetchAll<RemainderDetailItem>('getRemndrLttotPblancDetail', {}, opts),
    fetchAll<UrbtyDetailItem>('getUrbtyOfctlLttotPblancDetail', {}, opts),
  ])
  return { apt: keep(apt), remainder: keep(remainder), urbty: keep(urbty) }
}
```

- [ ] **Step 8: 타입·린트·커밋**

Run: `npx tsc --noEmit && npx eslint src/lib/api scripts/capture-housing-fixtures.ts`
Expected: 출력 없음

```bash
git add src/lib/api/applyhome-schema.ts src/lib/api/applyhome.ts src/lib/api/__tests__/applyhome-schema.test.ts scripts/capture-housing-fixtures.ts package.json fixtures/housing
git commit -m "housing: 청약홈 API 클라이언트와 샘플 응답"
```

---

### Task 4: LH API 클라이언트

**Files:**
- Create: `src/lib/api/lh-schema.ts`
- Create: `src/lib/api/lh.ts`
- Create: `src/lib/api/__tests__/lh-schema.test.ts`

LH(`apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1`)는 odcloud가 아니라 다른 래퍼를 쓴다. LH 계열 API는 `[{"resHeader":[{"SS_CODE":"Y",...}]},{"dsList":[...]}]`처럼 **배열**로 돌려주는 것으로 알려져 있고, 문서에는 `dsList` 객체로도 적혀 있어 파서가 둘 다 받는다. 응답 항목은 공고 ID·공고명·유형·세부유형·지역명·상태·상세URL·전체건수(`ALL_CNT`)다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/api/__tests__/lh-schema.test.ts
import { describe, it, expect } from 'vitest'
import { parseLhList } from '../lh-schema'

const row = { PAN_ID: '2026000123', PAN_NM: '행복주택 입주자 모집', UPP_AIS_TP_NM: '임대주택', AIS_TP_CD_NM: '행복주택', CNP_CD_NM: '서울특별시', PAN_SS: '접수중', DTL_URL: 'https://apply.lh.or.kr/x', ALL_CNT: '37', RNUM: '1' }

describe('LH 공고문 응답 파서', () => {
  it('배열 래퍼([resHeader, dsList])를 받는다', () => {
    const r = parseLhList([{ resHeader: [{ SS_CODE: 'Y', RS_DTTM: '20260110' }] }, { dsList: [row] }])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].PAN_ID).toBe('2026000123')
    expect(r.total).toBe(37)
  })

  it('객체 래퍼({dsList})도 받는다', () => {
    const r = parseLhList({ dsList: [row] })
    expect(r.items[0].AIS_TP_CD_NM).toBe('행복주택')
  })

  it('dsList가 없으면 빈 목록이다(마지막 페이지 뒤)', () => {
    expect(parseLhList([{ resHeader: [{ SS_CODE: 'Y' }] }]).items).toEqual([])
  })

  it('PAN_ID가 없는 행은 거부한다', () => {
    expect(() => parseLhList({ dsList: [{ PAN_NM: '이름만' }] })).toThrow()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/api/__tests__/lh-schema.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 스키마·파서 작성**

```ts
// src/lib/api/lh-schema.ts
import { z } from 'zod'

const str = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => (v == null ? null : String(v).trim() || null))

/** 분양임대공고문 조회(공공데이터포털 15058530) 응답 한 행. 날짜 필드는 문서에 없지만 오면 받아 둔다. */
export const lhNoticeItem = z
  .object({
    PAN_ID: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
    PAN_NM: str,
    UPP_AIS_TP_CD: str, // 01 토지 · 05 분양주택 · 06 임대주택 · 13 주거복지 · 22 상가 · 39 신혼희망타운
    UPP_AIS_TP_NM: str,
    AIS_TP_CD: str,
    AIS_TP_CD_NM: str, // 행복주택·국민임대 …
    CNP_CD: str,
    CNP_CD_NM: str, // 지역명(서울특별시 … 전국)
    PAN_SS: str, // 공고중·접수중·접수마감·상담요청·정정공고중
    PAN_NT_ST_DT: str, // 공고게시일(있으면)
    CLSG_DT: str, // 공고마감일(있으면)
    DTL_URL: str,
    ALL_CNT: str,
    RNUM: str,
  })
  .passthrough()
export type LhNoticeItem = z.infer<typeof lhNoticeItem>

const dsListShape = z.object({ dsList: z.array(lhNoticeItem).optional() }).passthrough()

/** 배열 래퍼와 객체 래퍼를 모두 dsList 하나로 편다. total은 ALL_CNT(없으면 행 수). */
export function parseLhList(json: unknown): { items: LhNoticeItem[]; total: number } {
  const parts = Array.isArray(json) ? json : [json]
  const items: LhNoticeItem[] = []
  for (const p of parts) {
    if (p && typeof p === 'object' && 'dsList' in (p as object)) items.push(...(dsListShape.parse(p).dsList ?? []))
  }
  const total = items.length ? Number(items[0].ALL_CNT ?? items.length) || items.length : 0
  return { items, total }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/api/__tests__/lh-schema.test.ts`
Expected: PASS 4건

- [ ] **Step 5: 클라이언트 작성**

```ts
// src/lib/api/lh.ts
import { parseLhList, type LhNoticeItem } from './lh-schema'
import { housingApiKey } from './applyhome'

const BASE_URL = 'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1'

/** 설계 4절: 분양주택·임대주택·주거복지·신혼희망타운만. 토지·상가는 받지 않는다. */
export const LH_UPP_AIS_TP_CDS = ['05', '06', '13', '39'] as const

export interface LhFetchOptions {
  pageSize?: number
  delayMs?: number
  onPage?: (cd: string, page: number, total: number) => void
}

async function fetchPage(cd: string, page: number, pageSize: number): Promise<{ items: LhNoticeItem[]; total: number }> {
  const url = new URL(BASE_URL)
  url.searchParams.set('serviceKey', housingApiKey())
  url.searchParams.set('PG_SZ', String(pageSize))
  url.searchParams.set('PAGE', String(page))
  url.searchParams.set('UPP_AIS_TP_CD', cd)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`lh ${cd} p${page} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    // 인증키 오류 등은 XML로 온다(<OpenAPI_ServiceResponse>). 앞부분을 그대로 보여준다.
    throw new Error(`lh ${cd} JSON이 아님: ${text.slice(0, 200)}`)
  }
  return parseLhList(json)
}

/** 유형 4종의 공고 전체. 페이지는 ALL_CNT로 센다. 게시일 필터는 API가 믿을 만하지 않아 정규화 단계에서 거른다. */
export async function fetchLhNotices(opts: LhFetchOptions = {}): Promise<LhNoticeItem[]> {
  const pageSize = opts.pageSize ?? 100
  const delayMs = opts.delayMs ?? 300
  const all: LhNoticeItem[] = []
  for (const cd of LH_UPP_AIS_TP_CDS) {
    let page = 1
    let total = Infinity
    while ((page - 1) * pageSize < total) {
      const r = await fetchPage(cd, page, pageSize)
      total = r.total
      all.push(...r.items)
      opts.onPage?.(cd, page, total)
      if (r.items.length === 0) break // 안전장치: ALL_CNT가 틀려도 빈 페이지에서 멈춘다
      page++
      if (delayMs > 0) await new Promise((res) => setTimeout(res, delayMs))
    }
  }
  return all
}
```

- [ ] **Step 6 (키 있을 때): 샘플 확인**

Task 3 Step 6에서 저장한 `fixtures/housing/lh-06.sample.json`을 열어 `PAN_NT_ST_DT`·`CLSG_DT`가 응답에 있는지 본다. 있으면 Task 5의 LH 정규화가 `notice_date`에 쓴다. 없으면 `notice_date`는 null이고 180일 창은 적용하지 않는다(LH는 상태로 걸러져 마감 공고가 `closed`로 들어온다 — 설계 4절의 "상태 전이"와 같다).

- [ ] **Step 7: 커밋**

Run: `npx tsc --noEmit && npx eslint src/lib/api`
Expected: 출력 없음

```bash
git add src/lib/api/lh-schema.ts src/lib/api/lh.ts src/lib/api/__tests__/lh-schema.test.ts
git commit -m "housing: LH 공고문 API 클라이언트"
```

---

### Task 5: 정규화 — 날짜·지역·종류·상태·해시·슬러그

**Files:**
- Create: `src/lib/sync/housing-normalize.ts`
- Create: `src/lib/sync/__tests__/housing-normalize.test.ts`

순수 함수만 둔다. 입력은 Task 3·4의 스키마 타입, 출력은 Task 1의 행 타입이다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/sync/__tests__/housing-normalize.test.ts
import { describe, it, expect } from 'vitest'
import {
  toIsoDate,
  parseRange,
  mapHousingRegion,
  computeHousingStatus,
  mapLhStatus,
  lhKind,
  aptKind,
  contentHash,
  housingSlugBase,
  aggregateUnits,
  normalizeApt,
  normalizeRemainder,
  normalizeUrbty,
  normalizeLh,
  unitsFromMdl,
} from '../housing-normalize'
import type { AptDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'

const now = new Date('2026-01-20T03:00:00Z') // KST 2026-01-20 12:00

function apt(over: Partial<AptDetailItem> = {}): AptDetailItem {
  return {
    HOUSE_MANAGE_NO: '2026000001', PBLANC_NO: '2026000001', HOUSE_NM: '래미안 테스트', HOUSE_SECD: '01', HOUSE_SECD_NM: 'APT',
    HOUSE_DTL_SECD: '01', HOUSE_DTL_SECD_NM: '민영', RENT_SECD: '0', RENT_SECD_NM: '분양주택', SUBSCRPT_AREA_CODE: '100', SUBSCRPT_AREA_CODE_NM: '서울',
    HSSPLY_ZIP: null, HSSPLY_ADRES: '서울특별시 서초구 반포동 1-1', TOT_SUPLY_HSHLDCO: '320', RCRIT_PBLANC_DE: '2026-01-10', PRZWNER_PRESNATN_DE: '2026-01-28',
    CNTRCT_CNCLS_BGNDE: '2026-02-10', CNTRCT_CNCLS_ENDDE: '2026-02-12', MVN_PREARNGE_YM: '202812', BSNS_MBY_NM: '테스트건설', CNSTRCT_ENTRPS_NM: null, MDHS_TELNO: null,
    HMPG_ADRES: 'https://example.com', PBLANC_URL: null, SPECLT_RDN_EARTH_AT: 'Y', MDAT_TRGET_AREA_SECD: 'Y', PARCPRC_ULS_AT: 'N', PUBLIC_HOUSE_EARTH_AT: 'N',
    LRSCL_BLDLND_AT: 'N', NPLN_PRVOPR_PUBLIC_HOUSE_AT: 'N', IMPRMN_BSNS_AT: 'N',
    SPSPLY_RCEPT_BGNDE: '2026-01-21', SPSPLY_RCEPT_ENDDE: '2026-01-21', RCEPT_BGNDE: '2026-01-21', RCEPT_ENDDE: '2026-01-23',
    GNRL_RNK1_CRSPAREA_RCEPT_PD: '2026-01-22 ~ 2026-01-22', GNRL_RNK1_ETC_GG_RCPTDE_PD: null, GNRL_RNK1_ETC_AREA_RCPTDE_PD: '2026-01-22 ~ 2026-01-22',
    GNRL_RNK2_CRSPAREA_RCEPT_PD: '2026-01-23 ~ 2026-01-23', GNRL_RNK2_ETC_GG_RCPTDE_PD: null, GNRL_RNK2_ETC_AREA_RCPTDE_PD: null,
    ...over,
  }
}

function lh(over: Partial<LhNoticeItem> = {}): LhNoticeItem {
  return { PAN_ID: '2026000123', PAN_NM: '서울 행복주택 입주자 모집', UPP_AIS_TP_CD: '06', UPP_AIS_TP_NM: '임대주택', AIS_TP_CD: null, AIS_TP_CD_NM: '행복주택', CNP_CD: '11', CNP_CD_NM: '서울특별시', PAN_SS: '접수중', PAN_NT_ST_DT: '2026.01.15', CLSG_DT: '2026.02.15', DTL_URL: 'https://apply.lh.or.kr/x', ALL_CNT: '1', RNUM: '1', ...over }
}

describe('toIsoDate', () => {
  it.each([
    ['2026-01-15', '2026-01-15'],
    ['20260115', '2026-01-15'],
    ['2026.01.15', '2026-01-15'],
    ['2026-01-15 ~ 2026-01-16', '2026-01-15'], // 구간이면 앞 날짜
    ['', null],
    [null, null],
    ['미정', null],
  ])('%s → %s', (input, expected) => {
    expect(toIsoDate(input)).toBe(expected)
  })
})

describe('parseRange', () => {
  it('"a ~ b"를 시작·끝으로 나눈다', () => {
    expect(parseRange('2026-01-22 ~ 2026-01-23')).toEqual({ start: '2026-01-22', end: '2026-01-23' })
  })
  it('날짜 하나면 시작=끝', () => {
    expect(parseRange('20260122')).toEqual({ start: '2026-01-22', end: '2026-01-22' })
  })
  it('비면 null', () => {
    expect(parseRange(null)).toBeNull()
  })
})

describe('mapHousingRegion', () => {
  it.each([
    ['서울', 'seoul'],
    ['서울특별시', 'seoul'],
    ['경기도', 'gyeonggi'],
    ['전북특별자치도', 'jeonbuk'],
    ['전국', 'ALL'],
    ['해외', 'UNKNOWN'],
    [null, 'UNKNOWN'],
  ])('%s → %s', (input, expected) => {
    expect(mapHousingRegion(input)).toBe(expected)
  })
  // 긴 이름을 먼저 보지 않으면 "경기도 광주시"가 광주로 잡힌다(regions/extract.ts와 같은 이유).
  it('"경기도 광주시"는 경기다', () => {
    expect(mapHousingRegion('경기도 광주시')).toBe('gyeonggi')
  })
})

describe('computeHousingStatus', () => {
  it('접수 시작 전은 upcoming, 구간 안은 open, 지나면 closed', () => {
    expect(computeHousingStatus({ receipt_start: '2026-01-21', receipt_end: '2026-01-23' }, now)).toBe('upcoming')
    expect(computeHousingStatus({ receipt_start: '2026-01-20', receipt_end: '2026-01-23' }, now)).toBe('open')
    expect(computeHousingStatus({ receipt_start: '2026-01-10', receipt_end: '2026-01-19' }, now)).toBe('closed')
  })
  it('일정이 없으면 open(알 수 없음은 숨기지 않는다)', () => {
    expect(computeHousingStatus({ receipt_start: null, receipt_end: null }, now)).toBe('open')
  })
})

describe('mapLhStatus', () => {
  it.each([
    ['공고중', 'upcoming'],
    ['접수중', 'open'],
    ['정정공고중', 'open'],
    ['상담요청', 'open'],
    ['접수마감', 'closed'],
    [null, 'open'],
  ])('%s → %s', (input, expected) => {
    expect(mapLhStatus(input)).toBe(expected)
  })
})

describe('종류', () => {
  it('LH는 공고유형코드로', () => {
    expect(lhKind('05')).toBe('lh_sale')
    expect(lhKind('06')).toBe('lh_rent')
    expect(lhKind('13')).toBe('lh_welfare')
    expect(lhKind('39')).toBe('newlywed_town')
    expect(lhKind('01')).toBeNull() // 토지는 받지 않는다
  })
  it('청약홈 APT는 상세구분명에 신혼희망타운이 있으면 그쪽', () => {
    expect(aptKind(apt())).toBe('apt')
    expect(aptKind(apt({ HOUSE_DTL_SECD_NM: '신혼희망타운' }))).toBe('newlywed_town')
  })
})

describe('contentHash', () => {
  it('키 순서가 달라도 같은 내용이면 같다', () => {
    expect(contentHash({ a: 1, b: 'x' })).toBe(contentHash({ b: 'x', a: 1 }))
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
  })
})

describe('housingSlugBase', () => {
  it('제목을 slugify한다', () => {
    expect(housingSlugBase('래미안 원베일리 (민영)')).toBe('래미안-원베일리-민영')
  })
  // /housing/[slug]가 지역 목록과 공고 상세를 한 세그먼트에서 분기한다(설계 5절).
  it('지역 slug·page와 같아지면 접두사를 붙인다', () => {
    expect(housingSlugBase('seoul')).toBe('공고-seoul')
    expect(housingSlugBase('page')).toBe('공고-page')
  })
})

describe('주택형', () => {
  const mdl: MdlItem = { HOUSE_MANAGE_NO: '1', PBLANC_NO: '1', MODEL_NO: '1', HOUSE_TY: '084.9712A', SUPLY_AR: '84.97', LTTOT_TOP_AMOUNT: '98000', SUPLY_HSHLDCO: '100', SPSPLY_HSHLDCO: '50', NWWDS_HSHLDCO: '20', LFE_FRST_HSHLDCO: '10', MNYCH_HSHLDCO: '5', OLD_PARNTS_SUPORT_HSHLDCO: '3', INSTT_RECOMEND_HSHLDCO: '12', TRANSR_INSTT_ENFSN_HSHLDCO: null, ETC_HSHLDCO: null }
  it('문자열 숫자를 숫자로, 빈 값은 null로', () => {
    const [u] = unitsFromMdl([mdl])
    expect(u).toMatchObject({ house_type: '084.9712A', supply_area: 84.97, max_price_manwon: 98000, general_units: 100, special_units: 50, sp_newlywed: 20, sp_first_life: 10, sp_multi_child: 5, sp_old_parents: 3, sp_institution: 12, sp_etc: null })
  })
  it('특별공급 합계를 낸다', () => {
    expect(aggregateUnits(unitsFromMdl([mdl, { ...mdl, HOUSE_TY: '059A', NWWDS_HSHLDCO: '5', LFE_FRST_HSHLDCO: null, MNYCH_HSHLDCO: '1' }]))).toEqual({ sp_newlywed_units: 25, sp_first_life_units: 10, sp_multi_child_units: 6 })
  })
  it('주택형이 비면 null 행을 만들지 않는다', () => {
    expect(unitsFromMdl([{ ...mdl, HOUSE_TY: null }])).toEqual([])
  })
})

describe('normalizeApt', () => {
  it('일정 6종에서 접수 구간을 만들고 상태를 계산한다', () => {
    const row = normalizeApt(apt(), [], '래미안-테스트', now)
    expect(row).toMatchObject({
      source: 'applyhome', source_id: '2026000001:2026000001', slug: '래미안-테스트', title: '래미안 테스트', kind: 'apt', kind_detail: '민영',
      region_code: 'seoul', total_units: 320, notice_date: '2026-01-10', special_start: '2026-01-21', rank1_start: '2026-01-22', rank1_end: '2026-01-22',
      rank2_start: '2026-01-23', rank2_end: '2026-01-23', winner_date: '2026-01-28', contract_start: '2026-02-10', move_in_ym: '202812',
      receipt_start: '2026-01-21', receipt_end: '2026-01-23', status: 'upcoming', detail_url: 'https://example.com',
    })
    expect(row.content_hash).toHaveLength(40)
    expect(row.synced_at).toBe(now.toISOString())
  })
  it('주택형 합계를 행에 싣는다', () => {
    const units = [{ house_type: 'A', supply_area: null, max_price_manwon: null, general_units: null, special_units: null, sp_newlywed: 7, sp_first_life: null, sp_multi_child: 2, sp_old_parents: null, sp_institution: null, sp_etc: null }]
    const row = normalizeApt(apt(), units, 's', now)
    expect(row.sp_newlywed_units).toBe(7)
    expect(row.sp_multi_child_units).toBe(2)
    expect(row.sp_first_life_units).toBe(0)
  })
  it('해시는 synced_at·slug와 무관하다', () => {
    const a = normalizeApt(apt(), [], 'a', now)
    const b = normalizeApt(apt(), [], 'b', new Date('2027-01-01T00:00:00Z'))
    expect(a.content_hash).toBe(b.content_hash)
  })
})

describe('normalizeRemainder / normalizeUrbty', () => {
  it('무순위는 일반공급 접수일로 구간을 만든다', () => {
    const row = normalizeRemainder({ ...apt(), GNRL_RCEPT_BGNDE: '2026-01-25', GNRL_RCEPT_ENDDE: '2026-01-26', SUBSCRPT_RCEPT_BGNDE: null, SUBSCRPT_RCEPT_ENDDE: null } as never, [], 's', now)
    expect(row.kind).toBe('apt_remainder')
    expect(row.receipt_start).toBe('2026-01-21') // 특별공급이 더 이르다
    expect(row.receipt_end).toBe('2026-01-26')
  })
  it('오피스텔은 SUBSCRPT 접수일만 쓴다', () => {
    const row = normalizeUrbty({ ...apt(), SEARCH_HOUSE_SECD: '0201', SUBSCRPT_RCEPT_BGNDE: '2026-02-01', SUBSCRPT_RCEPT_ENDDE: '2026-02-03' } as never, 's', now)
    expect(row.kind).toBe('officetel_etc')
    expect(row.receipt_start).toBe('2026-02-01')
    expect(row.receipt_end).toBe('2026-02-03')
    expect(row.sp_newlywed_units).toBe(0)
  })
})

describe('normalizeLh', () => {
  it('유형·지역·상태·URL을 옮기고 일정은 비운다', () => {
    const row = normalizeLh(lh(), '서울-행복주택', now)
    expect(row).toMatchObject({ source: 'lh', source_id: '2026000123', kind: 'lh_rent', kind_detail: '행복주택', region_code: 'seoul', status: 'open', detail_url: 'https://apply.lh.or.kr/x', notice_date: '2026-01-15', receipt_start: null, receipt_end: null, total_units: null })
  })
  it('토지·상가 유형은 null을 돌려준다', () => {
    expect(normalizeLh(lh({ UPP_AIS_TP_CD: '01' }), 's', now)).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/sync/__tests__/housing-normalize.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// src/lib/sync/housing-normalize.ts
import { createHash } from 'node:crypto'
import type { AptDetailItem, RemainderDetailItem, UrbtyDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'
import { HOUSING_REGION_UNKNOWN, type HousingKind, type HousingNoticeRow, type HousingStatus, type HousingUnitTypeInput } from '@/types/housing'
import { REGIONS, REGION_ALL } from '../../../data/regions'
import { slugify } from '@/lib/benefits/slug'
import { kstDateString } from '@/lib/benefits/status'

/** 'YYYY-MM-DD' | 'YYYYMMDD' | 'YYYY.MM.DD' (뒤에 뭐가 붙어도 앞 날짜만) → 'YYYY-MM-DD'. 못 읽으면 null. */
export function toIsoDate(v: string | null | undefined): string | null {
  if (!v) return null
  const m = v.trim().match(/^(\d{4})[.-]?(\d{2})[.-]?(\d{2})/)
  if (!m) return null
  const iso = `${m[1]}-${m[2]}-${m[3]}`
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

/** '2026-01-22 ~ 2026-01-23' → {start, end}. 날짜 하나면 start=end. */
export function parseRange(v: string | null | undefined): { start: string; end: string } | null {
  if (!v) return null
  const [a, b] = v.split('~').map((s) => toIsoDate(s))
  if (!a) return null
  return { start: a, end: b ?? a }
}

const ORDERED = REGIONS.flatMap((r) => r.keywords.map((kw) => ({ kw, slug: r.slug }))).sort((a, b) => b.kw.length - a.kw.length)

/** 시도명 → REGIONS slug. '전국'은 ALL, 못 맞추면 UNKNOWN(ALL과 구별). 긴 키워드부터 본다. */
export function mapHousingRegion(name: string | null | undefined): string {
  if (!name) return HOUSING_REGION_UNKNOWN
  const head = name.trim().split(/\s+/)[0]
  if (head === '전국') return REGION_ALL
  for (const { kw, slug } of ORDERED) if (head.startsWith(kw)) return slug
  return HOUSING_REGION_UNKNOWN
}

/** 접수 구간과 오늘(KST)로 상태. 일정이 없으면 open — 모르는 공고를 숨기지 않는다. */
export function computeHousingStatus(r: { receipt_start: string | null; receipt_end: string | null }, now: Date): HousingStatus {
  const today = kstDateString(now)
  if (r.receipt_start && today < r.receipt_start) return 'upcoming'
  if (r.receipt_end && today > r.receipt_end) return 'closed'
  return 'open'
}

export function mapLhStatus(ss: string | null | undefined): HousingStatus {
  if (ss === '공고중') return 'upcoming'
  if (ss === '접수마감') return 'closed'
  return 'open' // 접수중·정정공고중·상담요청·미상
}

export function lhKind(uppAisTpCd: string | null | undefined): HousingKind | null {
  switch (uppAisTpCd) {
    case '05': return 'lh_sale'
    case '06': return 'lh_rent'
    case '13': return 'lh_welfare'
    case '39': return 'newlywed_town'
    default: return null
  }
}

export function aptKind(item: Pick<AptDetailItem, 'HOUSE_DTL_SECD_NM' | 'HOUSE_NM'>): HousingKind {
  const name = `${item.HOUSE_DTL_SECD_NM ?? ''} ${item.HOUSE_NM ?? ''}`
  return name.includes('신혼희망타운') ? 'newlywed_town' : 'apt'
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
}

/** 원문 항목의 sha1. 키 순서와 무관. 원천에 수정 시각이 없어 이것으로 변경을 감지한다. */
export function contentHash(item: unknown): string {
  return createHash('sha1').update(stableStringify(item)).digest('hex')
}

/** /housing/[slug]에서 지역 목록과 공고를 분기하므로 지역 slug·page는 공고 slug로 쓸 수 없다. */
const RESERVED = new Set([...REGIONS.map((r) => r.slug), 'page'])

export function housingSlugBase(title: string): string {
  const base = slugify(title) || '공고'
  return RESERVED.has(base) ? `공고-${base}` : base
}

const num = (v: string | null | undefined): number | null => {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function unitsFromMdl(rows: MdlItem[]): HousingUnitTypeInput[] {
  return rows
    .filter((r) => r.HOUSE_TY)
    .map((r) => ({
      house_type: r.HOUSE_TY as string,
      supply_area: num(r.SUPLY_AR),
      max_price_manwon: num(r.LTTOT_TOP_AMOUNT),
      general_units: num(r.SUPLY_HSHLDCO),
      special_units: num(r.SPSPLY_HSHLDCO),
      sp_newlywed: num(r.NWWDS_HSHLDCO),
      sp_first_life: num(r.LFE_FRST_HSHLDCO),
      sp_multi_child: num(r.MNYCH_HSHLDCO),
      sp_old_parents: num(r.OLD_PARNTS_SUPORT_HSHLDCO),
      sp_institution: num(r.INSTT_RECOMEND_HSHLDCO),
      sp_etc: num(r.ETC_HSHLDCO),
    }))
}

export function aggregateUnits(units: HousingUnitTypeInput[]): Pick<HousingNoticeRow, 'sp_newlywed_units' | 'sp_first_life_units' | 'sp_multi_child_units'> {
  const sum = (pick: (u: HousingUnitTypeInput) => number | null) => units.reduce((a, u) => a + (pick(u) ?? 0), 0)
  return { sp_newlywed_units: sum((u) => u.sp_newlywed), sp_first_life_units: sum((u) => u.sp_first_life), sp_multi_child_units: sum((u) => u.sp_multi_child) }
}

const minDate = (...ds: (string | null)[]): string | null => ds.filter((d): d is string => !!d).sort()[0] ?? null
const maxDate = (...ds: (string | null)[]): string | null => ds.filter((d): d is string => !!d).sort().at(-1) ?? null

function applyhomeBase(item: AptDetailItem | RemainderDetailItem | UrbtyDetailItem, slug: string, now: Date) {
  return {
    source: 'applyhome' as const,
    source_id: `${item.HOUSE_MANAGE_NO}:${item.PBLANC_NO}`,
    slug,
    title: (item.HOUSE_NM ?? '').trim() || `공고 ${item.PBLANC_NO}`,
    kind_detail: item.HOUSE_DTL_SECD_NM ?? item.HOUSE_SECD_NM ?? null,
    region_code: mapHousingRegion(item.SUBSCRPT_AREA_CODE_NM),
    address: item.HSSPLY_ADRES ?? null,
    supplier: item.BSNS_MBY_NM ?? null,
    total_units: num(item.TOT_SUPLY_HSHLDCO),
    notice_date: toIsoDate(item.RCRIT_PBLANC_DE),
    winner_date: toIsoDate(item.PRZWNER_PRESNATN_DE),
    contract_start: toIsoDate(item.CNTRCT_CNCLS_BGNDE),
    contract_end: toIsoDate(item.CNTRCT_CNCLS_ENDDE),
    move_in_ym: item.MVN_PREARNGE_YM ?? null,
    detail_url: item.PBLANC_URL ?? item.HMPG_ADRES ?? null,
    raw: item,
    content_hash: contentHash(item),
    synced_at: now.toISOString(),
  }
}

export function normalizeApt(item: AptDetailItem, units: HousingUnitTypeInput[], slug: string, now: Date): HousingNoticeRow {
  const r1 = [parseRange(item.GNRL_RNK1_CRSPAREA_RCEPT_PD), parseRange(item.GNRL_RNK1_ETC_GG_RCPTDE_PD), parseRange(item.GNRL_RNK1_ETC_AREA_RCPTDE_PD)].filter(Boolean) as { start: string; end: string }[]
  const r2 = [parseRange(item.GNRL_RNK2_CRSPAREA_RCEPT_PD), parseRange(item.GNRL_RNK2_ETC_GG_RCPTDE_PD), parseRange(item.GNRL_RNK2_ETC_AREA_RCPTDE_PD)].filter(Boolean) as { start: string; end: string }[]
  const special_start = toIsoDate(item.SPSPLY_RCEPT_BGNDE)
  const special_end = toIsoDate(item.SPSPLY_RCEPT_ENDDE)
  const rank1_start = minDate(...r1.map((r) => r.start))
  const rank1_end = maxDate(...r1.map((r) => r.end))
  const rank2_start = minDate(...r2.map((r) => r.start))
  const rank2_end = maxDate(...r2.map((r) => r.end))
  const receipt_start = minDate(special_start, rank1_start, rank2_start, toIsoDate(item.RCEPT_BGNDE))
  const receipt_end = maxDate(special_end, rank1_end, rank2_end, toIsoDate(item.RCEPT_ENDDE))
  return {
    ...applyhomeBase(item, slug, now),
    kind: aptKind(item),
    special_start, special_end, rank1_start, rank1_end, rank2_start, rank2_end,
    receipt_start, receipt_end,
    ...aggregateUnits(units),
    status: computeHousingStatus({ receipt_start, receipt_end }, now),
  }
}

export function normalizeRemainder(item: RemainderDetailItem, units: HousingUnitTypeInput[], slug: string, now: Date): HousingNoticeRow {
  const special_start = toIsoDate(item.SPSPLY_RCEPT_BGNDE)
  const special_end = toIsoDate(item.SPSPLY_RCEPT_ENDDE)
  const general_start = toIsoDate(item.GNRL_RCEPT_BGNDE) ?? toIsoDate(item.SUBSCRPT_RCEPT_BGNDE)
  const general_end = toIsoDate(item.GNRL_RCEPT_ENDDE) ?? toIsoDate(item.SUBSCRPT_RCEPT_ENDDE)
  const receipt_start = minDate(special_start, general_start)
  const receipt_end = maxDate(special_end, general_end)
  return {
    ...applyhomeBase(item, slug, now),
    kind: 'apt_remainder',
    special_start, special_end,
    rank1_start: general_start, rank1_end: general_end, rank2_start: null, rank2_end: null,
    receipt_start, receipt_end,
    ...aggregateUnits(units),
    status: computeHousingStatus({ receipt_start, receipt_end }, now),
  }
}

export function normalizeUrbty(item: UrbtyDetailItem, slug: string, now: Date): HousingNoticeRow {
  const receipt_start = toIsoDate(item.SUBSCRPT_RCEPT_BGNDE)
  const receipt_end = toIsoDate(item.SUBSCRPT_RCEPT_ENDDE)
  return {
    ...applyhomeBase(item, slug, now),
    kind: 'officetel_etc',
    special_start: null, special_end: null, rank1_start: receipt_start, rank1_end: receipt_end, rank2_start: null, rank2_end: null,
    receipt_start, receipt_end,
    sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0,
    status: computeHousingStatus({ receipt_start, receipt_end }, now),
  }
}

/** LH 공고. 유형이 대상 밖(토지·상가)이면 null. 일정은 API에 없어 전부 null이고 상태는 원문 상태로. */
export function normalizeLh(item: LhNoticeItem, slug: string, now: Date): HousingNoticeRow | null {
  const kind = lhKind(item.UPP_AIS_TP_CD)
  if (!kind) return null
  return {
    source: 'lh',
    source_id: item.PAN_ID,
    slug,
    title: (item.PAN_NM ?? '').trim() || `LH 공고 ${item.PAN_ID}`,
    kind,
    kind_detail: item.AIS_TP_CD_NM ?? null,
    region_code: mapHousingRegion(item.CNP_CD_NM),
    address: null,
    supplier: '한국토지주택공사',
    total_units: null,
    notice_date: toIsoDate(item.PAN_NT_ST_DT),
    special_start: null, special_end: null, rank1_start: null, rank1_end: null, rank2_start: null, rank2_end: null,
    winner_date: null, contract_start: null, contract_end: null, move_in_ym: null,
    receipt_start: null, receipt_end: null,
    sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0,
    status: mapLhStatus(item.PAN_SS),
    detail_url: item.DTL_URL ?? null,
    raw: item,
    content_hash: contentHash(item),
    synced_at: now.toISOString(),
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/sync/__tests__/housing-normalize.test.ts`
Expected: PASS 전부

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sync/housing-normalize.ts src/lib/sync/__tests__/housing-normalize.test.ts
git commit -m "housing: 공고 정규화(날짜·지역·종류·상태·해시)"
```

---

### Task 6: Repo 인터페이스와 Supabase 구현

**Files:**
- Create: `src/lib/sync/housing-types.ts`
- Create: `src/lib/sync/housing-repo.ts`

repo는 단위 테스트하지 않는다(보조금24의 `supabase-repo.ts`와 같은 방침). 실측은 Task 13의 수동 동기화로 한다.

- [ ] **Step 1: 인터페이스**

```ts
// src/lib/sync/housing-types.ts
import type { SyncRunRow } from '@/types/database'
import type { HousingNoticeRow, HousingSource, HousingStatus, HousingUnitTypeInput } from '@/types/housing'

export interface HousingExisting {
  id: string
  slug: string
  content_hash: string
  status: HousingStatus
}

/** 동기화가 필요로 하는 저장소 동작. Supabase 구현은 housing-repo.ts, 테스트는 가짜 객체. */
export interface HousingRepo {
  /** source별 기존 행: source_id → {id, slug, content_hash, status} */
  getExisting(source: HousingSource): Promise<Map<string, HousingExisting>>
  /** housing_notices 전체 슬러그(unique 제약이 source를 가리지 않는다) */
  allSlugs(): Promise<Set<string>>
  /** (source, source_id) 기준 upsert. source_id → id */
  upsertNotices(rows: HousingNoticeRow[]): Promise<Map<string, string>>
  /** 공고의 주택형을 통째로 바꾼다(삭제 후 삽입). 빈 배열이면 삭제만. */
  replaceUnitTypes(noticeId: string, rows: HousingUnitTypeInput[]): Promise<void>
  /** source 안에서 keep에 없는 source_id를 removed로. 바뀐 slug 반환 */
  markRemoved(source: HousingSource, keepSourceIds: string[]): Promise<string[]>
  recordRun(run: SyncRunRow): Promise<void>
  lastSuccessfulFetched(source: string): Promise<number | null>
}

export interface HousingSourceResult {
  source: HousingSource
  fetched: number
  changed: number
  upserted: number
  skipped: number
  removed: number
  aborted_reason: string | null
  /** 이 소스가 예외로 끝났으면 메시지. 다른 소스는 계속 돈다. */
  error: string | null
  changedSlugs: string[]
  removedSlugs: string[]
}

export interface HousingSyncResult {
  applyhome: HousingSourceResult
  lh: HousingSourceResult
}
```

- [ ] **Step 2: Supabase 구현**

```ts
// src/lib/sync/housing-repo.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncRunRow } from '../../types/database'
import type { HousingNoticeRow, HousingSource, HousingUnitTypeInput } from '../../types/housing'
import type { HousingRepo, HousingExisting } from './housing-types'

const PAGE = 1000

/** HousingRepo의 Supabase 구현. service role 클라이언트. tsx 스크립트에서도 쓰므로 상대경로 import. */
export function createHousingRepo(supabase: SupabaseClient): HousingRepo {
  async function getExisting(source: HousingSource): Promise<Map<string, HousingExisting>> {
    const map = new Map<string, HousingExisting>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('housing_notices')
        .select('id, source_id, slug, content_hash, status')
        .eq('source', source)
        .range(from, from + PAGE - 1)
      if (error) throw error
      for (const r of data ?? []) map.set(r.source_id, { id: r.id, slug: r.slug, content_hash: r.content_hash, status: r.status })
      if (!data || data.length < PAGE) break
    }
    return map
  }

  return {
    getExisting,

    async allSlugs() {
      const out = new Set<string>()
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase.from('housing_notices').select('slug').range(from, from + PAGE - 1)
        if (error) throw error
        for (const r of data ?? []) out.add(r.slug as string)
        if (!data || data.length < PAGE) break
      }
      return out
    },

    async upsertNotices(rows: HousingNoticeRow[]) {
      const { data, error } = await supabase.from('housing_notices').upsert(rows, { onConflict: 'source,source_id' }).select('id, source_id')
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.source_id as string, r.id as string]))
    },

    async replaceUnitTypes(noticeId: string, rows: HousingUnitTypeInput[]) {
      const del = await supabase.from('housing_unit_types').delete().eq('notice_id', noticeId)
      if (del.error) throw del.error
      if (!rows.length) return
      const { error } = await supabase.from('housing_unit_types').insert(rows.map((r) => ({ ...r, notice_id: noticeId })))
      if (error) throw error
    },

    async markRemoved(source: HousingSource, keepSourceIds: string[]) {
      const keep = new Set(keepSourceIds)
      const existing = await getExisting(source)
      const toRemove = [...existing.keys()].filter((sid) => !keep.has(sid))
      const slugs: string[] = []
      for (let i = 0; i < toRemove.length; i += 200) {
        const chunk = toRemove.slice(i, i + 200)
        const { data, error } = await supabase
          .from('housing_notices')
          .update({ status: 'removed' })
          .eq('source', source)
          .in('source_id', chunk)
          .neq('status', 'removed')
          .select('slug')
        if (error) throw error
        for (const r of data ?? []) slugs.push(r.slug as string)
      }
      return slugs
    },

    async recordRun(run: SyncRunRow) {
      const { error } = await supabase.from('sync_runs').insert(run)
      if (error) throw error
    },

    async lastSuccessfulFetched(source: string) {
      const { data, error } = await supabase
        .from('sync_runs')
        .select('fetched')
        .eq('source', source)
        .is('error', null)
        .is('aborted_reason', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data?.fetched ?? null
    },
  }
}
```

- [ ] **Step 3: 타입 검사·커밋**

Run: `npx tsc --noEmit && npx eslint src/lib/sync`
Expected: 출력 없음

```bash
git add src/lib/sync/housing-types.ts src/lib/sync/housing-repo.ts
git commit -m "housing: repo 인터페이스와 Supabase 구현"
```

---

### Task 7: 동기화 오케스트레이터

**Files:**
- Create: `src/lib/sync/housing-sync.ts`
- Create: `src/lib/sync/__tests__/housing-sync.test.ts`

두 소스를 **각각** try/catch로 감싸 하나의 예외가 다른 소스를 막지 않는다. 각 소스는 `sync_runs`에 자기 행을 남긴다(`source`=`applyhome`/`lh`). 변경 = 해시가 다르거나 계산한 상태가 저장된 상태와 다름. 주택형은 APT·무순위의 **바뀐 공고에 대해서만** 받는다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/sync/__tests__/housing-sync.test.ts
import { describe, it, expect, vi } from 'vitest'
import { runHousingSync } from '../housing-sync'
import type { HousingRepo, HousingExisting } from '../housing-types'
import type { HousingNoticeRow, HousingUnitTypeInput } from '@/types/housing'
import type { SyncRunRow } from '@/types/database'
import type { AptDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'
import { contentHash } from '../housing-normalize'

const now = new Date('2026-01-20T03:00:00Z')

function apt(id: string, over: Partial<AptDetailItem> = {}): AptDetailItem {
  return {
    HOUSE_MANAGE_NO: id, PBLANC_NO: id, HOUSE_NM: `단지 ${id}`, HOUSE_SECD: '01', HOUSE_SECD_NM: 'APT', HOUSE_DTL_SECD: '01', HOUSE_DTL_SECD_NM: '민영', RENT_SECD: '0', RENT_SECD_NM: '분양주택',
    SUBSCRPT_AREA_CODE: '100', SUBSCRPT_AREA_CODE_NM: '서울', HSSPLY_ZIP: null, HSSPLY_ADRES: null, TOT_SUPLY_HSHLDCO: '100', RCRIT_PBLANC_DE: '2026-01-10', PRZWNER_PRESNATN_DE: null,
    CNTRCT_CNCLS_BGNDE: null, CNTRCT_CNCLS_ENDDE: null, MVN_PREARNGE_YM: null, BSNS_MBY_NM: null, CNSTRCT_ENTRPS_NM: null, MDHS_TELNO: null, HMPG_ADRES: null, PBLANC_URL: null,
    SPECLT_RDN_EARTH_AT: null, MDAT_TRGET_AREA_SECD: null, PARCPRC_ULS_AT: null, PUBLIC_HOUSE_EARTH_AT: null, LRSCL_BLDLND_AT: null, NPLN_PRVOPR_PUBLIC_HOUSE_AT: null, IMPRMN_BSNS_AT: null,
    SPSPLY_RCEPT_BGNDE: '2026-01-25', SPSPLY_RCEPT_ENDDE: '2026-01-25', RCEPT_BGNDE: '2026-01-25', RCEPT_ENDDE: '2026-01-27',
    GNRL_RNK1_CRSPAREA_RCEPT_PD: null, GNRL_RNK1_ETC_GG_RCPTDE_PD: null, GNRL_RNK1_ETC_AREA_RCPTDE_PD: null, GNRL_RNK2_CRSPAREA_RCEPT_PD: null, GNRL_RNK2_ETC_GG_RCPTDE_PD: null, GNRL_RNK2_ETC_AREA_RCPTDE_PD: null,
    ...over,
  }
}

function lh(id: string, over: Partial<LhNoticeItem> = {}): LhNoticeItem {
  return { PAN_ID: id, PAN_NM: `LH 공고 ${id}`, UPP_AIS_TP_CD: '06', UPP_AIS_TP_NM: '임대주택', AIS_TP_CD: null, AIS_TP_CD_NM: '행복주택', CNP_CD: null, CNP_CD_NM: '경기도', PAN_SS: '접수중', PAN_NT_ST_DT: null, CLSG_DT: null, DTL_URL: 'https://apply.lh.or.kr/x', ALL_CNT: '1', RNUM: '1', ...over }
}

const mdl = (id: string): MdlItem => ({ HOUSE_MANAGE_NO: id, PBLANC_NO: id, MODEL_NO: '1', HOUSE_TY: '084A', SUPLY_AR: '84', LTTOT_TOP_AMOUNT: '90000', SUPLY_HSHLDCO: '50', SPSPLY_HSHLDCO: '50', NWWDS_HSHLDCO: '10', LFE_FRST_HSHLDCO: null, MNYCH_HSHLDCO: null, OLD_PARNTS_SUPORT_HSHLDCO: null, INSTT_RECOMEND_HSHLDCO: null, TRANSR_INSTT_ENFSN_HSHLDCO: null, ETC_HSHLDCO: null })

function fakeRepo(existing: { applyhome?: Record<string, HousingExisting>; lh?: Record<string, HousingExisting> } = {}, lastFetched: Record<string, number | null> = {}) {
  const calls = { notices: [] as HousingNoticeRow[], units: [] as { noticeId: string; rows: HousingUnitTypeInput[] }[], runs: [] as SyncRunRow[], removedKeep: {} as Record<string, string[]> }
  const repo: HousingRepo = {
    getExisting: vi.fn(async (source) => new Map(Object.entries(existing[source] ?? {}))),
    allSlugs: vi.fn(async () => new Set([...Object.values(existing.applyhome ?? {}), ...Object.values(existing.lh ?? {})].map((e) => e.slug))),
    upsertNotices: vi.fn(async (rows) => {
      calls.notices.push(...rows)
      return new Map(rows.map((r) => [r.source_id, `id-${r.source_id}`]))
    }),
    replaceUnitTypes: vi.fn(async (noticeId, rows) => {
      calls.units.push({ noticeId, rows })
    }),
    markRemoved: vi.fn(async (source, keep) => {
      calls.removedKeep[source] = keep
      return source === 'applyhome' ? ['removed-a'] : []
    }),
    recordRun: vi.fn(async (run) => {
      calls.runs.push(run)
    }),
    lastSuccessfulFetched: vi.fn(async (source) => lastFetched[source] ?? null),
  }
  return { repo, calls }
}

const deps = (repo: HousingRepo, over: Partial<Parameters<typeof runHousingSync>[0]> = {}) => ({
  repo,
  fetchApplyhome: async () => ({ apt: [apt('A1')], remainder: [], urbty: [] }),
  fetchUnits: vi.fn(async (_k: 'apt' | 'remainder', id: string) => [mdl(id)]),
  fetchLh: async () => [lh('L1')],
  now,
  ...over,
})

describe('runHousingSync', () => {
  it('신규 공고를 upsert하고 APT는 주택형을 받아 붙인다', async () => {
    const { repo, calls } = fakeRepo()
    const d = deps(repo)
    const r = await runHousingSync(d)
    expect(r.applyhome).toMatchObject({ fetched: 1, changed: 1, upserted: 1, skipped: 0, error: null })
    expect(r.lh).toMatchObject({ fetched: 1, changed: 1, upserted: 1 })
    expect(d.fetchUnits).toHaveBeenCalledWith('apt', 'A1', 'A1')
    expect(calls.units[0]).toMatchObject({ noticeId: 'id-A1:A1', rows: [{ house_type: '084A', sp_newlywed: 10 }] })
    const row = calls.notices.find((n) => n.source_id === 'A1:A1')!
    expect(row.sp_newlywed_units).toBe(10)
    expect(row.slug).toBe('단지-A1')
    expect(r.applyhome.changedSlugs).toEqual(['단지-A1'])
  })

  // 원천에 수정 시각이 없어 해시로 감지한다. 같은 해시·같은 상태면 주택형 호출도 하지 않는다.
  it('해시와 상태가 같으면 건너뛰고 주택형을 받지 않는다', async () => {
    const item = apt('A1')
    const { repo, calls } = fakeRepo({ applyhome: { 'A1:A1': { id: 'x', slug: '단지-A1', content_hash: contentHash(item), status: 'upcoming' } } })
    const d = deps(repo, { fetchApplyhome: async () => ({ apt: [item], remainder: [], urbty: [] }) })
    const r = await runHousingSync(d)
    expect(r.applyhome.skipped).toBe(1)
    expect(r.applyhome.changed).toBe(0)
    expect(d.fetchUnits).not.toHaveBeenCalled()
    expect(calls.notices.filter((n) => n.source === 'applyhome')).toHaveLength(0)
  })

  // 접수 시작일이 지나면 원문은 그대로여도 상태가 바뀐다. 이것을 놓치면 "접수 예정"이 영영 남는다.
  it('해시가 같아도 날짜로 계산한 상태가 다르면 갱신하고 기존 slug를 유지한다', async () => {
    const item = apt('A1')
    const { repo, calls } = fakeRepo({ applyhome: { 'A1:A1': { id: 'x', slug: '옛-슬러그', content_hash: contentHash(item), status: 'upcoming' } } })
    const later = new Date('2026-01-26T03:00:00Z') // 접수 구간 안
    const r = await runHousingSync(deps(repo, { fetchApplyhome: async () => ({ apt: [item], remainder: [], urbty: [] }), now: later }))
    expect(r.applyhome.changed).toBe(1)
    expect(calls.notices[0]).toMatchObject({ slug: '옛-슬러그', status: 'open' })
  })

  it('LH는 대상 밖 유형(토지)을 세지 않고 주택형도 받지 않는다', async () => {
    const { repo, calls } = fakeRepo()
    const d = deps(repo, { fetchLh: async () => [lh('L1'), lh('L2', { UPP_AIS_TP_CD: '01' })] })
    const r = await runHousingSync(d)
    expect(r.lh.fetched).toBe(2)
    expect(r.lh.changed).toBe(1)
    expect(calls.notices.filter((n) => n.source === 'lh')).toHaveLength(1)
    expect(calls.units.every((u) => !u.noticeId.startsWith('id-L'))).toBe(true)
  })

  it('한 소스가 던져도 다른 소스는 끝까지 돌고 run에 error를 남긴다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { repo, calls } = fakeRepo()
    const r = await runHousingSync(deps(repo, { fetchApplyhome: async () => { throw new Error('odcloud 500') } }))
    expect(r.applyhome.error).toContain('odcloud 500')
    expect(r.lh).toMatchObject({ upserted: 1, error: null })
    expect(calls.runs.map((x) => [x.source, x.error])).toEqual([['applyhome', 'odcloud 500'], ['lh', null]])
  })

  it('직전 성공 대비 30% 넘게 줄면 그 소스만 중단한다', async () => {
    const { repo, calls } = fakeRepo({}, { lh: 10 })
    const r = await runHousingSync(deps(repo))
    expect(r.lh.aborted_reason).toMatch(/급감/)
    expect(r.lh.upserted).toBe(0)
    expect(r.applyhome.upserted).toBe(1)
    expect(calls.runs.find((x) => x.source === 'lh')?.aborted_reason).toMatch(/급감/)
  })

  it('원천에서 사라진 공고는 removed로 표시하고 slug를 돌려준다', async () => {
    const { repo, calls } = fakeRepo()
    const r = await runHousingSync(deps(repo))
    expect(calls.removedKeep.applyhome).toEqual(['A1:A1'])
    expect(calls.removedKeep.lh).toEqual(['L1'])
    expect(r.applyhome.removedSlugs).toEqual(['removed-a'])
    expect(r.applyhome.removed).toBe(1)
  })

  it('같은 제목의 공고는 슬러그에 접미를 붙인다', async () => {
    const { repo, calls } = fakeRepo()
    await runHousingSync(deps(repo, { fetchApplyhome: async () => ({ apt: [apt('A1', { HOUSE_NM: '같은 이름' }), apt('A2', { HOUSE_NM: '같은 이름' })], remainder: [], urbty: [] }) }))
    const slugs = calls.notices.filter((n) => n.source === 'applyhome').map((n) => n.slug).sort()
    expect(slugs).toEqual(['같은-이름', '같은-이름-2'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/sync/__tests__/housing-sync.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// src/lib/sync/housing-sync.ts
import type { AptDetailItem, RemainderDetailItem, UrbtyDetailItem, MdlItem } from '@/lib/api/applyhome-schema'
import type { LhNoticeItem } from '@/lib/api/lh-schema'
import type { SyncRunRow } from '@/types/database'
import type { HousingNoticeRow, HousingSource, HousingUnitTypeInput } from '@/types/housing'
import { allocateSlug } from '@/lib/benefits/slug'
import { errorMessage } from './gov24-sync'
import { shouldAbortForDrop } from './diff'
import { housingSlugBase, normalizeApt, normalizeLh, normalizeRemainder, normalizeUrbty, unitsFromMdl } from './housing-normalize'
import type { HousingRepo, HousingSourceResult, HousingSyncResult } from './housing-types'

export interface HousingSyncDeps {
  repo: HousingRepo
  fetchApplyhome: () => Promise<{ apt: AptDetailItem[]; remainder: RemainderDetailItem[]; urbty: UrbtyDetailItem[] }>
  /** 바뀐 APT·무순위 공고의 주택형. 바뀌지 않은 공고에는 부르지 않는다. */
  fetchUnits: (kind: 'apt' | 'remainder', houseManageNo: string, pblancNo: string) => Promise<MdlItem[]>
  fetchLh: () => Promise<LhNoticeItem[]>
  now?: Date
  batchSize?: number
  log?: (msg: string) => void
}

function emptyResult(source: HousingSource): HousingSourceResult {
  return { source, fetched: 0, changed: 0, upserted: 0, skipped: 0, removed: 0, aborted_reason: null, error: null, changedSlugs: [], removedSlugs: [] }
}

/** 두 소스를 독립적으로 돌린다. 하나의 예외는 그 소스의 result.error와 sync_runs.error에만 남는다. */
export async function runHousingSync(deps: HousingSyncDeps): Promise<HousingSyncResult> {
  const now = deps.now ?? new Date()
  const applyhome = await runSource('applyhome', deps, now, syncApplyhome)
  const lh = await runSource('lh', deps, now, syncLh)
  return { applyhome, lh }
}

type SourceBody = (deps: HousingSyncDeps, now: Date, result: HousingSourceResult, log: (m: string) => void) => Promise<void>

async function runSource(source: HousingSource, deps: HousingSyncDeps, now: Date, body: SourceBody): Promise<HousingSourceResult> {
  const log = deps.log ?? (() => {})
  const result = emptyResult(source)
  const run: SyncRunRow = { source, started_at: now.toISOString(), finished_at: null, fetched: 0, upserted: 0, skipped: 0, failed: 0, closed: 0, removed: 0, error: null, aborted_reason: null }
  try {
    await body(deps, now, result, (m) => log(`[${source}] ${m}`))
  } catch (err) {
    result.error = errorMessage(err)
    console.error(`[housing-sync:${source}]`, err)
  } finally {
    run.fetched = result.fetched
    run.upserted = result.upserted
    run.skipped = result.skipped
    run.removed = result.removed
    run.aborted_reason = result.aborted_reason
    run.error = result.error
    run.finished_at = new Date().toISOString()
    await deps.repo.recordRun(run)
  }
  return result
}

interface Candidate {
  row: HousingNoticeRow
  /** 주택형을 받아야 하는 청약홈 공고(APT·무순위)의 식별자. 받은 뒤 집계를 행에 싣는다. */
  units?: { kind: 'apt' | 'remainder'; houseManageNo: string; pblancNo: string }
}

/**
 * 공통 적재. 후보마다 기존 행과 해시·상태를 비교해 바뀐 것만 upsert한다.
 * 슬러그는 기존 행이 있으면 그대로, 없으면 제목에서 만들고 충돌 시 접미를 붙인다.
 */
async function upsertChanged(source: HousingSource, candidates: Candidate[], keepIds: string[], deps: HousingSyncDeps, result: HousingSourceResult, log: (m: string) => void) {
  const batchSize = deps.batchSize ?? 100
  const existing = await deps.repo.getExisting(source)
  const usedSlugs = await deps.repo.allSlugs()
  const changed: Candidate[] = []
  for (const c of candidates) {
    const prev = existing.get(c.row.source_id)
    if (prev && prev.content_hash === c.row.content_hash && prev.status === c.row.status) {
      result.skipped++
      continue
    }
    c.row.slug = prev?.slug ?? allocateSlug(housingSlugBase(c.row.title), usedSlugs)
    changed.push(c)
  }
  result.changed = changed.length

  for (let i = 0; i < changed.length; i += batchSize) {
    const batch = changed.slice(i, i + batchSize)
    const unitRows = new Map<string, HousingUnitTypeInput[]>()
    for (const c of batch) {
      if (!c.units) continue
      const units = unitsFromMdl(await deps.fetchUnits(c.units.kind, c.units.houseManageNo, c.units.pblancNo))
      unitRows.set(c.row.source_id, units)
      const sum = (pick: (u: HousingUnitTypeInput) => number | null) => units.reduce((a, u) => a + (pick(u) ?? 0), 0)
      c.row.sp_newlywed_units = sum((u) => u.sp_newlywed)
      c.row.sp_first_life_units = sum((u) => u.sp_first_life)
      c.row.sp_multi_child_units = sum((u) => u.sp_multi_child)
    }
    const ids = await deps.repo.upsertNotices(batch.map((c) => c.row))
    for (const [sourceId, units] of unitRows) {
      const id = ids.get(sourceId)
      if (id) await deps.repo.replaceUnitTypes(id, units)
    }
    result.upserted += batch.length
    result.changedSlugs.push(...batch.map((c) => c.row.slug))
    log(`upserted ${result.upserted}/${changed.length}`)
  }

  result.removedSlugs = await deps.repo.markRemoved(source, keepIds)
  result.removed = result.removedSlugs.length
}

const syncApplyhome: SourceBody = async (deps, now, result, log) => {
  const { apt, remainder, urbty } = await deps.fetchApplyhome()
  result.fetched = apt.length + remainder.length + urbty.length
  log(`fetched apt=${apt.length} remainder=${remainder.length} urbty=${urbty.length}`)
  const last = await deps.repo.lastSuccessfulFetched('applyhome')
  if (shouldAbortForDrop(last, result.fetched)) {
    result.aborted_reason = `건수 급감: 직전 ${last ?? '없음'} → 이번 ${result.fetched}`
    return
  }
  const candidates: Candidate[] = [
    ...apt.map((i) => ({ row: normalizeApt(i, [], '', now), units: { kind: 'apt' as const, houseManageNo: i.HOUSE_MANAGE_NO, pblancNo: i.PBLANC_NO } })),
    ...remainder.map((i) => ({ row: normalizeRemainder(i, [], '', now), units: { kind: 'remainder' as const, houseManageNo: i.HOUSE_MANAGE_NO, pblancNo: i.PBLANC_NO } })),
    ...urbty.map((i) => ({ row: normalizeUrbty(i, '', now) })),
  ]
  await upsertChanged('applyhome', candidates, candidates.map((c) => c.row.source_id), deps, result, log)
}

const syncLh: SourceBody = async (deps, now, result, log) => {
  const items = await deps.fetchLh()
  result.fetched = items.length
  log(`fetched ${items.length}`)
  const last = await deps.repo.lastSuccessfulFetched('lh')
  if (shouldAbortForDrop(last, result.fetched)) {
    result.aborted_reason = `건수 급감: 직전 ${last ?? '없음'} → 이번 ${result.fetched}`
    return
  }
  const candidates: Candidate[] = []
  for (const i of items) {
    const row = normalizeLh(i, '', now)
    if (row) candidates.push({ row })
  }
  await upsertChanged('lh', candidates, candidates.map((c) => c.row.source_id), deps, result, log)
}
```

주의: `normalizeApt`의 `units` 인자는 여기서 빈 배열을 넘기고 집계는 `upsertChanged`가 주택형을 받은 뒤 채운다. 해시는 원문 항목(`raw`)만으로 계산되므로 집계가 나중에 들어가도 변하지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/sync/__tests__/housing-sync.test.ts`
Expected: PASS 8건. `lastSuccessfulFetched` 테스트에서 `lh: 10` → 이번 1건은 30% 넘게 줄어 중단.

- [ ] **Step 5: 수동 스크립트**

```ts
// scripts/sync-housing.ts
import { createAdminClient } from '../src/lib/supabase/admin'
import { createHousingRepo } from '../src/lib/sync/housing-repo'
import { runHousingSync } from '../src/lib/sync/housing-sync'
import { fetchApplyhomeDetails, fetchApplyhomeUnits } from '../src/lib/api/applyhome'
import { fetchLhNotices } from '../src/lib/api/lh'

/** 설계 4절: 모집공고일 최근 180일. */
export const HOUSING_WINDOW_DAYS = 180

async function main() {
  const repo = createHousingRepo(createAdminClient())
  const since = new Date(Date.now() - HOUSING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const result = await runHousingSync({
    repo,
    fetchApplyhome: () => fetchApplyhomeDetails(since, { onPage: (op, p, t) => console.log(`${op} ${p}/${t}`) }),
    fetchUnits: (kind, h, p) => fetchApplyhomeUnits(kind, h, p),
    fetchLh: () => fetchLhNotices({ onPage: (cd, p, t) => console.log(`lh ${cd} p${p} (${t})`) }),
    log: console.log,
  })
  const brief = (r: typeof result.applyhome) => ({ ...r, changedSlugs: r.changedSlugs.length, removedSlugs: r.removedSlugs.length })
  console.log(JSON.stringify({ applyhome: brief(result.applyhome), lh: brief(result.lh) }, null, 2))
  if (result.applyhome.error || result.lh.error) process.exit(1)
  if (result.applyhome.aborted_reason || result.lh.aborted_reason) process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

`package.json` scripts에:

```json
    "sync:housing": "tsx --env-file=.env.local scripts/sync-housing.ts",
```

- [ ] **Step 6 (키 있을 때): 첫 적재**

Run: `npm run sync:housing`
Expected: 두 소스 모두 `error: null`, `upserted`가 수십~수백. Supabase Table Editor에서 `housing_notices`의 `region_code`에 `UNKNOWN`이 몇 건인지 본다 — 있으면 그 행의 `raw->>'SUBSCRPT_AREA_CODE_NM'`(또는 `CNP_CD_NM`) 값을 `data/regions.ts`의 `keywords`에 추가하고 다시 돌린다. `kind_detail`과 `raw->>'RENT_SECD_NM'`의 실제 값도 메모한다(Task 9의 라벨에 반영).

- [ ] **Step 7: 커밋**

```bash
git add src/lib/sync/housing-sync.ts src/lib/sync/__tests__/housing-sync.test.ts scripts/sync-housing.ts package.json
git commit -m "housing: 소스별 독립 동기화와 수동 스크립트"
```

---

### Task 8: cron 통합 `/api/cron/sync`

**Files:**
- Create: `src/app/api/cron/sync/route.ts`
- Delete: `src/app/api/cron/sync-gov24/route.ts`
- Move+Modify: `src/app/api/cron/__tests__/sync-gov24.test.ts` → `src/app/api/cron/__tests__/sync.test.ts`
- Modify: `vercel.json`
- Modify: `README.md` 동기화 절

Vercel Hobby는 cron 2개가 한도다. 보조금24 두 번이 이미 쓰고 있으므로 라우트를 하나로 합치고, 공고 동기화는 쿼리 `?housing=1`이 있을 때만 돈다(둘 다 켜 두고, 소요 시간이 60초를 위협하면 낮 실행에서 뺀다).

- [ ] **Step 1: 테스트 파일 이동과 보강**

```bash
git mv src/app/api/cron/__tests__/sync-gov24.test.ts src/app/api/cron/__tests__/sync.test.ts
```

파일 상단의 mock·import를 다음으로 바꾼다:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const runMock = vi.fn()
const housingMock = vi.fn()
vi.mock('@/lib/sync/gov24-sync', () => ({ runGov24Sync: (...args: unknown[]) => runMock(...args) }))
vi.mock('@/lib/sync/housing-sync', () => ({ runHousingSync: (...args: unknown[]) => housingMock(...args) }))
vi.mock('@/lib/sync/supabase-repo', () => ({ createSupabaseRepo: vi.fn(() => ({})) }))
vi.mock('@/lib/sync/housing-repo', () => ({ createHousingRepo: vi.fn(() => ({})) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/api/applyhome', () => ({ fetchApplyhomeDetails: vi.fn(), fetchApplyhomeUnits: vi.fn() }))
vi.mock('@/lib/api/lh', () => ({ fetchLhNotices: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { GET } from '@/app/api/cron/sync/route'
import { revalidateTag } from 'next/cache'
import { benefitTag, housingTag } from '@/lib/cache-tags'
```

`authed()`의 주소를 `http://localhost/api/cron/sync`로, 모든 `NextRequest('http://localhost/api/cron/sync-gov24'...)`도 같은 주소로 바꾼다. `beforeEach`에 `housingMock.mockReset()`을 추가한다.

응답 본문 검사는 `gov24` 키 아래로 옮긴다. 예:

```ts
    expect(await res.json()).toMatchObject({ gov24: { upserted: 2, changedSlugs: 2, invalidated: 'per-slug' }, housing: null })
```

같은 식으로 `invalidated: 'all'`·`'none'` 검사도 `gov24: { invalidated: ... }`로 감싼다. 실패 응답(`sync failed`)은 그대로 top-level이다.

파일 끝에 공고 테스트를 추가한다:

```ts
const housingOk = {
  applyhome: { source: 'applyhome', fetched: 10, changed: 2, upserted: 2, skipped: 8, removed: 1, aborted_reason: null, error: null, changedSlugs: ['h1', 'h2'], removedSlugs: ['h3'] },
  lh: { source: 'lh', fetched: 5, changed: 0, upserted: 0, skipped: 5, removed: 0, aborted_reason: null, error: null, changedSlugs: [], removedSlugs: [] },
}
const housingReq = () => new NextRequest('http://localhost/api/cron/sync?housing=1', { headers: { authorization: 'Bearer secret' } })

describe('GET /api/cron/sync — 공고', () => {
  beforeEach(() => {
    runMock.mockResolvedValue(quiet)
  })

  it('housing=1이 없으면 공고 동기화를 돌리지 않는다', async () => {
    await GET(authed())
    expect(housingMock).not.toHaveBeenCalled()
  })

  it('housing=1이면 보조금24 뒤에 공고를 돌리고 목록 태그와 바뀐 슬러그만 비운다', async () => {
    housingMock.mockResolvedValue(housingOk)
    const res = await GET(housingReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.housing).toMatchObject({ applyhome: { upserted: 2, changedSlugs: 2, removedSlugs: 1 }, lh: { upserted: 0 }, invalidated: 'per-slug' })
    const tags = calledTags()
    expect(tags).toContain('housing:lists')
    expect(tags).toContain(housingTag('h1'))
    expect(tags).toContain(housingTag('h3'))
    expect(tags).not.toContain('housing:all')
  })

  // 공고 동기화의 실패는 보조금24 결과를 가리지 않는다. 응답은 200이고 본문에 error가 실린다.
  it('소스 하나가 error면 그 사실을 싣고 전체를 비우되 200이다', async () => {
    housingMock.mockResolvedValue({ ...housingOk, lh: { ...housingOk.lh, error: 'lh 500' } })
    const res = await GET(housingReq())
    expect(res.status).toBe(200)
    expect((await res.json()).housing).toMatchObject({ lh: { error: 'lh 500' }, invalidated: 'all' })
    expect(calledTags()).toContain('housing:all')
  })

  it('runHousingSync 자체가 던지면 housing.error에 싣고 housing:all을 비운다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    housingMock.mockRejectedValue(new Error('boom'))
    const res = await GET(housingReq())
    expect(res.status).toBe(200)
    expect((await res.json()).housing).toMatchObject({ error: 'housing sync failed', invalidated: 'all' })
    expect(calledTags()).toContain('housing:all')
  })

  it('보조금24가 409로 중단되면 공고는 돌리지 않는다', async () => {
    runMock.mockResolvedValue({ ...quiet, aborted_reason: '건수 급감' })
    const res = await GET(housingReq())
    expect(res.status).toBe(409)
    expect(housingMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/cron/__tests__/sync.test.ts`
Expected: FAIL — `@/app/api/cron/sync/route` 없음

- [ ] **Step 3: 라우트 작성 (기존 `sync-gov24/route.ts`를 옮기고 공고 단계를 더한다)**

```ts
// src/app/api/cron/sync/route.ts
import { NextResponse } from 'next/server'
import { CACHE_TAGS, benefitTag, housingTag, isSlugLike } from '@/lib/cache-tags'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseRepo } from '@/lib/sync/supabase-repo'
import { runGov24Sync } from '@/lib/sync/gov24-sync'
import { fetchAll } from '@/lib/api/gov24'
import { createHousingRepo } from '@/lib/sync/housing-repo'
import { runHousingSync } from '@/lib/sync/housing-sync'
import type { HousingSyncResult } from '@/lib/sync/housing-types'
import { fetchApplyhomeDetails, fetchApplyhomeUnits } from '@/lib/api/applyhome'
import { fetchLhNotices } from '@/lib/api/lh'

export const runtime = 'nodejs'
// Vercel Hobby 상한. 플랜 상한을 넘는 값은 배포가 실패한다.
// 초기 적재는 scripts/*.ts로 하고, Cron은 변경분만 upsert하므로 보통 30초 이내. Pro 전환 시 300으로.
export const maxDuration = 60

/**
 * 이 수를 넘는 변경은 한 장씩 비우지 않고 *:all로 전부 비운다. 원천이 갱신 시각을 통째로
 * 바꾸는 날(10,947건 전부 변경으로 잡힌 적이 있다)에 만 번의 revalidateTag 호출을 피하기 위해서다.
 */
const PER_SLUG_LIMIT = 100

/** 공고 동기화 창(일). scripts/sync-housing.ts와 같은 값. 설계 4절. */
const HOUSING_WINDOW_DAYS = 180

/**
 * 보조금24 → (housing=1이면) 청약홈·LH. Hobby는 cron 2개가 한도라 라우트를 하나로 합쳤다.
 * 공고 단계의 실패는 보조금24 결과를 가리지 않는다 — 응답은 200이고 housing.error에 실린다.
 */
export async function GET(request: Request) {
  // 비어 있으면 `Bearer undefined`가 정답이 되어 누구나 통과한다. 비교보다 먼저 막는다.
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const withHousing = new URL(request.url).searchParams.get('housing') === '1'

  let gov24: Record<string, unknown>
  try {
    const repo = createSupabaseRepo(createAdminClient())
    const result = await runGov24Sync({
      repo,
      fetchList: () => fetchAll('serviceList'),
      fetchConditions: () => fetchAll('supportConditions'),
    })

    if (result.aborted_reason) {
      return NextResponse.json({ gov24: { ...result, changedSlugs: undefined, closedSlugs: undefined, removedSlugs: undefined }, housing: null }, { status: 409 })
    }

    // 목록·홈은 변경이 없어도 매번 비운다. 카드의 D-day와 "최종 동기화" 시각은 하루가 지나면 틀리고,
    // 목록 페이지는 수십 장이라 비용이 거의 없다. 상세 1만 장은 바뀐 슬러그만 비운다 — benefits:all을
    // 쏘면 그 뒤 크롤러 방문마다 재생성이 일어나 ISR 쓰기 한도를 삼킨다(지금까지 그랬다).
    revalidateTag(CACHE_TAGS.benefitsHome)
    revalidateTag(CACHE_TAGS.benefitsLists)

    const slugs = [...new Set([...result.changedSlugs, ...result.closedSlugs, ...result.removedSlugs])]
    const bad = slugs.filter((s) => !isSlugLike(s))
    if (bad.length) console.error('[cron/sync] 슬러그 모양이 아닌 값은 비우지 않는다:', bad)
    let invalidated: 'none' | 'per-slug' | 'all' = 'none'
    if (isNewYearKst()) {
      // 상세 제목의 연도(kstYear)는 태그를 비워야 바뀐다. TTL이 일주일이라 손으로 하면 잊는다.
      revalidateTag(CACHE_TAGS.benefitsAll)
      invalidated = 'all'
    } else if (slugs.length > PER_SLUG_LIMIT) {
      revalidateTag(CACHE_TAGS.benefitsAll)
      invalidated = 'all'
    } else if (slugs.length > bad.length) {
      for (const s of slugs) if (isSlugLike(s)) revalidateTag(benefitTag(s))
      invalidated = 'per-slug'
    }

    gov24 = {
      ...result,
      changedSlugs: result.changedSlugs.length,
      closedSlugs: result.closedSlugs.length,
      removedSlugs: result.removedSlugs.length,
      invalidated,
    }
  } catch (err) {
    console.error('[cron/sync] gov24 failed:', err)
    // 중간에 실패하면 이미 upsert된 행이 있어도 어떤 슬러그인지 모른다. 다음 실행은 그 행을 '변경 없음'으로
    // 건너뛰므로 영영 비워지지 않고, TTL은 일주일이다. 실패는 드무니 이때만 전부 비운다.
    revalidateTag(CACHE_TAGS.benefitsHome)
    revalidateTag(CACHE_TAGS.benefitsLists)
    revalidateTag(CACHE_TAGS.benefitsAll)
    // 내부 메시지(DB·외부 API)는 로그에만 남긴다.
    return NextResponse.json({ error: 'sync failed', invalidated: 'all' }, { status: 500 })
  }

  const housing = withHousing ? await housingStep() : null
  return NextResponse.json({ gov24, housing })
}

/** 공고 동기화 + 캐시 무효화. 실패해도 던지지 않는다. */
async function housingStep(): Promise<Record<string, unknown>> {
  try {
    const since = new Date(Date.now() - HOUSING_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    const result: HousingSyncResult = await runHousingSync({
      repo: createHousingRepo(createAdminClient()),
      fetchApplyhome: () => fetchApplyhomeDetails(since),
      fetchUnits: (kind, h, p) => fetchApplyhomeUnits(kind, h, p),
      fetchLh: () => fetchLhNotices(),
    })
    // 목록·홈/my 블록은 매번. 상세는 바뀐 슬러그만(removed 포함 — 내려간 공고 페이지도 갱신돼야 한다).
    revalidateTag(CACHE_TAGS.housingLists)
    const slugs = [...new Set([...result.applyhome.changedSlugs, ...result.applyhome.removedSlugs, ...result.lh.changedSlugs, ...result.lh.removedSlugs])].filter(isSlugLike)
    let invalidated: 'none' | 'per-slug' | 'all' = 'none'
    if (result.applyhome.error || result.lh.error || slugs.length > PER_SLUG_LIMIT) {
      // 소스 하나가 중간에 실패하면 어떤 행이 반영됐는지 모른다(gov24와 같은 이유).
      revalidateTag(CACHE_TAGS.housingAll)
      invalidated = 'all'
    } else if (slugs.length) {
      for (const s of slugs) revalidateTag(housingTag(s))
      invalidated = 'per-slug'
    }
    const brief = (r: HousingSyncResult['applyhome']) => ({ ...r, changedSlugs: r.changedSlugs.length, removedSlugs: r.removedSlugs.length })
    return { applyhome: brief(result.applyhome), lh: brief(result.lh), invalidated }
  } catch (err) {
    console.error('[cron/sync] housing failed:', err)
    revalidateTag(CACHE_TAGS.housingLists)
    revalidateTag(CACHE_TAGS.housingAll)
    return { error: 'housing sync failed', invalidated: 'all' }
  }
}

/** KST 1월 1일인가. cron은 하루 두 번 돌아 둘 다 이 가지를 타지만 비용은 전부 비우기 두 번뿐이다. */
function isNewYearKst(now = new Date()): boolean {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  return kst.getUTCMonth() === 0 && kst.getUTCDate() === 1
}
```

```bash
git rm src/app/api/cron/sync-gov24/route.ts
```

- [ ] **Step 4: vercel.json**

```json
{
  "crons": [
    { "path": "/api/cron/sync?housing=1", "schedule": "0 18 * * *" },
    { "path": "/api/cron/sync?housing=1", "schedule": "0 3 * * *" }
  ]
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/app/api/cron`
Expected: PASS 전부(기존 보조금24 케이스 12건 + 공고 5건). `grep -rn "sync-gov24" src README.md vercel.json`으로 옛 경로 참조가 README만 남았는지 확인한다.

- [ ] **Step 6: README 동기화 절 갱신**

`## 동기화` 절의 `- Vercel Cron: ...` 줄을 다음으로 바꾸고 공고 항목을 덧붙인다:

```markdown
- Vercel Cron: `/api/cron/sync?housing=1` (KST 03:00, 12:00), `Authorization: Bearer $CRON_SECRET`.
  보조금24를 먼저 돌리고 `housing=1`이면 청약홈·LH 공고를 이어서 돌린다. Hobby는 cron이 2개까지라
  라우트를 하나로 합쳤다. 공고 단계의 실패는 응답 200의 `housing.error`에 실리고 보조금24 결과를 가리지 않는다.
  소요 시간이 60초를 위협하면 낮 실행에서 `?housing=1`을 뺀다.
- 공고 수동 적재: `npm run sync:housing` (청약홈 모집공고일 최근 180일 + LH 분양·임대·주거복지·신혼희망타운).
  변경 감지는 원문 해시(`content_hash`)와 날짜로 계산한 상태 비교. 주택형은 바뀐 APT·무순위 공고만 받는다.
  매 실행 `housing:lists`를 비우고 상세는 `housing:{slug}` 태그로 한 장씩. 샘플 응답은 `npm run fixtures:housing`.
```

- [ ] **Step 7: 커밋**

```bash
git add -A src/app/api/cron vercel.json README.md
git commit -m "cron: 보조금24와 공고를 /api/cron/sync 하나로 합친다"
```

배포 뒤 확인: Vercel 대시보드 Cron 탭에 새 경로가 보이고, 다음 실행 로그의 응답이 `{"gov24":{...},"housing":{...}}`인지. 수동으로는 `curl -H "authorization: Bearer $CRON_SECRET" "https://naemok.com/api/cron/sync?housing=1"`.

---

### Task 9: 조회 함수와 라벨

**Files:**
- Create: `src/lib/housing/labels.ts`
- Create: `src/lib/housing/queries.ts`
- Create: `src/lib/housing/__tests__/labels.test.ts`

- [ ] **Step 1: 라벨 테스트**

```ts
// src/lib/housing/__tests__/labels.test.ts
import { describe, it, expect } from 'vitest'
import { KIND_LABEL, STATUS_LABEL, KIND_FILTERS, isHousingKind } from '../labels'

describe('공고 라벨', () => {
  it('모든 종류·상태에 한글 라벨이 있다', () => {
    for (const k of ['apt', 'apt_remainder', 'officetel_etc', 'lh_sale', 'lh_rent', 'lh_welfare', 'newlywed_town'] as const) expect(KIND_LABEL[k]).toBeTruthy()
    for (const s of ['upcoming', 'open', 'closed', 'removed'] as const) expect(STATUS_LABEL[s]).toBeTruthy()
  })
  it('필터 칩은 종류 전부를 한 번씩 덮는다', () => {
    expect(KIND_FILTERS.map((f) => f.kind).sort()).toEqual(Object.keys(KIND_LABEL).sort())
  })
  it('URL에서 온 값은 검사한다', () => {
    expect(isHousingKind('apt')).toBe(true)
    expect(isHousingKind('drop table')).toBe(false)
  })
})
```

- [ ] **Step 2: 라벨 구현**

```ts
// src/lib/housing/labels.ts
import type { HousingKind, HousingStatus } from '@/types/housing'

export const KIND_LABEL: Record<HousingKind, string> = {
  apt: '아파트 분양',
  apt_remainder: '무순위·잔여세대',
  officetel_etc: '오피스텔·도시형·민간임대',
  lh_sale: 'LH 분양',
  lh_rent: 'LH 임대',
  lh_welfare: 'LH 주거복지',
  newlywed_town: '신혼희망타운',
}

export const STATUS_LABEL: Record<HousingStatus, string> = {
  upcoming: '접수 예정',
  open: '접수중',
  closed: '마감',
  removed: '내려감',
}

/** /housing 필터 칩 순서. 청약홈 → LH. */
export const KIND_FILTERS: { kind: HousingKind; label: string }[] = (
  ['apt', 'apt_remainder', 'newlywed_town', 'officetel_etc', 'lh_rent', 'lh_sale', 'lh_welfare'] as const
).map((kind) => ({ kind, label: KIND_LABEL[kind] }))

export function isHousingKind(v: string | null | undefined): v is HousingKind {
  return !!v && Object.prototype.hasOwnProperty.call(KIND_LABEL, v)
}
```

Run: `npx vitest run src/lib/housing/__tests__/labels.test.ts`
Expected: PASS 3건

- [ ] **Step 3: 조회 함수**

```ts
// src/lib/housing/queries.ts
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/server'
import { CACHE_TAGS, housingTag, isSlugLike } from '@/lib/cache-tags'
import type { HousingKind, HousingSource, HousingStatus, HousingUnitTypeRow } from '@/types/housing'
import { REGION_ALL } from '../../../data/regions'

const DAY = 86400
const WEEK = 604800

/** 카드에 필요한 열만. 상세는 getHousingBySlug. */
export interface HousingCardRow {
  slug: string
  title: string
  source: HousingSource
  kind: HousingKind
  kind_detail: string | null
  region_code: string
  status: HousingStatus
  receipt_start: string | null
  receipt_end: string | null
  total_units: number | null
  sp_newlywed_units: number
  sp_first_life_units: number
  sp_multi_child_units: number
  detail_url: string | null
}

const CARD_COLS = 'slug, title, source, kind, kind_detail, region_code, status, receipt_start, receipt_end, total_units, sp_newlywed_units, sp_first_life_units, sp_multi_child_units, detail_url'

export interface HousingDetail extends HousingCardRow {
  address: string | null
  supplier: string | null
  notice_date: string | null
  special_start: string | null
  special_end: string | null
  rank1_start: string | null
  rank1_end: string | null
  rank2_start: string | null
  rank2_end: string | null
  winner_date: string | null
  contract_start: string | null
  contract_end: string | null
  move_in_ym: string | null
  raw: Record<string, unknown>
  synced_at: string
  housing_unit_types: HousingUnitTypeRow[]
}

export type HousingListStatus = 'active' | 'closed'

export interface HousingListInput {
  /** active = 접수중+접수 예정(마감 임박 순), closed = 마감(최근 마감 순). removed는 어디에도 안 나온다. */
  status: HousingListStatus
  kind: HousingKind | null
  /** REGIONS slug. 그 지역 + 전국(ALL)을 함께 낸다. null이면 전체. */
  region: string | null
  limit: number
}

/** 상한. 180일 창의 공고는 수백 건이라 전체를 한 번에 받아도 된다(홈·my 블록이 이 목록을 메모리에서 거른다). */
export const HOUSING_LIST_LIMIT = 500

/**
 * 목록. receipt_end가 null인 LH 공고는 정렬에서 맨 뒤(nullsFirst:false). 상태가 날짜와 어긋나는 공고
 * (동기화 뒤 하루 안에 접수가 시작된 것)는 DB 상태 그대로 낸다 — 다음 동기화가 맞춘다(설계 5절).
 */
export const listHousing = unstable_cache(
  async (input: HousingListInput): Promise<HousingCardRow[]> => {
    // 필터를 다 건 뒤에 정렬·limit을 건다. Supabase 빌더는 limit 뒤에는 필터 메서드가 없다.
    let q = createPublicClient().from('housing_notices').select(CARD_COLS)
    q = input.status === 'active' ? q.in('status', ['open', 'upcoming']) : q.eq('status', 'closed')
    if (input.kind) q = q.eq('kind', input.kind)
    if (input.region) q = q.in('region_code', [input.region, REGION_ALL])
    const { data, error } = await q
      .order('receipt_end', { ascending: input.status === 'active', nullsFirst: false })
      .order('slug')
      .limit(input.limit)
    if (error) throw error
    return (data ?? []) as unknown as HousingCardRow[]
  },
  ['housing-list'],
  { tags: [CACHE_TAGS.housingLists], revalidate: DAY },
)

/** 지역별 접수중+예정 건수(그 지역 전용만, ALL 제외). 색인 판정(housingRegionIndexable)과 사이트맵이 쓴다. */
export const countActiveHousingByRegion = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const { data, error } = await createPublicClient().from('housing_notices').select('region_code').in('status', ['open', 'upcoming']).limit(5000)
    if (error) throw error
    const out: Record<string, number> = {}
    for (const r of data ?? []) {
      const code = r.region_code as string
      if (code === REGION_ALL) continue
      out[code] = (out[code] ?? 0) + 1
    }
    return out
  },
  ['housing-count-by-region'],
  { tags: [CACHE_TAGS.housingLists], revalidate: DAY },
)

/** 상세. generateMetadata와 페이지가 한 요청에서 두 번 불러도 조회는 한 번(React cache). */
export const getHousingBySlug = cache(async (slug: string): Promise<HousingDetail | null> => {
  if (!isSlugLike(slug)) return null
  return unstable_cache(
    async (s: string) => {
      const { data, error } = await createPublicClient()
        .from('housing_notices')
        .select('*, housing_unit_types(*)')
        .eq('slug', s)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const d = data as unknown as HousingDetail
      d.housing_unit_types = [...(d.housing_unit_types ?? [])].sort((a, b) => a.house_type.localeCompare(b.house_type))
      return d
    },
    ['housing-by-slug', slug],
    { tags: [CACHE_TAGS.housingAll, housingTag(slug)], revalidate: WEEK },
  )(slug)
})
```

- [ ] **Step 4: 타입·린트·커밋**

Run: `npx tsc --noEmit && npx eslint src/lib/housing`
Expected: 출력 없음

```bash
git add src/lib/housing
git commit -m "housing: 조회 함수와 라벨"
```

---

### Task 10: 색인 정책·사이트맵·llms.txt

**Files:**
- Modify: `src/lib/seo/index-policy.ts`
- Modify: `src/lib/seo/sitemap-entries.ts`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/llms.txt/route.ts`
- Modify: `src/lib/seo/__tests__/index-policy.test.ts`, `src/lib/seo/__tests__/sitemap-entries.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`index-policy.test.ts`의 import에 `housingRegionIndexable, HOUSING_REGION_MIN_ACTIVE`를 추가하고 describe 하나:

```ts
describe('housingRegionIndexable', () => {
  // 지역 허브와 같은 이유: 공고 두세 건에 지역명만 다른 페이지 17장은 doorway page다.
  it('그 지역 전용 접수중·예정 공고가 임계값 이상일 때만 색인', () => {
    expect(housingRegionIndexable({ activeCount: HOUSING_REGION_MIN_ACTIVE })).toBe(true)
    expect(housingRegionIndexable({ activeCount: HOUSING_REGION_MIN_ACTIVE - 1 })).toBe(false)
  })
})
```

`sitemap-entries.test.ts`의 import에 `housingEntries`를 추가하고:

```ts
describe('housingEntries', () => {
  it('/housing은 항상, 지역은 임계값을 넘는 곳만', () => {
    const urls = housingEntries({ seoul: 12, busan: 2 }).map((e) => e.url)
    expect(urls).toEqual(['https://example.com/housing', 'https://example.com/housing/seoul'])
  })
  it('lastmod를 싣지 않는다', () => {
    expect(housingEntries({ seoul: 12 }).every((e) => e.lastModified === undefined)).toBe(true)
  })
})
```

Run: `npx vitest run src/lib/seo`
Expected: FAIL — export 없음

- [ ] **Step 2: 구현**

`index-policy.ts` 끝에:

```ts
/**
 * 지역별 공고 목록(/housing/[region])의 색인 임계값. 세는 대상은 **그 지역 전용** 접수중·예정 공고다
 * (전국 ALL 제외 — 지역 허브와 같은 doorway page 이유). 공고 상세는 항상 noindex(설계 5절).
 */
export const HOUSING_REGION_MIN_ACTIVE = 5

export function housingRegionIndexable(r: { activeCount: number }): boolean {
  return r.activeCount >= HOUSING_REGION_MIN_ACTIVE
}
```

`sitemap-entries.ts`의 import에 `housingRegionIndexable`을 추가하고 `REGIONS`를 import(`import { REGIONS } from '../../../data/regions'`), 함수 추가:

```ts
/** /housing과 색인 조건을 넘긴 지역 목록. 공고 상세는 넣지 않는다. lastmod 없음(정적·허브와 같은 이유). */
export function housingEntries(activeByRegion: Record<string, number>): Entry[] {
  return [
    { url: absoluteUrl('/housing'), changeFrequency: 'daily', priority: 0.8 },
    ...REGIONS.filter((r) => housingRegionIndexable({ activeCount: activeByRegion[r.slug] ?? 0 })).map((r) => ({
      url: absoluteUrl(`/housing/${r.slug}`),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  ]
}
```

`src/app/sitemap.ts`: import에 `import { countActiveHousingByRegion } from '@/lib/housing/queries'`와 `housingEntries`를 추가하고 `hubSitemap`의 `Promise.all`에 `countActiveHousingByRegion()`을 여섯 번째로 넣는다:

```ts
  const [regionsRes, countsPerSegment, guides, compareGroups, explainedPerSegment, housingByRegion] = await Promise.all([
    createPublicClient().from('regions').select('slug, description_md'),
    Promise.all(PUBLIC_SEGMENTS.map((s) => countByRegion(s.slug))),
    listPublishedGuides(),
    listCompareKeys(),
    Promise.all(PUBLIC_SEGMENTS.map((s) => listWithArticles(s.slug, HUB_EXPLAINED_LIMIT))),
    countActiveHousingByRegion(),
  ])
```

return 문에 `...housingEntries(housingByRegion)`을 덧붙인다.

`src/app/llms.txt/route.ts`의 `'## 찾기'` 블록 끝(중위소득 계산기 줄 뒤)에:

```ts
    line('청약·임대 공고(접수중·접수 예정)', '/housing'),
```

- [ ] **Step 3: 통과·커밋**

Run: `npx vitest run src/lib/seo src/app/__tests__ && npx tsc --noEmit`
Expected: PASS, 출력 없음

```bash
git add src/lib/seo src/app/sitemap.ts src/app/llms.txt/route.ts
git commit -m "housing: 지역 목록 색인 정책과 사이트맵"
```

---

### Task 11: 카드·목록·상세 컴포넌트

**Files:**
- Create: `src/components/housing/HousingCard.tsx`
- Create: `src/components/housing/HousingList.tsx`
- Create: `src/components/housing/HousingSchedule.tsx`
- Create: `src/components/housing/UnitTypeTable.tsx`
- Create: `src/components/housing/__tests__/HousingCard.test.tsx`

- [ ] **Step 1: 카드 테스트**

```tsx
// src/components/housing/__tests__/HousingCard.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HousingCard from '../HousingCard'
import type { HousingCardRow } from '@/lib/housing/queries'

const now = new Date('2026-01-20T03:00:00Z') // KST 1/20

const base: HousingCardRow = {
  slug: '래미안-테스트', title: '래미안 테스트', source: 'applyhome', kind: 'apt', kind_detail: '민영', region_code: 'seoul', status: 'open',
  receipt_start: '2026-01-19', receipt_end: '2026-01-25', total_units: 320, sp_newlywed_units: 20, sp_first_life_units: 0, sp_multi_child_units: 3, detail_url: 'https://example.com',
}

beforeEach(() => vi.useFakeTimers({ now, toFake: ['Date'] }))
afterEach(() => vi.useRealTimers())

describe('HousingCard', () => {
  it('청약홈 접수중 공고는 D-day·지역·종류·세대수와 특별공급 배지를 내고 상세로 링크한다', () => {
    render(<HousingCard row={base} now={now} />)
    expect(screen.getByText('D-5')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    expect(screen.getByText('아파트 분양')).toBeInTheDocument()
    expect(screen.getByText(/320세대/)).toBeInTheDocument()
    expect(screen.getByText('신혼부부 특공')).toBeInTheDocument()
    expect(screen.getByText('다자녀 특공')).toBeInTheDocument()
    expect(screen.queryByText('생애최초 특공')).toBeNull() // 0세대면 배지 없음
    expect(screen.getByRole('link', { name: '래미안 테스트' })).toHaveAttribute('href', '/housing/래미안-테스트')
  })

  it('접수 예정은 시작까지 남은 날을 낸다', () => {
    render(<HousingCard row={{ ...base, status: 'upcoming', receipt_start: '2026-01-23' }} now={now} />)
    expect(screen.getByText('D-3 접수 시작')).toBeInTheDocument()
  })

  // LH는 API가 일정을 주지 않는다. 상세 페이지도 없어 원문으로 바로 보낸다(설계 5절).
  it('LH 공고는 상태 라벨과 원문 링크만 낸다', () => {
    render(<HousingCard row={{ ...base, source: 'lh', kind: 'lh_rent', kind_detail: '행복주택', receipt_start: null, receipt_end: null, total_units: null, sp_newlywed_units: 0, sp_multi_child_units: 0, detail_url: 'https://apply.lh.or.kr/x' }} now={now} />)
    expect(screen.getByText('접수중')).toBeInTheDocument()
    expect(screen.getByText('행복주택')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /래미안 테스트/ })
    expect(link).toHaveAttribute('href', 'https://apply.lh.or.kr/x')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('마감은 회색 라벨', () => {
    render(<HousingCard row={{ ...base, status: 'closed', receipt_end: '2026-01-10' }} now={now} />)
    expect(screen.getByText('마감')).toBeInTheDocument()
    expect(screen.queryByText(/D-/)).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/housing`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 카드·목록 구현**

```tsx
// src/components/housing/HousingCard.tsx
import Link from 'next/link'
import type { HousingCardRow } from '@/lib/housing/queries'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/housing/labels'
import { regionName } from '@/components/benefits/BenefitCard'
import DdayBadge from '@/components/benefits/DdayBadge'
import { daysUntil } from '@/lib/benefits/status'

/**
 * 공고 카드. 청약홈은 상세(/housing/[slug])로, LH는 API가 일정·세대수를 주지 않아 상세 없이 LH 원문으로 보낸다.
 *
 * D-day: 접수중은 지원금 카드와 같은 DdayBadge(클라이언트에서 다시 센다). 접수 예정은 "D-n 접수 시작"을
 * 서버에서 찍는다 — 목록은 하루 ISR + cron이 매일 housing:lists를 비우므로 하루 이상 어긋나지 않는다.
 */
export default function HousingCard({ row, now }: { row: HousingCardRow; now?: Date }) {
  const external = row.source === 'lh'
  const href = external ? row.detail_url ?? '#' : `/housing/${row.slug}`
  const badges = [
    row.sp_newlywed_units > 0 && '신혼부부 특공',
    row.sp_first_life_units > 0 && '생애최초 특공',
    row.sp_multi_child_units > 0 && '다자녀 특공',
  ].filter((b): b is string => !!b)

  return (
    <article className="relative flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm focus-within:border-brand-400">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <StatusBadge row={row} now={now} />
        <span className="text-xs text-gray-500">{regionName(row.region_code === 'UNKNOWN' ? '' : row.region_code) || '지역 미상'}</span>
        <span aria-hidden className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500">{KIND_LABEL[row.kind]}</span>
      </div>
      <h3 className="text-base font-semibold leading-snug">
        {external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="after:absolute after:inset-0 after:rounded-xl hover:text-brand-700">
            {row.title} <span aria-hidden className="text-gray-400">↗</span>
          </a>
        ) : (
          <Link href={href} className="after:absolute after:inset-0 after:rounded-xl hover:text-brand-700">
            {row.title}
          </Link>
        )}
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        {[row.kind_detail, row.total_units ? `${row.total_units.toLocaleString()}세대` : null].filter(Boolean).join(' · ')}
      </p>
      {badges.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="특별공급">
          {badges.map((b) => (
            <li key={b} className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">{b}</li>
          ))}
        </ul>
      )}
    </article>
  )
}

function StatusBadge({ row, now }: { row: HousingCardRow; now?: Date }) {
  if (row.status === 'open' && row.receipt_end) return <DdayBadge deadline_type="period" apply_end={row.receipt_end} now={now} />
  if (row.status === 'upcoming' && row.receipt_start) {
    const d = daysUntil(row.receipt_start, now)
    return <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">{d !== null && d > 0 ? `D-${d} 접수 시작` : '접수 예정'}</span>
  }
  const tone = row.status === 'open' ? 'bg-brand-50 text-brand-700' : row.status === 'upcoming' ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>{STATUS_LABEL[row.status]}</span>
}
```

`regionName('')`은 `REGION_NAME['']`이 없어 `''`를 돌려주므로 `|| '지역 미상'`이 걸린다.

```tsx
// src/components/housing/HousingList.tsx
import type { HousingCardRow } from '@/lib/housing/queries'
import HousingCard from './HousingCard'

/** 카드 격자. 광고는 싣지 않는다(허용 목록: adsense-scope.test.ts). */
export default function HousingList({ rows, now, emptyText = '해당하는 공고가 없습니다.' }: { rows: HousingCardRow[]; now?: Date; emptyText?: string }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">{emptyText}</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => <HousingCard key={r.slug} row={r} now={now} />)}
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/housing`
Expected: PASS 4건

- [ ] **Step 5: 일정표·주택형표**

```tsx
// src/components/housing/HousingSchedule.tsx
import type { HousingDetail } from '@/lib/housing/queries'

const dots = (d: string | null) => (d ? d.replace(/-/g, '.') : null)
const range = (a: string | null, b: string | null) => (a && b && a !== b ? `${dots(a)} ~ ${dots(b)}` : dots(a ?? b))

/** 청약홈 공고의 일정. 값이 없는 줄은 내지 않는다 — 빈 칸이 "미정"처럼 읽힌다. */
export default function HousingSchedule({ d }: { d: HousingDetail }) {
  const rows: [string, string | null][] = [
    ['모집공고일', dots(d.notice_date)],
    ['특별공급 접수', range(d.special_start, d.special_end)],
    ['1순위 접수', range(d.rank1_start, d.rank1_end)],
    ['2순위 접수', range(d.rank2_start, d.rank2_end)],
    ['당첨자 발표', dots(d.winner_date)],
    ['계약', range(d.contract_start, d.contract_end)],
    ['입주 예정', d.move_in_ym ? `${d.move_in_ym.slice(0, 4)}년 ${Number(d.move_in_ym.slice(4, 6))}월` : null],
  ]
  const shown = rows.filter((r): r is [string, string] => !!r[1])
  if (!shown.length) return null
  return (
    <dl className="divide-y rounded-xl border bg-white text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 p-3">
          <dt className="text-gray-500">{k}</dt>
          <dd className="font-medium tabular-nums text-gray-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
```

```tsx
// src/components/housing/UnitTypeTable.tsx
import type { HousingUnitTypeRow } from '@/types/housing'

const won = (n: number | null) => (n == null ? '-' : `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}억`)
const num = (n: number | null) => (n == null ? '-' : n.toLocaleString())

/** 주택형별 면적·최고 분양가·세대수. 분양가는 만원 단위 원문을 억으로 보여준다(98000 → 9.8억). */
export default function UnitTypeTable({ rows }: { rows: HousingUnitTypeRow[] }) {
  if (!rows.length) return null
  const anySpecial = rows.some((r) => (r.special_units ?? 0) > 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">주택형별 공급 내역</caption>
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">주택형</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">공급면적(㎡)</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">최고 분양가</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">일반</th>
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">특별</th>}
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">신혼</th>}
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">생애최초</th>}
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">다자녀</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.house_type} className="border-b border-gray-100">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-gray-900">{r.house_type}</th>
              <td className="py-2 pr-3 text-right tabular-nums">{r.supply_area ?? '-'}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{won(r.max_price_manwon)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{num(r.general_units)}</td>
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.special_units)}</td>}
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.sp_newlywed)}</td>}
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.sp_first_life)}</td>}
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.sp_multi_child)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-500">분양가는 주택형별 최고가(청약홈 원문, 만원 단위를 억으로 환산). 실제 금액은 모집공고문을 확인하세요.</p>
    </div>
  )
}
```

- [ ] **Step 6: 커밋**

Run: `npx tsc --noEmit && npx eslint src/components/housing`

```bash
git add src/components/housing
git commit -m "housing: 카드·목록·일정표·주택형표"
```

---

### Task 12: 페이지 — 목록·지역/상세 분기·오류

**Files:**
- Create: `src/app/(site)/housing/page.tsx`
- Create: `src/app/(site)/housing/[slug]/page.tsx`
- Create: `src/app/(site)/housing/error.tsx`
- Modify: `src/app/__tests__/adsense-scope.test.ts` (추가 작업 없음 — 허용 목록이 새 라우트를 자동으로 검사한다. 실행해서 확인만)

- [ ] **Step 1: 목록 페이지**

```tsx
// src/app/(site)/housing/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { listHousing, HOUSING_LIST_LIMIT, type HousingListStatus } from '@/lib/housing/queries'
import { KIND_FILTERS, isHousingKind } from '@/lib/housing/labels'
import { kstYear } from '@/lib/seo/hub-meta'
import { absoluteUrl } from '@/lib/seo/site'
import { breadcrumbs } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import HousingList from '@/components/housing/HousingList'
import { REGIONS } from '../../../../data/regions'

export const revalidate = 86400 // 하루. 변경은 cron이 housing:lists로 매일 비운다

type SP = Promise<Record<string, string | string[] | undefined>>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function parse(sp: Record<string, string | string[] | undefined>) {
  const status: HousingListStatus = first(sp.status) === 'closed' ? 'closed' : 'active'
  const k = first(sp.kind)
  return { status, kind: isHousingKind(k) ? k : null }
}

/** 필터를 건 주소는 색인하지 않는다(/benefits와 같은 이유). 기본 목록 하나만 색인. */
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { status, kind } = parse(await searchParams)
  const isDefault = status === 'active' && !kind
  return {
    title: `${kstYear()} 청약·임대 공고 모음 · 접수중·접수 예정`,
    description: '청약홈 아파트·무순위·오피스텔 분양 공고와 LH 임대·분양 공고를 접수 일정 순으로 모았습니다. 지역별로 보고 특별공급 유형을 확인하세요.',
    ...(isDefault ? { alternates: { canonical: absoluteUrl('/housing') } } : { alternates: { canonical: null }, robots: { index: false, follow: true } }),
  }
}

const href = (q: { status?: string; kind?: string | null }) => {
  const p = new URLSearchParams()
  if (q.status === 'closed') p.set('status', 'closed')
  if (q.kind) p.set('kind', q.kind)
  const s = p.toString()
  return s ? `/housing?${s}` : '/housing'
}

const chip = (active: boolean) =>
  `inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-sm ${active ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'}`

export default async function HousingPage({ searchParams }: { searchParams: SP }) {
  const { status, kind } = parse(await searchParams)
  const now = new Date()
  const rows = await listHousing({ status, kind, region: null, limit: HOUSING_LIST_LIMIT })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '청약·임대 공고', path: '/housing' }])} />
      <nav className="text-xs text-gray-500" aria-label="현재 위치"><Link href="/" className="hover:underline">홈</Link> › 청약·임대 공고</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">청약·임대 공고</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        청약홈(한국부동산원)과 LH의 분양·임대 공고를 접수 일정 순으로 모았습니다. 자격·금액은 각 공고문이 기준이며, 여기서는 일정과 공급 내역만 정리합니다.
      </p>

      <nav aria-label="접수 상태" className="mt-5 flex gap-2">
        <Link href={href({ kind })} aria-current={status === 'active' ? 'page' : undefined} className={chip(status === 'active')}>접수중·예정</Link>
        <Link href={href({ status: 'closed', kind })} aria-current={status === 'closed' ? 'page' : undefined} className={chip(status === 'closed')}>마감</Link>
      </nav>

      <nav aria-label="종류" className="-mx-4 mt-3 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li><Link href={href({ status })} aria-current={!kind ? 'page' : undefined} className={chip(!kind)}>전체</Link></li>
          {KIND_FILTERS.map((f) => (
            <li key={f.kind}><Link href={href({ status, kind: f.kind })} aria-current={kind === f.kind ? 'page' : undefined} className={chip(kind === f.kind)}>{f.label}</Link></li>
          ))}
        </ul>
      </nav>

      <p className="mt-5 mb-3 text-sm text-gray-600"><b className="font-semibold text-gray-900">{rows.length.toLocaleString()}건</b></p>
      <HousingList rows={rows} now={now} emptyText={status === 'active' ? '지금 접수 중이거나 예정된 공고가 없습니다.' : '최근 마감된 공고가 없습니다.'} />

      <section className="mt-10 border-t pt-6" aria-label="지역별로 보기">
        <h2 className="text-base font-bold">지역별로 보기</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {REGIONS.map((r) => (
            <li key={r.slug}><Link href={`/housing/${r.slug}`} className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 hover:border-brand-400">{r.name}</Link></li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-gray-500">데이터 출처: 한국부동산원 청약홈 분양정보, 한국토지주택공사 분양임대공고 (공공데이터포털). 매일 두 번 동기화합니다.</p>
    </div>
  )
}
```

- [ ] **Step 2: 지역/상세 분기 페이지**

```tsx
// src/app/(site)/housing/[slug]/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listHousing, getHousingBySlug, countActiveHousingByRegion, HOUSING_LIST_LIMIT } from '@/lib/housing/queries'
import { housingRegionIndexable } from '@/lib/seo/index-policy'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/housing/labels'
import { kstYear } from '@/lib/seo/hub-meta'
import { absoluteUrl } from '@/lib/seo/site'
import { breadcrumbs } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import HousingList from '@/components/housing/HousingList'
import HousingSchedule from '@/components/housing/HousingSchedule'
import UnitTypeTable from '@/components/housing/UnitTypeTable'
import DdayBadge from '@/components/benefits/DdayBadge'
import { regionName } from '@/components/benefits/BenefitCard'
import { REGIONS } from '../../../../../data/regions'

/**
 * /housing/[slug]는 두 종류를 받는다 — REGIONS의 영문 slug면 지역 목록, 아니면 공고 상세.
 * 공고 slug는 housingSlugBase가 지역 slug와 겹치지 않게 만든다(sync/housing-normalize.ts).
 *
 * ISR은 두 종류 중 짧은 쪽(지역 목록, 하루)으로 맞춘다. 상세의 조회 캐시는 일주일(housing:<slug>)이라
 * 페이지가 하루마다 다시 그려져도 DB는 건드리지 않는다.
 */
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return REGIONS.map((r) => ({ slug: r.slug }))
}

const region = (slug: string) => REGIONS.find((r) => r.slug === slug) ?? null

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug)
  const reg = region(slug)
  if (reg) {
    const counts = await countActiveHousingByRegion()
    return {
      title: `${kstYear()} ${reg.name} 청약·임대 공고 · 접수중·접수 예정`,
      description: `${reg.name}에서 접수 중이거나 예정된 아파트 분양·무순위·LH 임대 공고를 접수 일정 순으로 모았습니다. 전국 공통 공고도 함께 보여줍니다.`,
      alternates: { canonical: absoluteUrl(`/housing/${reg.slug}`) },
      robots: { index: housingRegionIndexable({ activeCount: counts[reg.slug] ?? 0 }), follow: true },
    }
  }
  const d = await getHousingBySlug(slug)
  if (!d) return {}
  return {
    title: `${d.title} 청약 일정·공급 내역`,
    description: [KIND_LABEL[d.kind], regionName(d.region_code), d.total_units ? `${d.total_units}세대` : null, d.receipt_start ? `접수 ${d.receipt_start.replace(/-/g, '.')}부터` : null].filter(Boolean).join(' · '),
    alternates: { canonical: absoluteUrl(`/housing/${d.slug}`) },
    // 공고 상세는 원문을 옮긴 페이지라 색인하지 않는다(설계 5절). 해설이 붙으면 그때 연다.
    robots: { index: false, follow: true },
  }
}

export default async function HousingSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug)
  const reg = region(slug)
  if (reg) return <RegionPage slug={reg.slug} name={reg.name} />
  const d = await getHousingBySlug(slug)
  if (!d) notFound()
  const now = new Date()
  const closed = d.status === 'closed' || d.status === 'removed'

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '청약·임대 공고', path: '/housing' }, { name: d.title, path: `/housing/${d.slug}` }])} />
      <nav className="text-xs text-gray-500" aria-label="현재 위치">
        <Link href="/" className="hover:underline">홈</Link> › <Link href="/housing" className="hover:underline">청약·임대 공고</Link>
        {d.region_code !== 'ALL' && d.region_code !== 'UNKNOWN' && <> › <Link href={`/housing/${d.region_code}`} className="hover:underline">{regionName(d.region_code)}</Link></>}
      </nav>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{d.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
        {d.status === 'open' && d.receipt_end ? <DdayBadge deadline_type="period" apply_end={d.receipt_end} now={now} /> : <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">{STATUS_LABEL[d.status]}</span>}
        <span>{regionName(d.region_code === 'UNKNOWN' ? '' : d.region_code) || '지역 미상'}</span>
        <span>· {KIND_LABEL[d.kind]}</span>
        {d.kind_detail && <span>· {d.kind_detail}</span>}
      </div>

      {closed && (
        <div className="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
          이 공고는 접수가 끝났거나 원천에서 내려갔습니다. <Link href="/housing" className="font-semibold text-brand-700 hover:underline">접수 중인 공고 보기 →</Link>
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-bold">한눈에 보기</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {d.total_units != null && <div className="rounded-xl border bg-white p-3"><dt className="text-gray-500">공급 세대</dt><dd className="mt-0.5 font-semibold">{d.total_units.toLocaleString()}세대</dd></div>}
          {d.address && <div className="col-span-2 rounded-xl border bg-white p-3 sm:col-span-2"><dt className="text-gray-500">위치</dt><dd className="mt-0.5 font-semibold">{d.address}</dd></div>}
          {d.supplier && <div className="rounded-xl border bg-white p-3"><dt className="text-gray-500">사업주체</dt><dd className="mt-0.5 font-semibold">{d.supplier}</dd></div>}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-bold">일정</h2>
        <HousingSchedule d={d} />
        <p className="mt-2 text-xs text-gray-500">1·2순위는 해당지역·기타지역 접수일 중 가장 이른 날부터 가장 늦은 날까지로 표시합니다. 정확한 일정은 모집공고문을 확인하세요.</p>
      </section>

      {d.housing_unit_types.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-bold">주택형별 공급 내역</h2>
          <UnitTypeTable rows={d.housing_unit_types} />
        </section>
      )}

      <footer className="mt-8 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
        <p>출처: 한국부동산원 청약홈 분양정보(공공데이터포털) · 최종 확인 {d.synced_at.slice(0, 10).replace(/-/g, '.')}</p>
        {d.detail_url && (
          <p className="mt-1"><a href={d.detail_url} target="_blank" rel="noopener noreferrer" className="underline">공고 원문·사업주체 홈페이지 보기</a></p>
        )}
        <p className="mt-1">청약 신청은 <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer" className="underline">청약홈</a>에서 합니다. 이 페이지는 일정과 공급 내역만 정리하며 자격을 판정하지 않습니다.</p>
      </footer>
    </div>
  )
}

async function RegionPage({ slug, name }: { slug: string; name: string }) {
  const now = new Date()
  const [rows, counts] = await Promise.all([listHousing({ status: 'active', kind: null, region: slug, limit: HOUSING_LIST_LIMIT }), countActiveHousingByRegion()])
  const local = rows.filter((r) => r.region_code === slug)
  const national = rows.filter((r) => r.region_code === 'ALL')
  const siblings = REGIONS.filter((r) => (counts[r.slug] ?? 0) > 0)
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '청약·임대 공고', path: '/housing' }, { name, path: `/housing/${slug}` }])} />
      <nav className="text-xs text-gray-500" aria-label="현재 위치"><Link href="/" className="hover:underline">홈</Link> › <Link href="/housing" className="hover:underline">청약·임대 공고</Link> › {name}</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{name} 청약·임대 공고 <span className="text-lg font-semibold text-gray-500">{local.length}건</span></h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">{name}에서 접수 중이거나 예정된 공고입니다. 전국 어디서나 신청할 수 있는 공고는 아래에 따로 보여줍니다.</p>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">{name} 공고</h2>
        <HousingList rows={local} now={now} emptyText={`지금 접수 중인 ${name} 공고가 없습니다. 아래 전국 공통 공고를 확인하세요.`} />
      </section>

      {national.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">전국 공통 공고 <span className="text-sm font-normal text-gray-500">{national.length}건</span></h2>
          <HousingList rows={national} now={now} />
        </section>
      )}

      {siblings.length > 1 && (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">다른 지역</h2>
          <nav className="flex flex-wrap gap-2" aria-label="다른 지역 공고">
            {siblings.map((r) =>
              r.slug === slug ? (
                <span key={r.slug} aria-current="page" className="rounded-full border border-brand-600 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800">{r.name}</span>
              ) : (
                <Link key={r.slug} href={`/housing/${r.slug}`} className="rounded-full border bg-white px-3 py-1.5 text-sm hover:border-brand-400">{r.name} <span className="text-gray-400">{counts[r.slug]}</span></Link>
              ),
            )}
          </nav>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 오류 화면**

```tsx
// src/app/(site)/housing/error.tsx
'use client'

import Link from 'next/link'

/** Supabase 조회 실패 등. 공고 데이터는 원문이 따로 있으니 그리로 보낸다. */
export default function HousingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-extrabold">공고를 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-gray-600">잠시 후 다시 시도해 주세요. 급하면 청약홈과 LH 청약플러스에서 직접 확인할 수 있습니다.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">다시 시도</button>
        <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm hover:border-brand-400">청약홈</a>
        <a href="https://apply.lh.or.kr" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm hover:border-brand-400">LH 청약플러스</a>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm hover:border-brand-400">홈</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 검사**

Run: `npx tsc --noEmit && npx eslint 'src/app/(site)/housing' && npx vitest run src/app/__tests__/adsense-scope.test.ts`
Expected: 출력 없음, 광고 범위 테스트 PASS(새 페이지 3개가 자동으로 "광고 관련 코드가 없다" 검사를 받는다)

- [ ] **Step 5 (데이터 있을 때): 화면 확인**

Run: `npx next dev --turbopack` 후 브라우저에서 `/housing`, `/housing/seoul`, 목록 카드 하나의 상세, `/housing/없는-슬러그`(404 한국어), `/housing?status=closed&kind=apt`. 모바일 폭(390px)에서 종류 칩이 가로 스크롤되고 주택형 표가 가로 스크롤 안에 있는지 본다. 끝나면 dev 서버를 끈다(build와 .next 공유).

- [ ] **Step 6: 커밋**

```bash
git add 'src/app/(site)/housing'
git commit -m "housing: 목록·지역·상세 페이지"
```

---

### Task 13: 홈·진단 결과 블록, 메뉴, 링크

**Files:**
- Create: `src/components/housing/MyHousingBlock.tsx`
- Create: `src/components/housing/__tests__/MyHousingBlock.test.tsx`
- Modify: `src/app/(site)/my/page.tsx`
- Modify: `src/app/(site)/page.tsx`
- Modify: `src/components/layout/nav-links.ts`
- Modify: `src/app/(site)/benefits/page.tsx` ("다른 방법으로 찾기")

- [ ] **Step 1: 블록 테스트**

```tsx
// src/components/housing/__tests__/MyHousingBlock.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MyHousingBlock from '../MyHousingBlock'
import type { HousingCardRow } from '@/lib/housing/queries'
import { STORAGE_KEY } from '@/lib/diagnosis/storage'

const row = (slug: string, region_code: string): HousingCardRow => ({
  slug, title: slug, source: 'applyhome', kind: 'apt', kind_detail: null, region_code, status: 'open', receipt_start: '2026-01-19', receipt_end: '2026-01-25', total_units: 100, sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0, detail_url: null,
})
const rows = [row('서울1', 'seoul'), row('서울2', 'seoul'), row('부산1', 'busan'), row('전국1', 'ALL'), row('서울3', 'seoul'), row('서울4', 'seoul'), row('서울5', 'seoul')]

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-20T03:00:00Z'), toFake: ['Date'] })
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

describe('MyHousingBlock', () => {
  it('진단 지역이 있으면 그 지역 + 전국만, 최대 4건, 지역 목록으로 링크', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: '', ageBand: null, situations: [], region: 'seoul', incomeBand: null }))
    render(<MyHousingBlock rows={rows} />)
    await waitFor(() => expect(screen.getByText('서울 청약·임대 공고')).toBeInTheDocument())
    expect(screen.queryByText('부산1')).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByRole('link', { name: /서울 공고 전체 보기/ })).toHaveAttribute('href', '/housing/seoul')
  })

  it('지역이 없으면 전국 접수중 4건과 /housing 링크', async () => {
    render(<MyHousingBlock rows={rows} />)
    await waitFor(() => expect(screen.getByText('접수 중인 청약·임대 공고')).toBeInTheDocument())
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByRole('link', { name: /공고 전체 보기/ })).toHaveAttribute('href', '/housing')
  })

  // 빈 제목만 남은 섹션은 내용 없는 화면으로 보인다(홈의 마감 임박 섹션과 같은 규칙).
  it('해당 공고가 0건이면 블록을 내지 않는다', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: '', ageBand: null, situations: [], region: 'jeju', incomeBand: null }))
    const { container } = render(<MyHousingBlock rows={[row('부산1', 'busan')]} />)
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/housing/__tests__/MyHousingBlock.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 블록 구현**

```tsx
// src/components/housing/MyHousingBlock.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { HousingCardRow } from '@/lib/housing/queries'
import { readDiagnosis } from '@/lib/diagnosis/storage'
import { REGION_OPTIONS } from '@/lib/diagnosis/options'
import HousingCard from './HousingCard'

const SHOW = 4

/**
 * 진단 결과(/my)의 "내 지역 공고". 진단 조건은 localStorage에만 있어 서버가 모른다. 서버가 접수중·예정
 * 공고 전체(수백 건, housing:lists 캐시)를 내려주면 여기서 지역으로 거른다 — API를 한 번 더 부르지 않는다.
 * 상황 값(신혼·자녀)은 쓰지 않는다. 자격 판정이 아니라 배지(HousingCard)로만 보인다(설계 1절).
 *
 * 첫 렌더는 null이다(서버와 같은 HTML). 마운트 뒤 localStorage를 읽어 그린다.
 */
export default function MyHousingBlock({ rows }: { rows: HousingCardRow[] }) {
  const [region, setRegion] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    setRegion(readDiagnosis().region)
  }, [])
  if (region === undefined) return null

  const picked = (region ? rows.filter((r) => r.region_code === region || r.region_code === 'ALL') : rows.filter((r) => r.status === 'open')).slice(0, SHOW)
  if (!picked.length) return null
  const name = region ? REGION_OPTIONS.find((o) => o.value === region)?.label ?? null : null

  return (
    <section className="mt-10" aria-labelledby="my-housing-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="my-housing-heading" className="text-xl font-bold">{name ? `${name} 청약·임대 공고` : '접수 중인 청약·임대 공고'}</h2>
        <Link href={region ? `/housing/${region}` : '/housing'} className="text-sm text-brand-700 hover:underline">{name ? `${name} 공고 전체 보기` : '공고 전체 보기'} →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {picked.map((r) => <HousingCard key={r.slug} row={r} />)}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/housing`
Expected: PASS

- [ ] **Step 5: /my 페이지에 붙이기**

`src/app/(site)/my/page.tsx`를 다음으로 바꾼다:

```tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import DiagnosisResults from '@/components/diagnosis/DiagnosisResults'
import MyHousingBlock from '@/components/housing/MyHousingBlock'
import { listHousing, HOUSING_LIST_LIMIT } from '@/lib/housing/queries'

// 개인화 화면이라 서버가 만들 안정적인 본문이 없다. 색인 대상에서 제외한다.
export const metadata: Metadata = {
  title: '내 진단 결과',
  robots: { index: false, follow: true },
}

// 접수중·예정 공고 목록(housing:lists)만 서버에서 읽는다. 진단 값은 브라우저에 있어 거르기는 클라이언트가 한다.
export const revalidate = 86400

export default async function MyPage() {
  const housing = await listHousing({ status: 'active', kind: null, region: null, limit: HOUSING_LIST_LIMIT })
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="mb-4 text-2xl font-extrabold">내 지원금</h1>
      {/* DiagnosisResults가 useSearchParams를 쓴다. 경계가 없으면 이 페이지 전체가
          정적 생성에서 빠진다. 폴백 높이는 컴포넌트의 첫 렌더와 맞춰 화면이 튀지 않게 한다. */}
      <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>}>
        <DiagnosisResults />
      </Suspense>
      <MyHousingBlock rows={housing} />
    </div>
  )
}
```

- [ ] **Step 6: 홈 섹션**

`src/app/(site)/page.tsx`에 import 두 줄:

```tsx
import HousingCard from '@/components/housing/HousingCard'
import { listHousing } from '@/lib/housing/queries'
```

`Promise.all`에 일곱 번째 항목 `listHousing({ status: 'active', kind: null, region: null, limit: 4 })`를 넣고 결과를 `housing`으로 받는다:

```tsx
  const [soon, recent, fresh, lastSync, explainedAll, guides, housing] = await Promise.all([
    listDeadlineSoon(14, 8),
    listRecentlyUpdated(48, 8),
    listRecentlyCreated(14, 8),
    getLastSyncAt(),
    listWithArticles(null, HOME_EXPLAINED + 1),
    listGuides(),
    listHousing({ status: 'active', kind: null, region: null, limit: 4 }),
  ])
```

"새로 등록된 지원금" 섹션 바로 뒤에:

```tsx
      {/* 공고는 매일 바뀌어 홈을 살아 있게 한다. 0건인 날(연휴)은 섹션을 내지 않는다. */}
      {housing.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">접수 중인 청약·임대 공고</h2>
            <Link href="/housing" className="text-sm text-brand-700 hover:underline">전체 보기</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {housing.map((r) => <HousingCard key={r.slug} row={r} now={now} />)}
          </div>
        </section>
      )}
```

- [ ] **Step 7: 메뉴와 링크**

`src/components/layout/nav-links.ts`:

```ts
export const MAIN_NAV: NavLink[] = [
  { href: '/', label: '홈' },
  { href: '/benefits', label: '지원금 찾기' },
  { href: '/housing', label: '청약·임대' },
  { href: '/guide', label: '가이드' },
  { href: '/median-income', label: '중위소득 계산기' },
]

export const MAIN_NAV_SHORT: NavLink[] = [
  { href: '/benefits', label: '지원금 찾기' },
  { href: '/housing', label: '청약·임대' },
  { href: '/guide', label: '가이드' },
  { href: '/median-income', label: '계산기' },
]
```

`src/app/(site)/benefits/page.tsx`의 "다른 방법으로 찾기" `<ul>` 첫 항목 앞에:

```tsx
          <li><Link href="/housing" className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 hover:border-brand-400">청약·임대 공고</Link></li>
```

- [ ] **Step 8: 전체 검사**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: 전부 PASS. `nav-links` 관련 기존 테스트(`src/components/layout/__tests__` 또는 `MobileMenu` 테스트)가 메뉴 개수를 고정하고 있으면 기대값에 '청약·임대'를 추가한다.

- [ ] **Step 9: 커밋**

```bash
git add src/components/housing 'src/app/(site)/my/page.tsx' 'src/app/(site)/page.tsx' src/components/layout/nav-links.ts 'src/app/(site)/benefits/page.tsx'
git commit -m "housing: 홈·진단 결과 블록과 메뉴"
```

---

### Task 14: README·env·빌드·배포 확인

**Files:**
- Modify: `README.md` (페이지 표·캐시 TTL 표), `.env.local.example`

- [ ] **Step 1: env 예시**

`.env.local.example`의 `GOV24_API_KEY=` 아래에:

```
# 청약홈·LH 공고 API 키(공공데이터포털 일반 인증키 Decoding). 비우면 GOV24_API_KEY를 쓴다(같은 계정이면 같은 값).
HOUSING_API_KEY=
```

- [ ] **Step 2: README 페이지 표**

`## 페이지` 표의 `/guide/{slug}` 줄 뒤에:

```markdown
| `/housing` | 청약홈·LH 공고 목록. 탭 접수중·예정/마감, 종류 필터(필터 주소는 noindex) | 기본 주소만 O |
| `/housing/{region}` | 지역별 공고(그 지역 전용 접수중·예정 5건 이상일 때만, `HOUSING_REGION_MIN_ACTIVE`) | 조건부 |
| `/housing/{slug}` | 청약홈 공고 상세(일정·세대수·주택형). LH는 상세 없이 원문으로. 광고 없음 | X |
```

`## 캐시 TTL과 비용` 절의 표에:

```markdown
| 공고 목록·지역 집계·홈/my 블록 | `housing:lists` | 하루 | cron이 매번 비운다 |
| 공고 상세 | `housing:{slug}` (+`housing:all`) | 일주일 | 바뀐 공고만. D-day는 DdayBadge가 브라우저에서 센다 |
```

- [ ] **Step 3: 프로덕션 빌드**

Run: `npx next build 2>&1 | grep -E "✓|error|Error|/housing"`
Expected: `✓ Compiled successfully`, `✓ Generating static pages`, 라우트 목록에 `/housing`, `/housing/[slug]`

- [ ] **Step 4: 커밋·푸시(=배포)**

```bash
git add README.md .env.local.example
git commit -m "housing: README·env"
git push origin main
```

푸시 전에 Vercel 환경변수에 `HOUSING_API_KEY`가 있는지(없으면 `GOV24_API_KEY`로 떨어지므로 같은 계정 키면 생략 가능) 확인한다.

- [ ] **Step 5: 배포 후 확인**

```bash
curl -sI https://naemok.com/housing | head -1                       # 200
curl -s https://naemok.com/housing/seoul | grep -o 'name="robots"[^>]*'   # 건수에 따라 index 또는 noindex
curl -s -H "authorization: Bearer $CRON_SECRET" "https://naemok.com/api/cron/sync?housing=1" | head -c 600   # gov24·housing 둘 다 error 없음
curl -s https://naemok.com/sitemap/0.xml | grep -c '/housing'        # 1 이상
```

Vercel 대시보드 → Cron 탭에서 두 작업의 경로가 `/api/cron/sync?housing=1`인지, 다음 실행 로그의 소요 시간이 60초의 절반 아래인지 본다. 넘으면 `vercel.json`의 낮 실행(`0 3 * * *`)에서 `?housing=1`을 뺀다.

---

## 자체 검토

**스펙 대조**
- 1절 범위(둘 다 얕게·진단/홈 블록·상세 noindex): Task 11·12·13.
- 2절 출처·필드: Task 3·4. `RENT_SECD`·`CNP_CD` 실측은 Task 3 Step 6, Task 7 Step 6.
- 3절 데이터 모델: Task 1(열 이름이 스펙과 같다. 스펙에 없던 `receipt_start/end`·`sp_*_units` 비정규화 열은 스펙 5절의 목록 정렬·배지를 조인 없이 내기 위한 것이고 스펙 3절의 "주택형 테이블이 배지의 근거"와 모순되지 않는다 — 합계를 공고 행에 복사한 것).
- 4절 동기화(180일·지역 매핑 UNKNOWN·해시·상태 전이·캐시·급감 중단·소스별 sync_runs·cron 통합·수동 스크립트): Task 5·7·8.
- 5절 페이지·연결·색인·캐시 태그·빈 상태·error.tsx: Task 2·9·10·11·12·13.
- 6절 테스트: 각 Task의 테스트 단계. 파싱 fixtures는 Task 3 Step 6이 저장하고 단위 테스트는 인라인 샘플로 한다(키 없이도 돈다).
- 7절 배포 순서: Task 1–7 → 8 → 9–12 → 13–14.

**플레이스홀더**: 없음. 실측이 필요한 두 곳(odcloud 조건 검색 지원 여부, LH 응답 래퍼)은 두 경로 모두 코드로 적었다.

**타입 일관성**: `HousingCardRow`(Task 9)를 카드·블록·테스트가 같은 필드로 쓴다. `HousingSyncResult.applyhome/lh`(Task 6)를 cron(Task 8)과 스크립트(Task 7)가 같은 모양으로 읽는다. `fetchUnits(kind, houseManageNo, pblancNo)` 시그니처가 Task 3·7·8에서 같다. `housingTag`·`CACHE_TAGS.housingLists/housingAll`(Task 2)을 Task 8·9가 쓴다. `HOUSING_LIST_LIMIT`·`listHousing` 입력 모양이 Task 9·12·13에서 같다.
