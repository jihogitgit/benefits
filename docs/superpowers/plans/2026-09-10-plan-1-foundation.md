# 지원금 포털 — Plan 1: 기반(데이터 파이프라인) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보조금24 공공 API 전체(약 1만 건)를 Supabase에 적재하고, 조건·세그먼트·지역으로 정규화한 뒤 하루 2회 변경분만 갱신하는 동기화 파이프라인과 진단 검색 API를 완성한다.

**Architecture:** Next.js 15 App Router 프로젝트를 `real_estate`(청약마당)에서 필요한 설정만 복사해 새로 만든다. 순수 함수 계층(`src/lib/**`: API 클라이언트·정규화·태깅·상태 계산·diff)은 Vitest로 fixture 기반 검증하고, I/O는 `BenefitsRepo` 인터페이스 뒤에 두어 오케스트레이터를 가짜 저장소로 테스트한다. 진입점은 둘: 로컬 초기 적재용 `tsx scripts/sync-gov24.ts`와 Vercel Cron용 `/api/cron/sync-gov24`.

**Tech Stack:** Next.js 15.5, TypeScript 5, Supabase JS 2 (service role), Upstash Redis, Zod, Vitest 4, tsx, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-09-10-benefits-portal-design.md` (섹션 2, 3, 4, 9, 10, 11의 1단계)

**사전 준비 (사람이 직접):**
1. https://www.data.go.kr/data/15113968/openapi.do 에서 "활용신청" → 자동승인 → 마이페이지에서 인증키(Decoding) 복사 → `GOV24_API_KEY`
2. Supabase 새 프로젝트 생성 → Settings → API에서 URL, anon key, service_role key
3. Upstash Redis 생성(선택, 없으면 캐시 없이 동작)
4. Node 22 사용: `source ~/.nvm/nvm.sh && nvm use 22` (시스템 기본은 18)

---

## 파일 구조

```
benefits/
├── package.json, tsconfig.json, next.config.ts, vitest.config.ts,
│   eslint.config.mjs, postcss.config.mjs, .env.local.example, vercel.json
├── supabase/migrations/001_initial.sql        # 테이블·인덱스
├── data/
│   ├── regions.ts                             # 시도 17개 (code, slug, name, keywords)
│   └── segments.ts                            # 세그먼트 3개 + other
├── fixtures/gov24/
│   ├── serviceList.sample.json                # 실제 응답 샘플 (capture 스크립트가 생성)
│   └── supportConditions.sample.json
├── scripts/
│   ├── capture-fixtures.ts                    # 실 API 1페이지 저장
│   ├── seed-static.ts                         # segments/regions 시드
│   └── sync-gov24.ts                          # 로컬 전체 동기화
└── src/
    ├── app/
    │   ├── layout.tsx, page.tsx, globals.css  # 최소 셸 (Plan 2에서 교체)
    │   └── api/
    │       ├── cron/sync-gov24/route.ts       # Cron 진입점
    │       └── benefits/search/route.ts       # 진단 검색 API
    ├── lib/
    │   ├── supabase/admin.ts                  # service role 클라이언트
    │   ├── redis.ts                           # Upstash + getOrSet
    │   ├── api/gov24.ts                       # odcloud 호출 + 페이지 순회
    │   ├── api/gov24-schema.ts                # Zod 스키마·타입
    │   ├── benefits/slug.ts                   # 한글 slug + 충돌 해소
    │   ├── benefits/deadline.ts               # 신청기한 텍스트 파싱
    │   ├── benefits/status.ts                 # open/closed, D-day
    │   ├── benefits/search.ts                 # 진단 필터 쿼리 빌더
    │   ├── conditions/codemap.ts              # JA 코드 → 필터 스키마
    │   ├── conditions/normalize.ts            # supportConditions 행 → benefit_conditions
    │   ├── segments/rules.ts                  # 세그먼트 태깅
    │   ├── regions/extract.ts                 # 소관기관 → 시도
    │   └── sync/
    │       ├── types.ts                       # BenefitRow, ConditionRow, BenefitsRepo, SyncResult
    │       ├── normalize.ts                   # gov24 item → BenefitRow
    │       ├── diff.ts                        # 변경 판정 + 30% 급감 가드
    │       ├── gov24-sync.ts                  # 오케스트레이터
    │       └── supabase-repo.ts               # BenefitsRepo 구현
    └── types/database.ts                      # 테이블 행 타입
```

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`(빌드가 생성), `.env.local.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/test-setup.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 설정 파일 복사**

```bash
cd /Users/mw/prodect/benefits
cp ../real_estate/tsconfig.json ../real_estate/next.config.ts ../real_estate/eslint.config.mjs ../real_estate/postcss.config.mjs ../real_estate/vitest.config.ts .
mkdir -p src/app
cp ../real_estate/src/test-setup.ts src/
cp ../real_estate/src/app/globals.css src/app/
```

- [ ] **Step 2: package.json 작성**

```json
{
  "name": "benefits-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:run": "vitest run",
    "sync:gov24": "tsx --env-file=.env.local scripts/sync-gov24.ts",
    "seed:static": "tsx --env-file=.env.local scripts/seed-static.ts",
    "fixtures:capture": "tsx --env-file=.env.local scripts/capture-fixtures.ts"
  },
  "dependencies": {
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.106.2",
    "@upstash/redis": "^1.38.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.16.0",
    "next": "15.5.18",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@tailwindcss/postcss": "^4",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.2",
    "eslint": "^9",
    "eslint-config-next": "15.5.18",
    "jsdom": "^29.1.1",
    "shadcn": "^4.8.1",
    "tailwindcss": "^4",
    "tsx": "^4.19.2",
    "typescript": "^5",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 3: 최소 앱 셸 작성**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import './globals.css'

const siteName = process.env.SITE_NAME ?? '지원금 포털'

export const metadata: Metadata = {
  title: { default: siteName, template: `%s | ${siteName}` },
  description: '나이·상황·지역 조건으로 받을 수 있는 정부 지원금을 한눈에 확인하세요.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
```
(`robots: index false`는 Plan 2에서 페이지가 완성될 때 true로 바꾼다. 빈 사이트가 색인되는 것을 막는 의도적 설정.)

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <main className="p-8">지원금 포털 준비 중</main>
}
```

- [ ] **Step 4: .env.local.example 작성**

```bash
# Supabase (Settings → API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Upstash Redis (선택)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# 공공데이터포털 보조금24 인증키 (Decoding 키)
GOV24_API_KEY=

# Cron 보안 시크릿: openssl rand -base64 32
CRON_SECRET=

# 사이트
SITE_NAME=지원금 포털
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 5: .gitignore 보강**

기존 `.gitignore`에 추가:
```
fixtures/**/*.raw.json
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 6: 설치 및 빌드 확인**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22
cp .env.local.example .env.local
npm install
npm run build
npm run test:run
```
Expected: `npm run build` 성공(`Route (app) / ...` 출력). `vitest run`은 "No test files found" 로 종료 코드 0 또는 1 — 다음 태스크부터 테스트가 생기므로 여기서는 빌드 성공만 확인.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: Next.js 15 프로젝트 스캐폴드 (청약마당 설정 재사용)"
```

---

### Task 2: Supabase 스키마

**Files:**
- Create: `supabase/migrations/001_initial.sql`
- Create: `src/types/database.ts`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/001_initial.sql`:
```sql
create extension if not exists "uuid-ossp";

create table benefits (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  source_id text not null,
  slug text unique not null,
  title text not null,
  summary text,
  amount_text text,
  target_text text,
  criteria_text text,
  apply_method text,
  apply_url text,
  agency text,
  contact text,
  deadline_type text not null default 'unknown' check (deadline_type in ('always','period','unknown')),
  apply_start date,
  apply_end date,
  region_code text not null default 'ALL',
  segments text[] not null default '{}',
  status text not null default 'open' check (status in ('open','closed','removed')),
  alt_sources jsonb not null default '[]'::jsonb,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index benefits_status_segments_idx on benefits (status) include (segments);
create index benefits_segments_gin on benefits using gin (segments);
create index benefits_region_idx on benefits (region_code);
create index benefits_apply_end_idx on benefits (apply_end);

create table benefit_conditions (
  benefit_id uuid primary key references benefits(id) on delete cascade,
  age_min int,
  age_max int,
  gender text not null default 'any' check (gender in ('any','male','female')),
  income_bands text[] not null default '{}',
  life_stages text[] not null default '{}',
  household_types text[] not null default '{}',
  occupations text[] not null default '{}',
  region_codes text[] not null default '{}'
);

create index benefit_conditions_age_idx on benefit_conditions (age_min, age_max);
create index benefit_conditions_life_gin on benefit_conditions using gin (life_stages);
create index benefit_conditions_household_gin on benefit_conditions using gin (household_types);
create index benefit_conditions_occupations_gin on benefit_conditions using gin (occupations);

create table benefit_articles (
  benefit_id uuid primary key references benefits(id) on delete cascade,
  explainer_md text,
  steps_md text,
  faq_json jsonb not null default '[]'::jsonb,
  checklist_json jsonb not null default '[]'::jsonb,
  related_ids uuid[] not null default '{}',
  review_status text not null default 'draft' check (review_status in ('draft','reviewed','published','stale')),
  indexable boolean not null default false,
  draft_warnings jsonb not null default '[]'::jsonb,
  model text,
  drafted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz
);

create table segments (
  slug text primary key,
  name text not null,
  description_md text,
  sort_order int not null default 0
);

create table regions (
  code text primary key,
  slug text unique not null,
  name text not null,
  description_md text
);

create table guides (
  slug text primary key,
  title text not null,
  body_md text not null,
  segment text references segments(slug),
  published_at timestamptz
);

create table sync_runs (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched int not null default 0,
  upserted int not null default 0,
  skipped int not null default 0,
  failed int not null default 0,
  closed int not null default 0,
  removed int not null default 0,
  error text,
  aborted_reason text
);

-- 공개 읽기 정책 (쓰기는 service role만)
alter table benefits enable row level security;
alter table benefit_conditions enable row level security;
alter table benefit_articles enable row level security;
alter table segments enable row level security;
alter table regions enable row level security;
alter table guides enable row level security;
alter table sync_runs enable row level security;

create policy "public read benefits" on benefits for select using (true);
create policy "public read conditions" on benefit_conditions for select using (true);
create policy "public read articles" on benefit_articles for select using (true);
create policy "public read segments" on segments for select using (true);
create policy "public read regions" on regions for select using (true);
create policy "public read guides" on guides for select using (published_at is not null);
```

- [ ] **Step 2: 마이그레이션 적용**

Supabase 대시보드 → SQL Editor → 위 파일 내용 붙여 실행. 또는:
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/001_initial.sql
```
Expected: 오류 없이 `CREATE TABLE` 7회, `CREATE POLICY` 7회.

확인:
```sql
select table_name from information_schema.tables where table_schema='public' order by 1;
```
Expected: benefit_articles, benefit_conditions, benefits, guides, regions, segments, sync_runs

- [ ] **Step 3: 행 타입 작성**

`src/types/database.ts`:
```ts
export type DeadlineType = 'always' | 'period' | 'unknown'
export type BenefitStatus = 'open' | 'closed' | 'removed'
export type Gender = 'any' | 'male' | 'female'
export type Segment = 'youth' | 'parenting' | 'small_biz' | 'other'

export interface BenefitRow {
  source: string
  source_id: string
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  target_text: string | null
  criteria_text: string | null
  apply_method: string | null
  apply_url: string | null
  agency: string | null
  contact: string | null
  deadline_type: DeadlineType
  apply_start: string | null // YYYY-MM-DD
  apply_end: string | null
  region_code: string
  segments: Segment[]
  status: BenefitStatus
  source_updated_at: string | null // ISO
  synced_at: string
}

export interface ConditionRow {
  benefit_id: string
  age_min: number | null
  age_max: number | null
  gender: Gender
  income_bands: string[]
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  region_codes: string[]
}

export interface SyncRunRow {
  source: string
  started_at: string
  finished_at: string | null
  fetched: number
  upserted: number
  skipped: number
  failed: number
  closed: number
  removed: number
  error: string | null
  aborted_reason: string | null
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial.sql src/types/database.ts
git commit -m "feat(db): benefits/conditions/articles/segments/regions/sync_runs 스키마"
```

---

### Task 3: 정적 데이터 (시도·세그먼트) + 시드 스크립트

**Files:**
- Create: `data/regions.ts`, `data/segments.ts`, `scripts/seed-static.ts`, `src/lib/supabase/admin.ts`

- [ ] **Step 1: 시도 17개 정의**

`data/regions.ts`:
```ts
export interface RegionDef {
  code: string      // 행정표준코드 앞 2자리
  slug: string
  name: string
  keywords: string[] // 소관기관명에서 매칭할 문자열
}

export const REGIONS: RegionDef[] = [
  { code: '11', slug: 'seoul', name: '서울', keywords: ['서울특별시', '서울시', '서울'] },
  { code: '26', slug: 'busan', name: '부산', keywords: ['부산광역시', '부산시', '부산'] },
  { code: '27', slug: 'daegu', name: '대구', keywords: ['대구광역시', '대구시', '대구'] },
  { code: '28', slug: 'incheon', name: '인천', keywords: ['인천광역시', '인천시', '인천'] },
  { code: '29', slug: 'gwangju', name: '광주', keywords: ['광주광역시', '광주시'] },
  { code: '30', slug: 'daejeon', name: '대전', keywords: ['대전광역시', '대전시', '대전'] },
  { code: '31', slug: 'ulsan', name: '울산', keywords: ['울산광역시', '울산시', '울산'] },
  { code: '36', slug: 'sejong', name: '세종', keywords: ['세종특별자치시', '세종시', '세종'] },
  { code: '41', slug: 'gyeonggi', name: '경기', keywords: ['경기도', '경기'] },
  { code: '51', slug: 'gangwon', name: '강원', keywords: ['강원특별자치도', '강원도', '강원'] },
  { code: '43', slug: 'chungbuk', name: '충북', keywords: ['충청북도', '충북'] },
  { code: '44', slug: 'chungnam', name: '충남', keywords: ['충청남도', '충남'] },
  { code: '52', slug: 'jeonbuk', name: '전북', keywords: ['전북특별자치도', '전라북도', '전북'] },
  { code: '46', slug: 'jeonnam', name: '전남', keywords: ['전라남도', '전남'] },
  { code: '47', slug: 'gyeongbuk', name: '경북', keywords: ['경상북도', '경북'] },
  { code: '48', slug: 'gyeongnam', name: '경남', keywords: ['경상남도', '경남'] },
  { code: '50', slug: 'jeju', name: '제주', keywords: ['제주특별자치도', '제주도', '제주'] },
]

export const REGION_ALL = 'ALL'
```
주의: `광주`는 `경기도 광주시`와 충돌하므로 keywords에 단독 "광주"를 넣지 않는다. 매칭은 Task 8에서 "경기도"가 먼저 잡히도록 시도명을 먼저 검사한다.

- [ ] **Step 2: 세그먼트 정의**

`data/segments.ts`:
```ts
import type { Segment } from '@/types/database'

export interface SegmentDef {
  slug: Segment
  name: string
  sort_order: number
  description_md: string
}

export const SEGMENTS: SegmentDef[] = [
  { slug: 'youth', name: '청년', sort_order: 1, description_md: '만 19~39세 청년을 위한 취업·주거·자산형성·창업 지원금.' },
  { slug: 'parenting', name: '출산·육아', sort_order: 2, description_md: '임신·출산·영유아·아동 양육 가정을 위한 급여와 바우처.' },
  { slug: 'small_biz', name: '소상공인', sort_order: 3, description_md: '소상공인·자영업자·예비창업자를 위한 자금·경영·판로 지원.' },
  { slug: 'other', name: '기타', sort_order: 99, description_md: '' },
]
```

- [ ] **Step 3: service role 클라이언트**

`src/lib/supabase/admin.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락')
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}
```

- [ ] **Step 4: 시드 스크립트**

`scripts/seed-static.ts`:
```ts
import { createAdminClient } from '../src/lib/supabase/admin'
import { REGIONS } from '../data/regions'
import { SEGMENTS } from '../data/segments'

async function main() {
  const supabase = createAdminClient()

  const { error: segErr } = await supabase
    .from('segments')
    .upsert(SEGMENTS.map(({ slug, name, sort_order, description_md }) => ({ slug, name, sort_order, description_md })), { onConflict: 'slug' })
  if (segErr) throw segErr
  console.log(`segments ${SEGMENTS.length}건 upsert`)

  const { error: regErr } = await supabase
    .from('regions')
    .upsert(REGIONS.map(({ code, slug, name }) => ({ code, slug, name })), { onConflict: 'code' })
  if (regErr) throw regErr
  console.log(`regions ${REGIONS.length}건 upsert`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

tsx가 `@/` 별칭을 모르므로 스크립트에서는 상대경로를 쓴다. `src/lib/supabase/admin.ts`는 `@/`를 쓰지 않는다.

- [ ] **Step 5: 실행**

Run: `npm run seed:static`
Expected:
```
segments 4건 upsert
regions 17건 upsert
```

- [ ] **Step 6: Commit**

```bash
git add data scripts/seed-static.ts src/lib/supabase/admin.ts
git commit -m "feat: 시도·세그먼트 정적 데이터와 시드 스크립트"
```

---

### Task 4: 보조금24 응답 스키마 + fixture 캡처

**Files:**
- Create: `src/lib/api/gov24-schema.ts`, `scripts/capture-fixtures.ts`, `fixtures/gov24/serviceList.sample.json`, `fixtures/gov24/supportConditions.sample.json`
- Test: `src/lib/api/__tests__/gov24-schema.test.ts`

- [ ] **Step 1: Zod 스키마 작성**

`src/lib/api/gov24-schema.ts`:
```ts
import { z } from 'zod'

// odcloud 공통 래퍼
export const odcloudEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    currentCount: z.number(),
    matchCount: z.number(),
    page: z.number(),
    perPage: z.number(),
    totalCount: z.number(),
    data: z.array(item),
  })

const str = z.string().nullable().optional().transform((v) => (v == null ? null : String(v).trim() || null))

// 필드명은 API가 한글 키를 그대로 내려준다.
export const serviceListItem = z.object({
  서비스ID: z.string(),
  서비스명: z.string(),
  서비스목적요약: str,
  서비스분야: str,
  선정기준: str,
  지원내용: str,
  지원대상: str,
  지원유형: str,
  신청기한: str,
  신청방법: str,
  접수기관: str,
  소관기관명: str,
  부서명: str,
  전화문의: str,
  상세조회URL: str,
  사용자구분: str,
  등록일시: str,
  수정일시: str,
}).passthrough()

export type ServiceListItem = z.infer<typeof serviceListItem>

// 지원조건: 서비스ID + JA로 시작하는 코드 컬럼들. 값은 'Y' | '' | 숫자(나이).
export const supportConditionItem = z
  .object({ 서비스ID: z.string() })
  .catchall(z.union([z.string(), z.number(), z.null()]))

export type SupportConditionItem = z.infer<typeof supportConditionItem>

export const serviceListResponse = odcloudEnvelope(serviceListItem)
export const supportConditionsResponse = odcloudEnvelope(supportConditionItem)
```

- [ ] **Step 2: fixture 캡처 스크립트**

`scripts/capture-fixtures.ts`:
```ts
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'https://api.odcloud.kr/api/gov24/v3'
const key = process.env.GOV24_API_KEY
if (!key) { console.error('GOV24_API_KEY 누락'); process.exit(1) }

async function capture(op: 'serviceList' | 'supportConditions', perPage: number) {
  const url = new URL(`${BASE}/${op}`)
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', key!)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${op} ${res.status} ${await res.text()}`)
  const json = await res.json()
  mkdirSync('fixtures/gov24', { recursive: true })
  writeFileSync(`fixtures/gov24/${op}.sample.json`, JSON.stringify(json, null, 2))
  console.log(`${op}: totalCount=${json.totalCount}, saved ${json.data?.length} rows`)
  console.log(`${op} keys:`, Object.keys(json.data?.[0] ?? {}).join(', '))
}

await capture('serviceList', 20)
await capture('supportConditions', 20)
```

- [ ] **Step 3: 캡처 실행**

Run: `npm run fixtures:capture`
Expected: 두 파일 생성, `totalCount`가 수천~1만 대, 콘솔에 실제 키 목록 출력.

**콘솔의 키 목록을 확인해 `gov24-schema.ts`의 필드명과 다르면 스키마를 실제 키에 맞게 수정한다.** 특히 `상세조회URL`, `수정일시`, `사용자구분`이 대상. `supportConditions`의 키 목록(JA0101 …)은 Task 7의 codemap과 대조한다.

- [ ] **Step 4: 실패하는 스키마 테스트**

`src/lib/api/__tests__/gov24-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { serviceListResponse, supportConditionsResponse } from '../gov24-schema'

const list = JSON.parse(readFileSync('fixtures/gov24/serviceList.sample.json', 'utf8'))
const cond = JSON.parse(readFileSync('fixtures/gov24/supportConditions.sample.json', 'utf8'))

describe('gov24 schema', () => {
  it('serviceList fixture를 파싱한다', () => {
    const parsed = serviceListResponse.parse(list)
    expect(parsed.data.length).toBeGreaterThan(0)
    expect(parsed.data[0].서비스ID).toMatch(/\S/)
    expect(parsed.data[0].서비스명).toMatch(/\S/)
  })

  it('빈 문자열 필드는 null로 정규화한다', () => {
    const parsed = serviceListResponse.parse({ ...list, data: [{ ...list.data[0], 신청기한: '  ' }] })
    expect(parsed.data[0].신청기한).toBeNull()
  })

  it('supportConditions fixture를 파싱하고 JA 코드 키를 가진다', () => {
    const parsed = supportConditionsResponse.parse(cond)
    const keys = Object.keys(parsed.data[0]).filter((k) => k.startsWith('JA'))
    expect(keys.length).toBeGreaterThan(5)
  })

  it('서비스ID가 없으면 실패한다', () => {
    expect(() => serviceListResponse.parse({ ...list, data: [{ 서비스명: 'x' }] })).toThrow()
  })
})
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `npx vitest run src/lib/api/__tests__/gov24-schema.test.ts`
Expected: 4 passed. 실패하면 Step 3에서 확인한 실제 키로 스키마를 고친다.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/gov24-schema.ts scripts/capture-fixtures.ts fixtures src/lib/api/__tests__/gov24-schema.test.ts
git commit -m "feat(api): 보조금24 응답 Zod 스키마와 실응답 fixture"
```

---

### Task 5: 보조금24 API 클라이언트

**Files:**
- Create: `src/lib/api/gov24.ts`
- Test: `src/lib/api/__tests__/gov24.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/api/__tests__/gov24.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPage, fetchAll } from '../gov24'

function page(op: string, page: number, perPage: number, total: number) {
  const remaining = Math.max(0, total - (page - 1) * perPage)
  const count = Math.min(perPage, remaining)
  const data = Array.from({ length: count }, (_, i) => ({
    서비스ID: `${op}-${(page - 1) * perPage + i}`,
    서비스명: `서비스 ${i}`,
  }))
  return { currentCount: count, matchCount: total, page, perPage, totalCount: total, data }
}

describe('gov24 client', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    process.env.GOV24_API_KEY = 'k'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fetchPage는 serviceKey·page·perPage·returnType 파라미터를 붙인다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 1, 2, 2))))
    await fetchPage('serviceList', 1, 2)
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/api/gov24/v3/serviceList')
    expect(url.searchParams.get('serviceKey')).toBe('k')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('perPage')).toBe('2')
    expect(url.searchParams.get('returnType')).toBe('JSON')
  })

  it('fetchAll은 totalCount까지 페이지를 순회해 합친다', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 1, 3, 7))))
      .mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 2, 3, 7))))
      .mockResolvedValueOnce(new Response(JSON.stringify(page('serviceList', 3, 3, 7))))
    const all = await fetchAll('serviceList', { perPage: 3, delayMs: 0 })
    expect(all).toHaveLength(7)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('HTTP 오류는 상태 코드를 담아 throw한다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 401 }))
    await expect(fetchPage('serviceList', 1, 10)).rejects.toThrow(/401/)
  })

  it('키가 없으면 throw한다', async () => {
    delete process.env.GOV24_API_KEY
    await expect(fetchPage('serviceList', 1, 10)).rejects.toThrow(/GOV24_API_KEY/)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/api/__tests__/gov24.test.ts`
Expected: FAIL — `Cannot find module '../gov24'`

- [ ] **Step 3: 구현**

`src/lib/api/gov24.ts`:
```ts
import { serviceListResponse, supportConditionsResponse, type ServiceListItem, type SupportConditionItem } from './gov24-schema'

const BASE_URL = 'https://api.odcloud.kr/api/gov24/v3'

export type Gov24Op = 'serviceList' | 'supportConditions'

type ItemOf<O extends Gov24Op> = O extends 'serviceList' ? ServiceListItem : SupportConditionItem

interface PageResult<O extends Gov24Op> {
  data: ItemOf<O>[]
  totalCount: number
  page: number
  perPage: number
}

function apiKey(): string {
  const key = process.env.GOV24_API_KEY
  if (!key) throw new Error('GOV24_API_KEY 환경변수가 없습니다')
  return key
}

export async function fetchPage<O extends Gov24Op>(op: O, page: number, perPage: number): Promise<PageResult<O>> {
  const url = new URL(`${BASE_URL}/${op}`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', apiKey())

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`gov24 ${op} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()

  const parsed = op === 'serviceList' ? serviceListResponse.parse(json) : supportConditionsResponse.parse(json)
  return { data: parsed.data as ItemOf<O>[], totalCount: parsed.totalCount, page: parsed.page, perPage: parsed.perPage }
}

export interface FetchAllOptions {
  perPage?: number
  delayMs?: number
  onPage?: (page: number, totalPages: number) => void
}

export async function fetchAll<O extends Gov24Op>(op: O, opts: FetchAllOptions = {}): Promise<ItemOf<O>[]> {
  const perPage = opts.perPage ?? 1000
  const delayMs = opts.delayMs ?? 300
  const all: ItemOf<O>[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const result = await fetchPage(op, page, perPage)
    totalPages = Math.max(1, Math.ceil(result.totalCount / perPage))
    all.push(...result.data)
    opts.onPage?.(page, totalPages)
    page++
    if (page <= totalPages && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  }
  return all
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/api/__tests__/gov24.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/gov24.ts src/lib/api/__tests__/gov24.test.ts
git commit -m "feat(api): 보조금24 페이지 순회 클라이언트"
```

---

### Task 6: 신청기한 파서 · slug · 상태 계산

**Files:**
- Create: `src/lib/benefits/deadline.ts`, `src/lib/benefits/slug.ts`, `src/lib/benefits/status.ts`
- Test: `src/lib/benefits/__tests__/deadline.test.ts`, `src/lib/benefits/__tests__/slug.test.ts`, `src/lib/benefits/__tests__/status.test.ts`

- [ ] **Step 1: deadline 테스트**

`src/lib/benefits/__tests__/deadline.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseDeadline } from '../deadline'

describe('parseDeadline', () => {
  it('상시 키워드는 always', () => {
    expect(parseDeadline('상시신청')).toEqual({ deadline_type: 'always', apply_start: null, apply_end: null })
    expect(parseDeadline('연중 상시')).toEqual({ deadline_type: 'always', apply_start: null, apply_end: null })
  })
  it('두 날짜는 기간', () => {
    expect(parseDeadline('2026.03.01. ~ 2026.03.31.')).toEqual({ deadline_type: 'period', apply_start: '2026-03-01', apply_end: '2026-03-31' })
    expect(parseDeadline('2026-01-05~2026-02-10')).toEqual({ deadline_type: 'period', apply_start: '2026-01-05', apply_end: '2026-02-10' })
    expect(parseDeadline('2026년 4월 1일 ~ 2026년 4월 30일')).toEqual({ deadline_type: 'period', apply_start: '2026-04-01', apply_end: '2026-04-30' })
  })
  it('날짜 하나는 종료일만', () => {
    expect(parseDeadline('2026.12.31.까지')).toEqual({ deadline_type: 'period', apply_start: null, apply_end: '2026-12-31' })
  })
  it('해석 불가는 unknown', () => {
    expect(parseDeadline('접수기관 별 상이')).toEqual({ deadline_type: 'unknown', apply_start: null, apply_end: null })
    expect(parseDeadline(null)).toEqual({ deadline_type: 'unknown', apply_start: null, apply_end: null })
  })
  it('예산 소진 시까지는 always', () => {
    expect(parseDeadline('예산 소진시까지').deadline_type).toBe('always')
  })
})
```

- [ ] **Step 2: slug 테스트**

`src/lib/benefits/__tests__/slug.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { slugify, allocateSlug } from '../slug'

describe('slugify', () => {
  it('한글은 유지하고 공백은 하이픈, 특수문자는 제거한다', () => {
    expect(slugify('서울시 임산부 교통비 지원(70만원)')).toBe('서울시-임산부-교통비-지원-70만원')
  })
  it('연속 하이픈과 양끝 하이픈을 정리한다', () => {
    expect(slugify('  청년   월세 -- 특별지원 ')).toBe('청년-월세-특별지원')
  })
  it('60자를 넘지 않는다', () => {
    expect(slugify('가'.repeat(100)).length).toBeLessThanOrEqual(60)
  })
})

describe('allocateSlug', () => {
  it('충돌이 없으면 그대로', () => {
    const used = new Set<string>()
    expect(allocateSlug('청년-월세', used)).toBe('청년-월세')
    expect(used.has('청년-월세')).toBe(true)
  })
  it('충돌하면 -2, -3 접미를 붙인다', () => {
    const used = new Set(['청년-월세', '청년-월세-2'])
    expect(allocateSlug('청년-월세', used)).toBe('청년-월세-3')
  })
})
```

- [ ] **Step 3: status 테스트**

`src/lib/benefits/__tests__/status.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeStatus, daysUntil } from '../status'

const today = new Date('2026-09-10T03:00:00Z')

describe('computeStatus', () => {
  it('상시는 open', () => {
    expect(computeStatus({ deadline_type: 'always', apply_end: null }, today)).toBe('open')
  })
  it('종료일이 오늘이면 open, 지났으면 closed', () => {
    expect(computeStatus({ deadline_type: 'period', apply_end: '2026-09-10' }, today)).toBe('open')
    expect(computeStatus({ deadline_type: 'period', apply_end: '2026-09-09' }, today)).toBe('closed')
  })
  it('unknown은 open', () => {
    expect(computeStatus({ deadline_type: 'unknown', apply_end: null }, today)).toBe('open')
  })
})

describe('daysUntil', () => {
  it('KST 기준 남은 일수', () => {
    expect(daysUntil('2026-09-22', today)).toBe(12)
    expect(daysUntil('2026-09-10', today)).toBe(0)
    expect(daysUntil(null, today)).toBeNull()
  })
})
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run src/lib/benefits`
Expected: 3개 파일 모두 모듈 없음으로 FAIL

- [ ] **Step 5: deadline 구현**

`src/lib/benefits/deadline.ts`:
```ts
import type { DeadlineType } from '@/types/database'

export interface ParsedDeadline {
  deadline_type: DeadlineType
  apply_start: string | null
  apply_end: string | null
}

const ALWAYS = /상시|연중|수시|소진\s*시|소진시까지|제한\s*없음/
// 2026.03.01 / 2026-03-01 / 2026/03/01 / 2026년 3월 1일
const DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g

function toIso(y: string, m: string, d: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseDeadline(text: string | null | undefined): ParsedDeadline {
  const none: ParsedDeadline = { deadline_type: 'unknown', apply_start: null, apply_end: null }
  if (!text) return none

  const dates = [...text.matchAll(DATE)].map((m) => toIso(m[1], m[2], m[3]))
  if (dates.length >= 2) return { deadline_type: 'period', apply_start: dates[0], apply_end: dates[1] }
  if (dates.length === 1) return { deadline_type: 'period', apply_start: null, apply_end: dates[0] }
  if (ALWAYS.test(text)) return { deadline_type: 'always', apply_start: null, apply_end: null }
  return none
}
```

- [ ] **Step 6: slug 구현**

`src/lib/benefits/slug.ts`:
```ts
export function slugify(title: string): string {
  return title
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/g, '')
}

export function allocateSlug(base: string, used: Set<string>): string {
  let candidate = base
  let n = 2
  while (used.has(candidate)) {
    candidate = `${base}-${n}`
    n++
  }
  used.add(candidate)
  return candidate
}
```

- [ ] **Step 7: status 구현**

`src/lib/benefits/status.ts`:
```ts
import type { BenefitStatus, DeadlineType } from '@/types/database'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function kstDateString(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

export function computeStatus(b: { deadline_type: DeadlineType; apply_end: string | null }, now: Date = new Date()): BenefitStatus {
  if (b.deadline_type !== 'period' || !b.apply_end) return 'open'
  return b.apply_end < kstDateString(now) ? 'closed' : 'open'
}

export function daysUntil(applyEnd: string | null, now: Date = new Date()): number | null {
  if (!applyEnd) return null
  const end = Date.UTC(+applyEnd.slice(0, 4), +applyEnd.slice(5, 7) - 1, +applyEnd.slice(8, 10))
  const today = kstDateString(now)
  const start = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((end - start) / 86_400_000)
}
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/lib/benefits`
Expected: 12 passed

- [ ] **Step 9: Commit**

```bash
git add src/lib/benefits
git commit -m "feat(benefits): 신청기한 파서, slug 생성, 마감 상태 계산"
```

---

### Task 7: 지원조건 코드맵과 정규화

**Files:**
- Create: `src/lib/conditions/codemap.ts`, `src/lib/conditions/normalize.ts`
- Test: `src/lib/conditions/__tests__/normalize.test.ts`, `src/lib/conditions/__tests__/codemap-coverage.test.ts`

- [ ] **Step 1: 실패하는 정규화 테스트**

`src/lib/conditions/__tests__/normalize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeConditions } from '../normalize'

describe('normalizeConditions', () => {
  it('성별 코드 → gender', () => {
    expect(normalizeConditions({ 서비스ID: 'a', JA0101: 'Y' }).gender).toBe('male')
    expect(normalizeConditions({ 서비스ID: 'a', JA0102: 'Y' }).gender).toBe('female')
    expect(normalizeConditions({ 서비스ID: 'a', JA0101: 'Y', JA0102: 'Y' }).gender).toBe('any')
    expect(normalizeConditions({ 서비스ID: 'a' }).gender).toBe('any')
  })
  it('나이 범위 코드 → age_min/age_max (문자·숫자 모두)', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0110: '19', JA0111: 34 })
    expect(r.age_min).toBe(19)
    expect(r.age_max).toBe(34)
  })
  it('빈 나이는 null', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0110: '', JA0111: null })
    expect(r.age_min).toBeNull()
    expect(r.age_max).toBeNull()
  })
  it('소득·생애주기·가구·직업 코드를 배열로 매핑한다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA0201: 'Y', JA0302: 'Y', JA0327: 'Y', JA0404: 'Y' })
    expect(r.income_bands).toEqual(['0-50'])
    expect(r.life_stages).toEqual(['pregnancy'])
    expect(r.occupations).toEqual(['job_seeker'])
    expect(r.household_types).toEqual(['single'])
  })
  it('알 수 없는 JA 코드는 무시하고 unknownCodes에 담는다', () => {
    const r = normalizeConditions({ 서비스ID: 'a', JA9999: 'Y' })
    expect(r.unknownCodes).toEqual(['JA9999'])
  })
})
```

- [ ] **Step 2: fixture 커버리지 테스트 (코드표 검증 장치)**

`src/lib/conditions/__tests__/codemap-coverage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CODEMAP, AGE_MIN_CODE, AGE_MAX_CODE } from '../codemap'

const cond = JSON.parse(readFileSync('fixtures/gov24/supportConditions.sample.json', 'utf8'))

describe('codemap coverage', () => {
  it('fixture에 등장하는 모든 JA 코드는 codemap에 정의되어 있다', () => {
    const keys = new Set<string>()
    for (const row of cond.data) for (const k of Object.keys(row)) if (k.startsWith('JA')) keys.add(k)
    const missing = [...keys].filter((k) => !(k in CODEMAP) && k !== AGE_MIN_CODE && k !== AGE_MAX_CODE)
    expect(missing, `codemap에 없는 코드: ${missing.join(', ')} — data.go.kr Swagger의 컬럼 설명을 보고 codemap.ts에 추가`).toEqual([])
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/conditions`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: codemap 작성**

`src/lib/conditions/codemap.ts`. 아래는 보조금24 지원조건 컬럼 구조에 따른 초안이다. **Step 2 테스트가 빠진 코드를 알려주고, Swagger(https://www.data.go.kr/data/15113968/openapi.do → 상세기능 → supportConditions 출력 설명)의 한글 설명을 보고 아래 규칙으로 채운다.** 설명 키워드 → 필드 매핑 규칙: 남성/여성 → gender, 나이 시작/종료 → AGE codes, 소득 구간(중위소득 %) → income_bands, 임신·출산·영유아·아동·청소년·청년·중장년·노년 → life_stages, 다자녀·한부모·1인가구·무주택·다문화·북한이탈·장애인·보훈 → household_types, 근로자·구직자·자영업·농어업·학생·창업 → occupations. 매핑 불가한 설명(예: 질병, 기타)은 `{ kind: 'ignore' }`.

```ts
export type Mapping =
  | { kind: 'gender'; value: 'male' | 'female' }
  | { kind: 'income'; value: string }
  | { kind: 'life'; value: string }
  | { kind: 'household'; value: string }
  | { kind: 'occupation'; value: string }
  | { kind: 'ignore' }

export const AGE_MIN_CODE = 'JA0110'
export const AGE_MAX_CODE = 'JA0111'

export const CODEMAP: Record<string, Mapping> = {
  // 성별
  JA0101: { kind: 'gender', value: 'male' },
  JA0102: { kind: 'gender', value: 'female' },
  // 소득 (중위소득 %)
  JA0201: { kind: 'income', value: '0-50' },
  JA0202: { kind: 'income', value: '51-75' },
  JA0203: { kind: 'income', value: '76-100' },
  JA0204: { kind: 'income', value: '101-200' },
  JA0205: { kind: 'income', value: '200+' },
  // 생애주기·상황
  JA0301: { kind: 'life', value: 'pre_parent' },      // 예비부모/난임
  JA0302: { kind: 'life', value: 'pregnancy' },       // 임산부
  JA0303: { kind: 'life', value: 'birth' },           // 출산/입양
  JA0313: { kind: 'occupation', value: 'farmer' },    // 농업인
  JA0314: { kind: 'occupation', value: 'fisher' },    // 어업인
  JA0315: { kind: 'occupation', value: 'livestock' }, // 축산업인
  JA0316: { kind: 'occupation', value: 'forester' },  // 임업인
  JA0317: { kind: 'life', value: 'elementary' },      // 초등학생
  JA0318: { kind: 'life', value: 'middle_school' },   // 중학생
  JA0319: { kind: 'life', value: 'high_school' },     // 고등학생
  JA0320: { kind: 'occupation', value: 'college' },   // 대학생/대학원생
  JA0322: { kind: 'ignore' },                         // 질병/부상
  JA0326: { kind: 'occupation', value: 'worker' },    // 근로자/직장인
  JA0327: { kind: 'occupation', value: 'job_seeker' },// 구직자/실업자
  JA0328: { kind: 'household', value: 'disabled' },   // 장애인
  JA0329: { kind: 'household', value: 'veteran' },    // 국가보훈대상자
  JA0330: { kind: 'ignore' },                         // 질병/질환자
  // 가구
  JA0401: { kind: 'household', value: 'multicultural' }, // 다문화가족
  JA0402: { kind: 'household', value: 'defector' },      // 북한이탈주민
  JA0403: { kind: 'household', value: 'single_parent' }, // 한부모/조손
  JA0404: { kind: 'household', value: 'single' },        // 1인가구
  JA0410: { kind: 'household', value: 'multi_child' },   // 다자녀
  JA0411: { kind: 'household', value: 'no_house' },      // 무주택세대
  JA0412: { kind: 'household', value: 'new_resident' },  // 신규전입
  JA0413: { kind: 'household', value: 'extended' },      // 확대가족
  // 사업자 구분
  JA1101: { kind: 'occupation', value: 'small_biz' },    // 소상공인/중소기업
  JA1102: { kind: 'ignore' },                            // 사회복지시설
  JA1103: { kind: 'ignore' },                            // 기관/단체
  // 업종 (JA12xx) — 소상공인 세그먼트 판정에 쓰지 않으므로 ignore
  JA1201: { kind: 'ignore' }, JA1202: { kind: 'ignore' }, JA1203: { kind: 'ignore' },
  JA1204: { kind: 'ignore' }, JA1205: { kind: 'ignore' }, JA1206: { kind: 'ignore' },
  JA1207: { kind: 'ignore' }, JA1208: { kind: 'ignore' }, JA1209: { kind: 'ignore' },
  JA1210: { kind: 'ignore' }, JA1211: { kind: 'ignore' }, JA1212: { kind: 'ignore' },
  JA1213: { kind: 'ignore' }, JA1214: { kind: 'ignore' }, JA1299: { kind: 'ignore' },
}

// 진단 UI "상황" 칩 → 조건 배열 매핑 (Task 11 검색에서 사용)
export const SITUATION_TO_CONDITIONS: Record<string, { life?: string[]; household?: string[]; occupation?: string[] }> = {
  pregnancy: { life: ['pre_parent', 'pregnancy', 'birth'] },
  has_child: { life: ['birth', 'elementary', 'middle_school', 'high_school'], household: ['multi_child', 'single_parent'] },
  job_seeker: { occupation: ['job_seeker'] },
  business: { occupation: ['small_biz'] },
  single: { household: ['single'] },
  no_house: { household: ['no_house'] },
  student: { occupation: ['college'] },
}
```

- [ ] **Step 5: normalize 구현**

`src/lib/conditions/normalize.ts`:
```ts
import type { SupportConditionItem } from '@/lib/api/gov24-schema'
import type { Gender } from '@/types/database'
import { CODEMAP, AGE_MIN_CODE, AGE_MAX_CODE } from './codemap'

export interface NormalizedConditions {
  source_id: string
  age_min: number | null
  age_max: number | null
  gender: Gender
  income_bands: string[]
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  unknownCodes: string[]
}

function isOn(v: unknown): boolean {
  return v === 'Y' || v === 'y' || v === 1 || v === '1' || v === true
}

function toAge(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function normalizeConditions(item: SupportConditionItem): NormalizedConditions {
  const out: NormalizedConditions = {
    source_id: item.서비스ID,
    age_min: toAge(item[AGE_MIN_CODE]),
    age_max: toAge(item[AGE_MAX_CODE]),
    gender: 'any',
    income_bands: [],
    life_stages: [],
    household_types: [],
    occupations: [],
    unknownCodes: [],
  }

  let male = false
  let female = false

  for (const [code, value] of Object.entries(item)) {
    if (!code.startsWith('JA') || code === AGE_MIN_CODE || code === AGE_MAX_CODE) continue
    const m = CODEMAP[code]
    if (!m) { out.unknownCodes.push(code); continue }
    if (!isOn(value)) continue
    switch (m.kind) {
      case 'gender': if (m.value === 'male') male = true; else female = true; break
      case 'income': out.income_bands.push(m.value); break
      case 'life': out.life_stages.push(m.value); break
      case 'household': out.household_types.push(m.value); break
      case 'occupation': out.occupations.push(m.value); break
      case 'ignore': break
    }
  }

  out.gender = male && !female ? 'male' : female && !male ? 'female' : 'any'
  return out
}
```

- [ ] **Step 6: 통과 확인 및 코드표 보정**

Run: `npx vitest run src/lib/conditions`
Expected: normalize 5 passed. coverage 테스트가 빠진 코드를 나열하면 Swagger 설명을 보고 `CODEMAP`에 추가한 뒤 재실행해 통과시킨다. 나이 코드가 `JA0110/JA0111`이 아니면 `AGE_MIN_CODE/AGE_MAX_CODE` 상수를 실제 코드로 바꾸고 normalize 테스트의 코드도 함께 바꾼다.

- [ ] **Step 7: Commit**

```bash
git add src/lib/conditions
git commit -m "feat(conditions): 지원조건 JA 코드맵과 필터 스키마 정규화"
```

---

### Task 8: 세그먼트 태깅 · 지역 추출

**Files:**
- Create: `src/lib/segments/rules.ts`, `src/lib/regions/extract.ts`
- Test: `src/lib/segments/__tests__/rules.test.ts`, `src/lib/regions/__tests__/extract.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/segments/__tests__/rules.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { tagSegments } from '../rules'

const base = { title: '', target_text: '', summary: '' }
const noCond = { age_min: null, age_max: null, life_stages: [], occupations: [], household_types: [] }

describe('tagSegments', () => {
  it('청년: 나이 조건 19~39 범위 안', () => {
    expect(tagSegments(base, { ...noCond, age_min: 19, age_max: 34 })).toContain('youth')
  })
  it('청년: 키워드', () => {
    expect(tagSegments({ ...base, title: '청년 월세 특별지원' }, noCond)).toContain('youth')
  })
  it('나이 범위가 넓으면 청년 아님', () => {
    expect(tagSegments(base, { ...noCond, age_min: 0, age_max: 100 })).not.toContain('youth')
  })
  it('출산·육아: 생애주기 코드 또는 키워드', () => {
    expect(tagSegments(base, { ...noCond, life_stages: ['pregnancy'] })).toContain('parenting')
    expect(tagSegments({ ...base, target_text: '만 0~5세 영유아 양육 가정' }, noCond)).toContain('parenting')
  })
  it('소상공인: 직업 코드 또는 키워드', () => {
    expect(tagSegments(base, { ...noCond, occupations: ['small_biz'] })).toContain('small_biz')
    expect(tagSegments({ ...base, title: '소상공인 냉난방기 교체 지원' }, noCond)).toContain('small_biz')
    expect(tagSegments({ ...base, summary: '자영업자 경영안정자금' }, noCond)).toContain('small_biz')
  })
  it('복수 세그먼트 가능, 없으면 other', () => {
    expect(tagSegments({ ...base, title: '청년 창업 소상공인 지원' }, noCond)).toEqual(['youth', 'small_biz'])
    expect(tagSegments({ ...base, title: '노인 기초연금' }, noCond)).toEqual(['other'])
  })
})
```

`src/lib/regions/__tests__/extract.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { extractRegion } from '../extract'

describe('extractRegion', () => {
  it('시도명을 slug로', () => {
    expect(extractRegion('서울특별시 강남구')).toBe('seoul')
    expect(extractRegion('경기도 성남시')).toBe('gyeonggi')
    expect(extractRegion('강원특별자치도')).toBe('gangwon')
    expect(extractRegion('전북특별자치도 전주시')).toBe('jeonbuk')
  })
  it('경기도 광주시는 경기', () => {
    expect(extractRegion('경기도 광주시')).toBe('gyeonggi')
  })
  it('광주광역시는 광주', () => {
    expect(extractRegion('광주광역시 북구')).toBe('gwangju')
  })
  it('중앙부처·공공기관은 ALL', () => {
    expect(extractRegion('보건복지부')).toBe('ALL')
    expect(extractRegion('국민건강보험공단')).toBe('ALL')
    expect(extractRegion(null)).toBe('ALL')
  })
  it('교육청은 해당 시도', () => {
    expect(extractRegion('부산광역시교육청')).toBe('busan')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/segments src/lib/regions`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 세그먼트 규칙 구현**

`src/lib/segments/rules.ts`:
```ts
import type { Segment } from '@/types/database'

export interface SegmentTextInput { title: string | null; target_text: string | null; summary: string | null }
export interface SegmentCondInput {
  age_min: number | null
  age_max: number | null
  life_stages: string[]
  occupations: string[]
  household_types: string[]
}

const YOUTH_KW = /청년|대학생|취업준비|신혼부부/
const PARENTING_KW = /임산부|임신|출산|산모|산후|영유아|영아|유아|아동|양육|육아|보육|어린이집|유치원|다자녀|출생|첫만남|부모급여|아이돌봄/
const SMALL_BIZ_KW = /소상공인|자영업|소기업|점포|창업|사업자|가게|상인|전통시장|폐업/

const PARENTING_STAGES = new Set(['pre_parent', 'pregnancy', 'birth', 'elementary'])
const PARENTING_HOUSEHOLDS = new Set(['multi_child', 'single_parent'])

export function tagSegments(text: SegmentTextInput, cond: SegmentCondInput): Segment[] {
  const hay = `${text.title ?? ''} ${text.target_text ?? ''} ${text.summary ?? ''}`
  const out: Segment[] = []

  const youthByAge = cond.age_min !== null && cond.age_max !== null && cond.age_min >= 15 && cond.age_max <= 39
  if (youthByAge || YOUTH_KW.test(hay)) out.push('youth')

  const parentingByCode = cond.life_stages.some((s) => PARENTING_STAGES.has(s)) || cond.household_types.some((h) => PARENTING_HOUSEHOLDS.has(h))
  if (parentingByCode || PARENTING_KW.test(hay)) out.push('parenting')

  if (cond.occupations.includes('small_biz') || SMALL_BIZ_KW.test(hay)) out.push('small_biz')

  return out.length ? out : ['other']
}
```

- [ ] **Step 4: 지역 추출 구현**

`src/lib/regions/extract.ts`:
```ts
import { REGIONS, REGION_ALL } from '../../../data/regions'

// 긴 키워드(정식 명칭)를 먼저 검사해 "경기도 광주시"가 광주로 잡히지 않게 한다.
const ORDERED = REGIONS.flatMap((r) => r.keywords.map((kw) => ({ kw, slug: r.slug }))).sort((a, b) => b.kw.length - a.kw.length)

export function extractRegion(agency: string | null | undefined): string {
  if (!agency) return REGION_ALL
  // 첫 어절(시도 단위)만 본다. "경기도 광주시" → "경기도"
  const head = agency.trim().split(/\s+/)[0]
  for (const { kw, slug } of ORDERED) if (head.startsWith(kw)) return slug
  return REGION_ALL
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/segments src/lib/regions`
Expected: 11 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/segments src/lib/regions
git commit -m "feat: 세그먼트 태깅 규칙과 소관기관 지역 추출"
```

---

### Task 9: gov24 항목 → benefits 행 정규화

**Files:**
- Create: `src/lib/sync/types.ts`, `src/lib/sync/normalize.ts`
- Test: `src/lib/sync/__tests__/normalize.test.ts`

- [ ] **Step 1: 타입 정의**

`src/lib/sync/types.ts`:
```ts
import type { BenefitRow, ConditionRow, SyncRunRow } from '@/types/database'

export interface ExistingVersion {
  id: string
  slug: string
  source_updated_at: string | null
}

export interface BenefitsRepo {
  /** source별 기존 행: source_id → {id, slug, source_updated_at} */
  getExisting(source: string): Promise<Map<string, ExistingVersion>>
  /** (source, source_id) 기준 upsert. 삽입된 행의 id를 source_id → id 로 돌려준다. */
  upsertBenefits(rows: BenefitRow[]): Promise<Map<string, string>>
  upsertConditions(rows: ConditionRow[]): Promise<void>
  /** period 마감 지난 open 행을 closed로. 바뀐 수 반환 */
  closeExpired(todayKst: string): Promise<number>
  /** source 안에서 keep에 없는 source_id를 removed로. 바뀐 수 반환 */
  markRemoved(source: string, keepSourceIds: string[]): Promise<number>
  recordRun(run: SyncRunRow): Promise<void>
  lastSuccessfulFetched(source: string): Promise<number | null>
}

export interface SyncResult {
  fetched: number
  changed: number
  upserted: number
  skipped: number
  failed: number
  closed: number
  removed: number
  aborted_reason: string | null
  changedSlugs: string[]
  changedSegments: string[]
}
```

- [ ] **Step 2: 실패하는 테스트**

`src/lib/sync/__tests__/normalize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeBenefit } from '../normalize'
import type { ServiceListItem } from '@/lib/api/gov24-schema'

const item: ServiceListItem = {
  서비스ID: 'SVC001',
  서비스명: '서울시 임산부 교통비 지원',
  서비스목적요약: '임산부 교통비 70만원 지원',
  서비스분야: '보육·교육',
  선정기준: '서울시 6개월 이상 거주 임산부',
  지원내용: '교통 포인트 70만원',
  지원대상: '임신 3개월 이상 임산부',
  지원유형: '현금',
  신청기한: '상시신청',
  신청방법: '온라인',
  접수기관: '서울맘케어',
  소관기관명: '서울특별시',
  부서명: '출산정책팀',
  전화문의: '120',
  상세조회URL: 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/SVC001',
  사용자구분: '개인',
  등록일시: '2024-01-01 10:00:00',
  수정일시: '2026-09-01 09:30:00',
}

const cond = { age_min: 19, age_max: 45, gender: 'female' as const, income_bands: [], life_stages: ['pregnancy'], household_types: [], occupations: [] }
const now = new Date('2026-09-10T03:00:00Z')

describe('normalizeBenefit', () => {
  it('필드를 BenefitRow로 옮기고 파생값을 채운다', () => {
    const row = normalizeBenefit(item, cond, '서울시-임산부-교통비-지원', now)
    expect(row).toMatchObject({
      source: 'gov24',
      source_id: 'SVC001',
      slug: '서울시-임산부-교통비-지원',
      title: '서울시 임산부 교통비 지원',
      amount_text: '교통 포인트 70만원',
      target_text: '임신 3개월 이상 임산부',
      criteria_text: '서울시 6개월 이상 거주 임산부',
      apply_url: 'https://www.gov.kr/portal/rcvfvrSvc/dtlEx/SVC001',
      agency: '서울특별시',
      contact: '120',
      deadline_type: 'always',
      apply_end: null,
      region_code: 'seoul',
      segments: ['parenting'],
      status: 'open',
    })
    expect(row.source_updated_at).toBe('2026-09-01T00:30:00.000Z')
    expect(row.synced_at).toBe(now.toISOString())
  })
  it('수정일시가 없으면 등록일시를 쓴다', () => {
    const row = normalizeBenefit({ ...item, 수정일시: null }, cond, 's', now)
    expect(row.source_updated_at).toBe('2024-01-01T01:00:00.000Z') // KST 10:00 → UTC 01:00
  })
  it('조건이 없어도 텍스트로 세그먼트를 잡는다', () => {
    const row = normalizeBenefit(item, null, 's', now)
    expect(row.segments).toEqual(['parenting'])
  })
  it('기간이 지난 항목은 closed', () => {
    const row = normalizeBenefit({ ...item, 신청기한: '2026.01.01 ~ 2026.03.31' }, null, 's', now)
    expect(row.status).toBe('closed')
    expect(row.apply_end).toBe('2026-03-31')
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/sync/__tests__/normalize.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 구현**

`src/lib/sync/normalize.ts`:
```ts
import type { ServiceListItem } from '@/lib/api/gov24-schema'
import type { BenefitRow } from '@/types/database'
import { parseDeadline } from '@/lib/benefits/deadline'
import { computeStatus } from '@/lib/benefits/status'
import { tagSegments } from '@/lib/segments/rules'
import { extractRegion } from '@/lib/regions/extract'

export const GOV24_SOURCE = 'gov24'

export interface CondForNormalize {
  age_min: number | null
  age_max: number | null
  life_stages: string[]
  occupations: string[]
  household_types: string[]
}

/** '2026-09-01 09:30:00' (KST) → ISO UTC */
export function kstToIso(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], +(m[6] ?? 0)))
  return d.toISOString()
}

export function normalizeBenefit(item: ServiceListItem, cond: CondForNormalize | null, slug: string, now: Date): BenefitRow {
  const deadline = parseDeadline(item.신청기한)
  const emptyCond: CondForNormalize = { age_min: null, age_max: null, life_stages: [], occupations: [], household_types: [] }
  const segments = tagSegments(
    { title: item.서비스명, target_text: item.지원대상 ?? null, summary: item.서비스목적요약 ?? null },
    cond ?? emptyCond,
  )

  return {
    source: GOV24_SOURCE,
    source_id: item.서비스ID,
    slug,
    title: item.서비스명.trim(),
    summary: item.서비스목적요약 ?? null,
    amount_text: item.지원내용 ?? null,
    target_text: item.지원대상 ?? null,
    criteria_text: item.선정기준 ?? null,
    apply_method: item.신청방법 ?? null,
    apply_url: item.상세조회URL ?? null,
    agency: item.소관기관명 ?? null,
    contact: item.전화문의 ?? null,
    deadline_type: deadline.deadline_type,
    apply_start: deadline.apply_start,
    apply_end: deadline.apply_end,
    region_code: extractRegion(item.소관기관명),
    segments,
    status: computeStatus(deadline, now),
    source_updated_at: kstToIso(item.수정일시) ?? kstToIso(item.등록일시),
    synced_at: now.toISOString(),
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/sync/__tests__/normalize.test.ts`
Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/types.ts src/lib/sync/normalize.ts src/lib/sync/__tests__/normalize.test.ts
git commit -m "feat(sync): gov24 항목을 benefits 행으로 정규화"
```

---

### Task 10: 변경 판정 · 급감 가드 · 오케스트레이터

**Files:**
- Create: `src/lib/sync/diff.ts`, `src/lib/sync/gov24-sync.ts`
- Test: `src/lib/sync/__tests__/diff.test.ts`, `src/lib/sync/__tests__/gov24-sync.test.ts`

- [ ] **Step 1: diff 테스트**

`src/lib/sync/__tests__/diff.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isChanged, shouldAbortForDrop } from '../diff'

describe('isChanged', () => {
  it('기존 없음 → 변경', () => expect(isChanged(undefined, '2026-01-01T00:00:00Z')).toBe(true))
  it('수정일시 같음 → 변경 아님', () => expect(isChanged('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false))
  it('수정일시 다름 → 변경', () => expect(isChanged('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')).toBe(true))
  it('둘 다 null → 변경 아님(재처리 안 함)', () => expect(isChanged(null, null)).toBe(false))
})

describe('shouldAbortForDrop', () => {
  it('직전 성공 대비 30% 이상 감소면 중단', () => {
    expect(shouldAbortForDrop(10000, 6900)).toBe(true)
    expect(shouldAbortForDrop(10000, 7000)).toBe(false)
  })
  it('직전 기록 없으면 통과', () => expect(shouldAbortForDrop(null, 5)).toBe(false))
  it('0건이면 항상 중단', () => expect(shouldAbortForDrop(null, 0)).toBe(true))
})
```

- [ ] **Step 2: 오케스트레이터 테스트 (가짜 저장소)**

`src/lib/sync/__tests__/gov24-sync.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { runGov24Sync } from '../gov24-sync'
import type { BenefitsRepo, ExistingVersion } from '../types'
import type { ServiceListItem, SupportConditionItem } from '@/lib/api/gov24-schema'
import type { BenefitRow, ConditionRow, SyncRunRow } from '@/types/database'

function item(id: string, title: string, updated: string, extra: Partial<ServiceListItem> = {}): ServiceListItem {
  return {
    서비스ID: id, 서비스명: title, 서비스목적요약: null, 서비스분야: null, 선정기준: null, 지원내용: null,
    지원대상: null, 지원유형: null, 신청기한: '상시', 신청방법: null, 접수기관: null, 소관기관명: '보건복지부',
    부서명: null, 전화문의: null, 상세조회URL: null, 사용자구분: null, 등록일시: '2024-01-01 00:00:00', 수정일시: updated, ...extra,
  }
}

function fakeRepo(existing: Record<string, ExistingVersion> = {}, lastFetched: number | null = null) {
  const calls = { benefits: [] as BenefitRow[], conditions: [] as ConditionRow[], runs: [] as SyncRunRow[], removedKeep: [] as string[] }
  const repo: BenefitsRepo = {
    getExisting: vi.fn(async () => new Map(Object.entries(existing))),
    upsertBenefits: vi.fn(async (rows) => { calls.benefits.push(...rows); return new Map(rows.map((r) => [r.source_id, `id-${r.source_id}`])) }),
    upsertConditions: vi.fn(async (rows) => { calls.conditions.push(...rows) }),
    closeExpired: vi.fn(async () => 2),
    markRemoved: vi.fn(async (_s, keep) => { calls.removedKeep = keep; return 1 }),
    recordRun: vi.fn(async (run) => { calls.runs.push(run) }),
    lastSuccessfulFetched: vi.fn(async () => lastFetched),
  }
  return { repo, calls }
}

const now = new Date('2026-09-10T03:00:00Z')

describe('runGov24Sync', () => {
  it('신규·변경 항목만 upsert하고 조건을 붙인다', async () => {
    const { repo, calls } = fakeRepo({
      A: { id: 'id-A', slug: 'a', source_updated_at: '2026-01-01T00:00:00.000Z' },
    })
    const list = [
      item('A', '기존 그대로', '2026-01-01 09:00:00'),              // KST 09:00 = UTC 00:00 → 동일
      item('B', '청년 월세 지원', '2026-02-01 09:00:00'),           // 신규
    ]
    const conds: SupportConditionItem[] = [{ 서비스ID: 'B', JA0110: '19', JA0111: '34' }]

    const result = await runGov24Sync({ repo, fetchList: async () => list, fetchConditions: async () => conds, now })

    expect(result.fetched).toBe(2)
    expect(result.changed).toBe(1)
    expect(result.upserted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(calls.benefits.map((b) => b.source_id)).toEqual(['B'])
    expect(calls.benefits[0].segments).toEqual(['youth'])
    expect(calls.conditions[0]).toMatchObject({ benefit_id: 'id-B', age_min: 19, age_max: 34 })
    expect(result.changedSlugs).toEqual(['청년-월세-지원'])
    expect(result.changedSegments).toEqual(['youth'])
    expect(calls.removedKeep.sort()).toEqual(['A', 'B'])
    expect(result.closed).toBe(2)
    expect(result.removed).toBe(1)
    expect(calls.runs[0]).toMatchObject({ source: 'gov24', fetched: 2, upserted: 1, skipped: 1, error: null })
  })

  it('기존 slug를 유지하고 신규 slug 충돌은 접미로 해소한다', async () => {
    const { repo, calls } = fakeRepo({
      A: { id: 'id-A', slug: '청년-지원', source_updated_at: null },
    })
    const list = [item('A', '청년 지원', '2026-02-01 09:00:00'), item('B', '청년 지원', '2026-02-01 09:00:00')]
    await runGov24Sync({ repo, fetchList: async () => list, fetchConditions: async () => [], now })
    const slugs = Object.fromEntries(calls.benefits.map((b) => [b.source_id, b.slug]))
    expect(slugs.A).toBe('청년-지원')
    expect(slugs.B).toBe('청년-지원-2')
  })

  it('30% 급감이면 upsert 없이 중단 기록', async () => {
    const { repo, calls } = fakeRepo({}, 100)
    const result = await runGov24Sync({ repo, fetchList: async () => [item('A', 'x', '2026-02-01 09:00:00')], fetchConditions: async () => [], now })
    expect(result.aborted_reason).toMatch(/급감/)
    expect(calls.benefits).toHaveLength(0)
    expect(repo.markRemoved).not.toHaveBeenCalled()
    expect(calls.runs[0].aborted_reason).toMatch(/급감/)
  })

  it('필수 필드가 깨진 항목은 건너뛰고 failed에 기록', async () => {
    const { repo, calls } = fakeRepo()
    const bad = { ...item('C', '', '2026-02-01 09:00:00'), 서비스명: '   ' }
    const result = await runGov24Sync({ repo, fetchList: async () => [bad, item('D', '정상', '2026-02-01 09:00:00')], fetchConditions: async () => [], now })
    expect(result.failed).toBe(1)
    expect(calls.benefits.map((b) => b.source_id)).toEqual(['D'])
  })

  it('fetch가 throw하면 run에 error를 남기고 다시 throw', async () => {
    const { repo, calls } = fakeRepo()
    await expect(runGov24Sync({ repo, fetchList: async () => { throw new Error('HTTP 500') }, fetchConditions: async () => [], now })).rejects.toThrow('HTTP 500')
    expect(calls.runs[0].error).toMatch(/HTTP 500/)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/sync`
Expected: diff/gov24-sync 테스트가 모듈 없음으로 FAIL (normalize는 PASS)

- [ ] **Step 4: diff 구현**

`src/lib/sync/diff.ts`:
```ts
export function isChanged(existingUpdatedAt: string | null | undefined, incomingUpdatedAt: string | null): boolean {
  if (existingUpdatedAt === undefined) return true
  return (existingUpdatedAt ?? null) !== (incomingUpdatedAt ?? null)
}

export const DROP_THRESHOLD = 0.3

export function shouldAbortForDrop(lastFetched: number | null, fetched: number): boolean {
  if (fetched === 0) return true
  if (lastFetched === null) return false
  return fetched < lastFetched * (1 - DROP_THRESHOLD)
}
```

- [ ] **Step 5: 오케스트레이터 구현**

`src/lib/sync/gov24-sync.ts`:
```ts
import type { ServiceListItem, SupportConditionItem } from '@/lib/api/gov24-schema'
import type { BenefitRow, ConditionRow, SyncRunRow } from '@/types/database'
import { normalizeConditions } from '@/lib/conditions/normalize'
import { slugify, allocateSlug } from '@/lib/benefits/slug'
import { kstDateString } from '@/lib/benefits/status'
import { normalizeBenefit, GOV24_SOURCE } from './normalize'
import { isChanged, shouldAbortForDrop } from './diff'
import type { BenefitsRepo, SyncResult } from './types'

export interface Gov24SyncDeps {
  repo: BenefitsRepo
  fetchList: () => Promise<ServiceListItem[]>
  fetchConditions: () => Promise<SupportConditionItem[]>
  now?: Date
  batchSize?: number
  log?: (msg: string) => void
}

export async function runGov24Sync(deps: Gov24SyncDeps): Promise<SyncResult> {
  const now = deps.now ?? new Date()
  const log = deps.log ?? (() => {})
  const batchSize = deps.batchSize ?? 500
  const run: SyncRunRow = {
    source: GOV24_SOURCE, started_at: now.toISOString(), finished_at: null,
    fetched: 0, upserted: 0, skipped: 0, failed: 0, closed: 0, removed: 0, error: null, aborted_reason: null,
  }
  const result: SyncResult = { fetched: 0, changed: 0, upserted: 0, skipped: 0, failed: 0, closed: 0, removed: 0, aborted_reason: null, changedSlugs: [], changedSegments: [] }

  try {
    const [list, condItems] = await Promise.all([deps.fetchList(), deps.fetchConditions()])
    run.fetched = result.fetched = list.length
    log(`fetched list=${list.length} conditions=${condItems.length}`)

    const lastFetched = await deps.repo.lastSuccessfulFetched(GOV24_SOURCE)
    if (shouldAbortForDrop(lastFetched, list.length)) {
      run.aborted_reason = result.aborted_reason = `건수 급감: 직전 ${lastFetched ?? '없음'} → 이번 ${list.length}`
      log(run.aborted_reason)
      return result
    }

    const existing = await deps.repo.getExisting(GOV24_SOURCE)
    const usedSlugs = new Set([...existing.values()].map((e) => e.slug))
    const condBySource = new Map<string, ReturnType<typeof normalizeConditions>>()
    for (const c of condItems) condBySource.set(c.서비스ID, normalizeConditions(c))

    const changedRows: BenefitRow[] = []
    const segmentSet = new Set<string>()

    for (const item of list) {
      if (!item.서비스명?.trim()) { result.failed++; continue }
      const prev = existing.get(item.서비스ID)
      const cond = condBySource.get(item.서비스ID) ?? null
      const probe = normalizeBenefit(item, cond, prev?.slug ?? '', now)
      if (!isChanged(prev?.source_updated_at, probe.source_updated_at)) { result.skipped++; continue }
      const slug = prev?.slug ?? allocateSlug(slugify(probe.title), usedSlugs)
      changedRows.push({ ...probe, slug })
      result.changedSlugs.push(slug)
      probe.segments.forEach((s) => segmentSet.add(s))
    }
    result.changed = changedRows.length
    result.changedSegments = [...segmentSet]

    for (let i = 0; i < changedRows.length; i += batchSize) {
      const batch = changedRows.slice(i, i + batchSize)
      const idBySource = await deps.repo.upsertBenefits(batch)
      const condRows: ConditionRow[] = []
      for (const row of batch) {
        const id = idBySource.get(row.source_id)
        const c = condBySource.get(row.source_id)
        if (!id || !c) continue
        condRows.push({ benefit_id: id, age_min: c.age_min, age_max: c.age_max, gender: c.gender, income_bands: c.income_bands, life_stages: c.life_stages, household_types: c.household_types, occupations: c.occupations, region_codes: row.region_code === 'ALL' ? [] : [row.region_code] })
      }
      if (condRows.length) await deps.repo.upsertConditions(condRows)
      result.upserted += batch.length
      log(`upserted ${result.upserted}/${changedRows.length}`)
    }

    result.closed = await deps.repo.closeExpired(kstDateString(now))
    result.removed = await deps.repo.markRemoved(GOV24_SOURCE, list.map((i) => i.서비스ID))

    run.upserted = result.upserted; run.skipped = result.skipped; run.failed = result.failed
    run.closed = result.closed; run.removed = result.removed
    return result
  } catch (err) {
    run.error = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    run.finished_at = new Date().toISOString()
    await deps.repo.recordRun(run)
  }
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/sync`
Expected: 모두 PASS (normalize 4 + diff 7 + sync 5)

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync
git commit -m "feat(sync): 변경 판정·급감 가드·gov24 동기화 오케스트레이터"
```

---

### Task 11: Supabase 저장소 구현 + 로컬 동기화 스크립트

**Files:**
- Create: `src/lib/sync/supabase-repo.ts`, `scripts/sync-gov24.ts`

- [ ] **Step 1: 저장소 구현**

`src/lib/sync/supabase-repo.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BenefitRow, ConditionRow, SyncRunRow } from '../../types/database'
import type { BenefitsRepo, ExistingVersion } from './types'

const PAGE = 1000

export function createSupabaseRepo(supabase: SupabaseClient): BenefitsRepo {
  return {
    async getExisting(source) {
      const map = new Map<string, ExistingVersion>()
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('benefits')
          .select('id, source_id, slug, source_updated_at')
          .eq('source', source)
          .range(from, from + PAGE - 1)
        if (error) throw error
        for (const r of data ?? []) map.set(r.source_id, { id: r.id, slug: r.slug, source_updated_at: r.source_updated_at })
        if (!data || data.length < PAGE) break
      }
      return map
    },

    async upsertBenefits(rows: BenefitRow[]) {
      const { data, error } = await supabase
        .from('benefits')
        .upsert(rows, { onConflict: 'source,source_id' })
        .select('id, source_id')
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.source_id as string, r.id as string]))
    },

    async upsertConditions(rows: ConditionRow[]) {
      const { error } = await supabase.from('benefit_conditions').upsert(rows, { onConflict: 'benefit_id' })
      if (error) throw error
    },

    async closeExpired(todayKst) {
      const { data, error } = await supabase
        .from('benefits')
        .update({ status: 'closed' })
        .eq('status', 'open')
        .eq('deadline_type', 'period')
        .lt('apply_end', todayKst)
        .select('id')
      if (error) throw error
      return data?.length ?? 0
    },

    async markRemoved(source, keepSourceIds) {
      const keep = new Set(keepSourceIds)
      const existing = await this.getExisting(source)
      const toRemove = [...existing.keys()].filter((sid) => !keep.has(sid))
      let count = 0
      for (let i = 0; i < toRemove.length; i += 200) {
        const chunk = toRemove.slice(i, i + 200)
        const { data, error } = await supabase
          .from('benefits')
          .update({ status: 'removed' })
          .eq('source', source)
          .in('source_id', chunk)
          .neq('status', 'removed')
          .select('id')
        if (error) throw error
        count += data?.length ?? 0
      }
      return count
    },

    async recordRun(run: SyncRunRow) {
      const { error } = await supabase.from('sync_runs').insert(run)
      if (error) throw error
    },

    async lastSuccessfulFetched(source) {
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

`supabase-repo.ts`는 tsx 스크립트에서도 import되므로 `@/` 별칭 대신 상대경로를 쓴다.

- [ ] **Step 2: 로컬 스크립트**

`scripts/sync-gov24.ts`:
```ts
import { createAdminClient } from '../src/lib/supabase/admin'
import { createSupabaseRepo } from '../src/lib/sync/supabase-repo'
import { runGov24Sync } from '../src/lib/sync/gov24-sync'
import { fetchAll } from '../src/lib/api/gov24'

async function main() {
  const repo = createSupabaseRepo(createAdminClient())
  const result = await runGov24Sync({
    repo,
    fetchList: () => fetchAll('serviceList', { onPage: (p, t) => console.log(`serviceList ${p}/${t}`) }),
    fetchConditions: () => fetchAll('supportConditions', { onPage: (p, t) => console.log(`supportConditions ${p}/${t}`) }),
    log: console.log,
  })
  console.log(JSON.stringify({ ...result, changedSlugs: result.changedSlugs.length }, null, 2))
  if (result.aborted_reason) process.exit(2)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

`gov24-sync.ts`와 그 의존 모듈이 `@/` 별칭을 쓰므로 tsx가 이를 해석하도록 `tsconfig.json`의 `paths`가 이미 있는지 확인한다(Task 1에서 복사됨). tsx는 tsconfig paths를 지원한다.

- [ ] **Step 3: 초기 전체 적재 실행**

Run: `npm run sync:gov24`
Expected (약 1~3분):
```
serviceList 1/10 … serviceList 10/10
supportConditions 1/10 … 
fetched list=9xxx conditions=9xxx
upserted 500/9xxx … upserted 9xxx/9xxx
{ "fetched": 9xxx, "changed": 9xxx, "upserted": 9xxx, "skipped": 0, "failed": 0~수십, "closed": n, "removed": 0, "aborted_reason": null, ... }
```

- [ ] **Step 4: 두 번째 실행으로 변경분 판정 검증**

Run: `npm run sync:gov24`
Expected: `changed`가 0 또는 소수, `skipped`가 거의 전체. `sync_runs`에 2행.

SQL 확인:
```sql
select status, count(*) from benefits group by 1;
select unnest(segments) seg, count(*) from benefits group by 1 order by 2 desc;
select region_code, count(*) from benefits group by 1 order by 2 desc limit 20;
select count(*) from benefit_conditions;
```
Expected: youth/parenting/small_biz 각 수백 건 이상, region_code에 17개 slug와 ALL, conditions 건수가 benefits 건수의 대부분.

세그먼트 태깅 결과 중 명백한 오탐(예: "청년" 키워드 때문에 노인 정책이 youth로 잡힘)이 눈에 띄면 `src/lib/segments/rules.ts`의 정규식과 테스트를 함께 조정하고 재실행한다.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/supabase-repo.ts scripts/sync-gov24.ts
git commit -m "feat(sync): Supabase 저장소 구현과 로컬 전체 동기화 스크립트"
```

---

### Task 12: Cron 라우트 + vercel.json

**Files:**
- Create: `src/app/api/cron/sync-gov24/route.ts`, `vercel.json`
- Test: `src/app/api/cron/__tests__/sync-gov24.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`src/app/api/cron/__tests__/sync-gov24.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const runMock = vi.fn()
vi.mock('@/lib/sync/gov24-sync', () => ({ runGov24Sync: (...args: unknown[]) => runMock(...args) }))
vi.mock('@/lib/sync/supabase-repo', () => ({ createSupabaseRepo: vi.fn(() => ({})) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { GET } from '@/app/api/cron/sync-gov24/route'
import { revalidateTag } from 'next/cache'

describe('GET /api/cron/sync-gov24', () => {
  beforeEach(() => { runMock.mockReset(); process.env.CRON_SECRET = 'secret' })

  it('토큰 없으면 401', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24'))
    expect(res.status).toBe(401)
  })

  it('성공 시 결과와 함께 변경 태그를 재검증한다', async () => {
    runMock.mockResolvedValue({ fetched: 10, changed: 2, upserted: 2, skipped: 8, failed: 0, closed: 0, removed: 0, aborted_reason: null, changedSlugs: ['a', 'b'], changedSegments: ['youth'] })
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24', { headers: { authorization: 'Bearer secret' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ upserted: 2 })
    expect(revalidateTag).toHaveBeenCalledWith('benefit:a')
    expect(revalidateTag).toHaveBeenCalledWith('benefit:b')
    expect(revalidateTag).toHaveBeenCalledWith('segment:youth')
    expect(revalidateTag).toHaveBeenCalledWith('benefits:home')
  })

  it('급감 중단은 409', async () => {
    runMock.mockResolvedValue({ fetched: 1, changed: 0, upserted: 0, skipped: 0, failed: 0, closed: 0, removed: 0, aborted_reason: '건수 급감', changedSlugs: [], changedSegments: [] })
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24', { headers: { authorization: 'Bearer secret' } }))
    expect(res.status).toBe(409)
  })

  it('예외는 500', async () => {
    runMock.mockRejectedValue(new Error('boom'))
    const res = await GET(new NextRequest('http://localhost/api/cron/sync-gov24', { headers: { authorization: 'Bearer secret' } }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/cron`
Expected: FAIL — 라우트 모듈 없음

- [ ] **Step 3: 라우트 구현**

`src/app/api/cron/sync-gov24/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseRepo } from '@/lib/sync/supabase-repo'
import { runGov24Sync } from '@/lib/sync/gov24-sync'
import { fetchAll } from '@/lib/api/gov24'

export const runtime = 'nodejs'
export const maxDuration = 60 // Vercel Hobby 상한. 플랜 상한을 넘는 값은 배포가 실패한다. 초기 적재는 scripts/sync-gov24.ts로 하고, Cron은 변경분만 upsert하므로 보통 30초 이내. Pro 전환 시 300으로 올린다.

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const repo = createSupabaseRepo(createAdminClient())
    const result = await runGov24Sync({
      repo,
      fetchList: () => fetchAll('serviceList'),
      fetchConditions: () => fetchAll('supportConditions'),
    })

    if (result.aborted_reason) {
      return NextResponse.json({ ...result, changedSlugs: undefined }, { status: 409 })
    }

    for (const slug of result.changedSlugs) revalidateTag(`benefit:${slug}`)
    for (const seg of result.changedSegments) revalidateTag(`segment:${seg}`)
    if (result.changed > 0 || result.closed > 0) revalidateTag('benefits:home')

    return NextResponse.json({ ...result, changedSlugs: result.changedSlugs.length })
  } catch (err) {
    console.error('[cron/sync-gov24] failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 4: vercel.json**

```json
{
  "crons": [
    { "path": "/api/cron/sync-gov24", "schedule": "0 18 * * *" },
    { "path": "/api/cron/sync-gov24", "schedule": "0 3 * * *" }
  ]
}
```
(UTC 18:00 = KST 03:00, UTC 03:00 = KST 12:00)

- [ ] **Step 5: 통과 확인 및 로컬 호출**

Run: `npx vitest run src/app/api/cron`
Expected: 4 passed

로컬 실동작:
```bash
npm run dev &
sleep 5
curl -s -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/sync-gov24
```
Expected: `{"fetched":9xxx,"changed":0,...}` JSON. 401이면 `.env.local`의 CRON_SECRET 확인.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron vercel.json
git commit -m "feat(cron): 보조금24 동기화 Cron 라우트와 하루 2회 스케줄"
```

---

### Task 13: Redis 캐시 + 진단 검색 API

**Files:**
- Create: `src/lib/redis.ts`, `src/lib/benefits/search.ts`, `src/app/api/benefits/search/route.ts`
- Test: `src/lib/benefits/__tests__/search.test.ts`, `src/app/api/benefits/__tests__/search.test.ts`

- [ ] **Step 1: Redis 모듈 (청약마당에서 가져와 키만 교체)**

`src/lib/redis.ts`:
```ts
import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

export const redis = url && token ? new Redis({ url, token }) : null

export const CACHE_KEYS = {
  search: (hash: string) => `benefits:search:${hash}`,
} as const

export const CACHE_TTL = {
  search: 600, // 10분
} as const

export async function getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  if (!redis) return fetcher()
  const cached = await redis.get<T>(key)
  if (cached !== null && cached !== undefined) return cached
  const fresh = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(fresh))
  return fresh
}
```

- [ ] **Step 2: 검색 입력 파서·필터 테스트**

`src/lib/benefits/__tests__/search.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseSearchParams, ageBandToRange, matchesConditions, rankBenefits, cacheKeyFor } from '../search'

describe('parseSearchParams', () => {
  it('쿼리스트링을 검색 입력으로', () => {
    const p = parseSearchParams(new URLSearchParams('age=30s&situations=pregnancy,single&region=seoul&count=1'))
    expect(p).toEqual({ ageBand: '30s', situations: ['pregnancy', 'single'], region: 'seoul', countOnly: true, limit: 50, offset: 0 })
  })
  it('허용되지 않은 값은 버린다', () => {
    const p = parseSearchParams(new URLSearchParams('age=99s&situations=x,job_seeker&region=mars'))
    expect(p.ageBand).toBeNull()
    expect(p.situations).toEqual(['job_seeker'])
    expect(p.region).toBeNull()
  })
})

describe('ageBandToRange', () => {
  it('10s~50s+', () => {
    expect(ageBandToRange('10s')).toEqual([10, 19])
    expect(ageBandToRange('30s')).toEqual([30, 39])
    expect(ageBandToRange('50s+')).toEqual([50, 120])
    expect(ageBandToRange(null)).toBeNull()
  })
})

describe('matchesConditions', () => {
  const cond = { age_min: 19, age_max: 34, gender: 'any' as const, life_stages: ['pregnancy'], household_types: [], occupations: [], region_codes: ['seoul'] }
  it('나이 범위 겹치면 통과', () => {
    expect(matchesConditions(cond, { ageRange: [30, 39], situations: [], region: null })).toBe(true)
    expect(matchesConditions(cond, { ageRange: [40, 49], situations: [], region: null })).toBe(false)
  })
  it('나이 조건이 없는 항목은 나이로 거르지 않는다', () => {
    expect(matchesConditions({ ...cond, age_min: null, age_max: null }, { ageRange: [40, 49], situations: [], region: null })).toBe(true)
  })
  it('상황은 하나라도 일치하면 통과, 상황 조건이 없는 항목은 통과', () => {
    expect(matchesConditions(cond, { ageRange: null, situations: ['pregnancy'], region: null })).toBe(true)
    expect(matchesConditions(cond, { ageRange: null, situations: ['job_seeker'], region: null })).toBe(false)
    expect(matchesConditions({ ...cond, life_stages: [] }, { ageRange: null, situations: ['job_seeker'], region: null })).toBe(true)
  })
  it('지역은 일치 또는 전국(빈 배열)', () => {
    expect(matchesConditions(cond, { ageRange: null, situations: [], region: 'seoul' })).toBe(true)
    expect(matchesConditions(cond, { ageRange: null, situations: [], region: 'busan' })).toBe(false)
    expect(matchesConditions({ ...cond, region_codes: [] }, { ageRange: null, situations: [], region: 'busan' })).toBe(true)
  })
})

describe('rankBenefits', () => {
  it('마감 임박 → 상시 → 조건 확인 필요 순', () => {
    const rows = [
      { slug: 'always', deadline_type: 'always', apply_end: null, hasConditions: true },
      { slug: 'soon', deadline_type: 'period', apply_end: '2026-09-15', hasConditions: true },
      { slug: 'unknown', deadline_type: 'unknown', apply_end: null, hasConditions: false },
      { slug: 'later', deadline_type: 'period', apply_end: '2026-10-15', hasConditions: true },
    ]
    expect(rankBenefits(rows, new Date('2026-09-10T03:00:00Z')).map((r) => r.slug)).toEqual(['soon', 'later', 'always', 'unknown'])
  })
})

describe('cacheKeyFor', () => {
  it('입력 순서와 무관하게 같은 키', () => {
    const a = cacheKeyFor({ ageBand: '30s', situations: ['single', 'pregnancy'], region: 'seoul', countOnly: false, limit: 50, offset: 0 })
    const b = cacheKeyFor({ ageBand: '30s', situations: ['pregnancy', 'single'], region: 'seoul', countOnly: false, limit: 50, offset: 0 })
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/benefits/__tests__/search.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 검색 모듈 구현**

`src/lib/benefits/search.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { REGIONS } from '../../../data/regions'
import { daysUntil } from './status'

export const AGE_BANDS = ['10s', '20s', '30s', '40s', '50s+'] as const
export type AgeBand = (typeof AGE_BANDS)[number]
const SITUATIONS = Object.keys(SITUATION_TO_CONDITIONS)
const REGION_SLUGS = new Set(REGIONS.map((r) => r.slug))

export interface SearchInput {
  ageBand: AgeBand | null
  situations: string[]
  region: string | null
  countOnly: boolean
  limit: number
  offset: number
}

export function parseSearchParams(sp: URLSearchParams): SearchInput {
  const age = sp.get('age')
  const region = sp.get('region')
  return {
    ageBand: AGE_BANDS.includes(age as AgeBand) ? (age as AgeBand) : null,
    situations: (sp.get('situations') ?? '').split(',').map((s) => s.trim()).filter((s) => SITUATIONS.includes(s)),
    region: region && REGION_SLUGS.has(region) ? region : null,
    countOnly: sp.get('count') === '1',
    limit: Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50) || 50)),
    offset: Math.max(0, Number(sp.get('offset') ?? 0) || 0),
  }
}

export function ageBandToRange(band: AgeBand | null): [number, number] | null {
  if (!band) return null
  if (band === '50s+') return [50, 120]
  const start = Number(band.slice(0, 2))
  return [start, start + 9]
}

export interface CondLike {
  age_min: number | null
  age_max: number | null
  gender: 'any' | 'male' | 'female'
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  region_codes: string[]
}

export interface Criteria { ageRange: [number, number] | null; situations: string[]; region: string | null }

export function matchesConditions(c: CondLike, q: Criteria): boolean {
  if (q.ageRange && c.age_min !== null && c.age_max !== null) {
    if (c.age_max < q.ageRange[0] || c.age_min > q.ageRange[1]) return false
  }
  if (q.region && c.region_codes.length > 0 && !c.region_codes.includes(q.region)) return false
  if (q.situations.length > 0) {
    const hasAnySituationCond = c.life_stages.length + c.household_types.length + c.occupations.length > 0
    if (hasAnySituationCond) {
      const wanted = q.situations.map((s) => SITUATION_TO_CONDITIONS[s]).filter(Boolean)
      const hit = wanted.some((w) =>
        (w.life ?? []).some((v) => c.life_stages.includes(v)) ||
        (w.household ?? []).some((v) => c.household_types.includes(v)) ||
        (w.occupation ?? []).some((v) => c.occupations.includes(v)),
      )
      if (!hit) return false
    }
  }
  return true
}

export interface Rankable { slug: string; deadline_type: string; apply_end: string | null; hasConditions: boolean }

export function rankBenefits<T extends Rankable>(rows: T[], now: Date): T[] {
  const group = (r: Rankable) => (!r.hasConditions ? 2 : r.deadline_type === 'period' && r.apply_end ? 0 : 1)
  return [...rows].sort((a, b) => {
    const g = group(a) - group(b)
    if (g !== 0) return g
    if (group(a) === 0) return (daysUntil(a.apply_end, now) ?? 0) - (daysUntil(b.apply_end, now) ?? 0)
    return a.slug.localeCompare(b.slug)
  })
}

export function cacheKeyFor(input: SearchInput): string {
  return [input.ageBand ?? '-', [...input.situations].sort().join('+') || '-', input.region ?? '-', input.countOnly ? 'c' : 'l', input.limit, input.offset].join(':')
}

export interface SearchResultItem {
  slug: string; title: string; summary: string | null; amount_text: string | null
  deadline_type: string; apply_end: string | null; region_code: string; segments: string[]
  hasConditions: boolean; dday: number | null
}

export async function searchBenefits(supabase: SupabaseClient, input: SearchInput, now = new Date()): Promise<{ total: number; items: SearchResultItem[] }> {
  const q: Criteria = { ageRange: ageBandToRange(input.ageBand), situations: input.situations, region: input.region }

  const SELECT = 'slug, title, summary, amount_text, deadline_type, apply_end, region_code, segments, benefit_conditions(age_min, age_max, gender, life_stages, household_types, occupations, region_codes)'
  const PAGE = 1000 // Supabase 기본 최대 행 수. 넘기려면 .range()로 순회해야 한다.

  type Row = {
    slug: string; title: string; summary: string | null; amount_text: string | null
    deadline_type: string; apply_end: string | null; region_code: string; segments: string[]
    benefit_conditions: CondLike | CondLike[] | null
  }
  const data: Row[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('benefits').select(SELECT).eq('status', 'open').order('slug').range(from, from + PAGE - 1)
    if (q.region) query = query.in('region_code', [q.region, 'ALL'])
    const { data: chunk, error } = await query
    if (error) throw error
    data.push(...((chunk ?? []) as unknown as Row[]))
    if (!chunk || chunk.length < PAGE) break
  }

  const matched = data
    .map((r) => {
      const cond = Array.isArray(r.benefit_conditions) ? r.benefit_conditions[0] ?? null : r.benefit_conditions
      return { row: r, cond }
    })
    .filter(({ cond }) => !cond || matchesConditions(cond, q))
    .map(({ row, cond }) => ({
      slug: row.slug, title: row.title, summary: row.summary, amount_text: row.amount_text,
      deadline_type: row.deadline_type, apply_end: row.apply_end, region_code: row.region_code, segments: row.segments,
      hasConditions: !!cond, dday: daysUntil(row.apply_end, now),
    }))

  const ranked = rankBenefits(matched, now)
  return { total: ranked.length, items: input.countOnly ? [] : ranked.slice(input.offset, input.offset + input.limit) }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/benefits/__tests__/search.test.ts`
Expected: 모두 PASS

- [ ] **Step 6: API 라우트 테스트**

`src/app/api/benefits/__tests__/search.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const searchMock = vi.fn()
vi.mock('@/lib/benefits/search', async (orig) => ({ ...(await orig<typeof import('@/lib/benefits/search')>()), searchBenefits: (...a: unknown[]) => searchMock(...a) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))
vi.mock('@/lib/redis', () => ({ getOrSet: async (_k: string, _t: number, f: () => Promise<unknown>) => f(), CACHE_KEYS: { search: (h: string) => h }, CACHE_TTL: { search: 1 } }))

import { GET } from '@/app/api/benefits/search/route'

describe('GET /api/benefits/search', () => {
  it('총 개수와 항목을 돌려준다', async () => {
    searchMock.mockResolvedValue({ total: 27, items: [{ slug: 'a' }] })
    const res = await GET(new NextRequest('http://localhost/api/benefits/search?age=30s&situations=pregnancy&region=seoul'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ total: 27, items: [{ slug: 'a' }] })
    expect(res.headers.get('cache-control')).toContain('s-maxage')
  })
  it('오류는 500', async () => {
    searchMock.mockRejectedValue(new Error('db'))
    const res = await GET(new NextRequest('http://localhost/api/benefits/search'))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 7: 라우트 구현**

`src/app/api/benefits/search/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSearchParams, searchBenefits, cacheKeyFor } from '@/lib/benefits/search'
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const input = parseSearchParams(new URL(request.url).searchParams)
    const result = await getOrSet(CACHE_KEYS.search(cacheKeyFor(input)), CACHE_TTL.search, () => searchBenefits(createAdminClient(), input))
    return NextResponse.json(result, { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (err) {
    console.error('[api/benefits/search] failed:', err)
    return NextResponse.json({ error: 'search failed' }, { status: 500 })
  }
}
```

- [ ] **Step 8: 통과 확인 및 실호출**

Run: `npx vitest run src/app/api/benefits`
Expected: 2 passed

실호출:
```bash
curl -s "http://localhost:3000/api/benefits/search?age=30s&situations=pregnancy&region=seoul&count=1"
curl -s "http://localhost:3000/api/benefits/search?age=20s&situations=job_seeker&limit=3" | head -c 600
```
Expected: 첫 호출 `{"total":N,"items":[]}`, 두 번째는 항목 3개에 `dday`, `segments` 포함. `total`이 0이면 Task 11의 SQL로 conditions 적재를 확인한다.

- [ ] **Step 9: Commit**

```bash
git add src/lib/redis.ts src/lib/benefits/search.ts src/app/api/benefits src/lib/benefits/__tests__/search.test.ts
git commit -m "feat(search): 진단 필터 검색 모듈과 API 라우트 (Redis 캐시)"
```

---

### Task 14: 전체 검증 · 문서

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-09-10-benefits-portal-design.md` (12. 열린 질문 갱신)

- [ ] **Step 1: 전체 테스트·린트·빌드**

Run:
```bash
npm run test:run
npm run lint
npm run build
```
Expected: 테스트 전부 PASS, 린트 오류 0, 빌드 성공. 린트에서 `any`·미사용 import가 걸리면 해당 파일에서 고친다.

- [ ] **Step 2: README 작성**

`README.md`:
```markdown
# 지원금 포털 (benefits)

정부·지자체 지원금을 나이·상황·지역 조건으로 조회하는 사이트. 설계: `docs/superpowers/specs/2026-09-10-benefits-portal-design.md`

## 개발

    source ~/.nvm/nvm.sh && nvm use 22
    cp .env.local.example .env.local   # 값 채우기
    npm install
    npm run seed:static                # 시도·세그먼트
    npm run fixtures:capture           # 보조금24 샘플 응답 → fixtures/
    npm run sync:gov24                 # 전체 적재 (1~3분)
    npm run dev

## 동기화

- 로컬 전체 적재: `npm run sync:gov24`
- Vercel Cron: `/api/cron/sync-gov24` (KST 03:00, 12:00), `Authorization: Bearer $CRON_SECRET`
- 안전장치: 직전 성공 대비 30% 이상 건수 감소 시 중단(409), `sync_runs.aborted_reason` 기록
- 마감·소멸 항목은 삭제하지 않고 `status`만 closed/removed로 변경

## 검색 API

`GET /api/benefits/search?age=30s&situations=pregnancy,single&region=seoul&count=1`
- `age`: 10s | 20s | 30s | 40s | 50s+
- `situations`: pregnancy, has_child, job_seeker, business, single, no_house, student (쉼표 구분)
- `region`: 시도 slug (seoul, gyeonggi …)
- `count=1`이면 총 개수만

## 테스트

    npm run test:run
```

- [ ] **Step 3: 스펙의 열린 질문 갱신**

`docs/superpowers/specs/2026-09-10-benefits-portal-design.md` 섹션 12의 첫 항목을 실제 확인 결과로 바꾼다:
```markdown
- 보조금24 지원조건 코드표 → Plan 1 Task 7에서 fixture 기준으로 `src/lib/conditions/codemap.ts`에 확정. 나이 코드는 `AGE_MIN_CODE`/`AGE_MAX_CODE` 상수값을 그대로 옮겨 적는다. 미매핑 코드 0개(커버리지 테스트로 보장).
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-09-10-benefits-portal-design.md
git commit -m "docs: README와 스펙 열린 질문 갱신 (Plan 1 완료)"
```

---

## 완료 기준 (스펙 11. 1단계)

- [ ] `benefits` 약 1만 건 적재, `benefit_conditions` 대부분 채움
- [ ] `npm run sync:gov24` 2회 실행 시 두 번째는 `skipped`가 거의 전체
- [ ] Cron 라우트가 401/200/409/500을 구분하고 변경 태그를 재검증
- [ ] 세그먼트 3개 각각 수백 건 이상 태깅, 지역 slug 17개 + ALL
- [ ] 검색 API가 나이·상황·지역 조합으로 결과와 개수를 반환
- [ ] 단위·통합 테스트 전부 통과, 빌드 성공

## Plan 2 예고 (별도 문서)

홈 진단 UI, `/my`, 세그먼트 허브, 세그먼트×지역, 상세 페이지(A안), 마감 캘린더, 필수 페이지, AdSlot(애드핏), 반응형, 메타·JSON-LD·사이트맵. Plan 1의 `searchBenefits`, `daysUntil`, 태그 이름(`benefit:{slug}`, `segment:{seg}`, `benefits:home`)을 그대로 사용한다.
