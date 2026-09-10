# 지원금 포털 — Plan 2: 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 이 워크스페이스에서는 서브에이전트가 멈추는 문제가 있어 executing-plans(인라인)를 권장한다.

**Goal:** Plan 1의 데이터 위에 홈 진단, 진단 결과, 세그먼트 허브, 세그먼트×지역, 지원금 상세(A안), 마감 캘린더, 필수 페이지, 광고 슬롯, 메타·JSON-LD·사이트맵을 갖춘 색인 가능한 반응형 사이트를 만든다.

**Architecture:** 서버 컴포넌트가 Supabase(anon, RLS 공개 읽기)에서 데이터를 읽고 ISR 태그(`benefit:{slug}`, `segment:{seg}`, `benefits:home`)로 캐시한다. 개인화(진단 칩, 30초 체크 프리필)는 클라이언트 컴포넌트 두 개가 localStorage `diagnosis` 키를 공유한다. 색인 여부는 한 함수 `indexPolicy()`가 결정하고 모든 페이지의 `robots` 메타와 사이트맵이 그 함수를 따른다. UI 프리미티브는 Tailwind 클래스만 쓴다(@base-ui 의존 없음).

**Tech Stack:** Next.js 15 App Router(ISR, `unstable_cache`, `generateMetadata`, `ImageResponse`), React 19, Tailwind 4, Supabase JS, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-09-10-benefits-portal-design.md` 섹션 5, 6, 7, 9, 10, 11의 2단계, 12의 Plan 2 이관 질문
**선행:** Plan 1 완료(main `93377b8`), Supabase에 10,947건 적재됨, `.env.local` 채워짐

---

## 파일 구조

```
src/
├── app/
│   ├── layout.tsx                      # robots index true로 전환, 폰트, GA4/AdSense 스크립트(env 있을 때)
│   ├── sitemap.ts, robots.ts, opengraph-image.tsx
│   ├── (site)/
│   │   ├── layout.tsx                  # Header + main + Footer
│   │   ├── page.tsx                    # 홈
│   │   ├── my/page.tsx                 # 진단 결과 (CSR, noindex)
│   │   ├── [segment]/page.tsx          # 세그먼트 허브 (/youth /parenting /small-biz)
│   │   ├── [segment]/[region]/page.tsx # 세그먼트×지역
│   │   ├── benefit/[slug]/page.tsx     # 상세
│   │   ├── deadline/page.tsx           # 마감 캘린더
│   │   ├── guide/[slug]/page.tsx       # 가이드 (guides 테이블, Plan 3에서 채움)
│   │   └── about|privacy|terms|contact/page.tsx
│   └── api/…                           # Plan 1 그대로
├── components/
│   ├── layout/Header.tsx, Footer.tsx
│   ├── ads/AdSlot.tsx                  # 청약마당 복사 (그대로)
│   ├── benefits/
│   │   ├── BenefitCard.tsx             # 목록 카드 (제목·배지·요약)
│   │   ├── DdayBadge.tsx
│   │   ├── BenefitList.tsx             # 카드 목록 + 5번째 뒤 광고
│   │   ├── SummaryGrid.tsx             # 상세 상단 4칸
│   │   ├── Checklist.tsx               # 30초 체크 (client, localStorage 프리필)
│   │   ├── StickyRail.tsx              # 데스크톱 우측 레일(목차·신청·광고)
│   │   └── SourceFooter.tsx            # 출처·최종 확인
│   └── diagnosis/
│       ├── DiagnosisPanel.tsx          # 홈 칩 3줄 + 개수 버튼 (client)
│       └── DiagnosisResults.tsx        # /my 결과 목록 (client)
├── lib/
│   ├── utils.ts                        # cn()
│   ├── supabase/server.ts              # anon 클라이언트(쿠키 없음)
│   ├── diagnosis/storage.ts            # localStorage 스키마·읽기/쓰기·쿼리스트링 변환
│   ├── diagnosis/options.ts            # 칩 정의(나이·상황·지역 라벨)
│   ├── benefits/queries.ts             # 서버 조회 함수 (태그 캐시)
│   ├── benefits/checklist.ts           # 조건 → 체크 항목, 프리필 평가 (pure)
│   ├── benefits/format.ts              # D-day 문구, 기한 문구, 원문 첫 줄 추출, KST 시각 (pure)
│   ├── seo/index-policy.ts             # 색인 여부 결정 (pure)
│   ├── seo/jsonld.ts                   # GovernmentService·BreadcrumbList·FAQPage·ItemList 생성 (pure)
│   └── seo/site.ts                     # SITE_NAME, SITE_URL, absoluteUrl()
└── data/
    └── segments.ts                     # Plan 1 것에 URL slug(small-biz) 매핑 추가
```

세그먼트 URL: DB 값 `small_biz` ↔ URL `small-biz`. 변환은 `data/segments.ts`의 `SEGMENT_BY_PATH`/`pathOf()`만 사용한다.

---

### Task 1: 공통 기반 — utils, anon 클라이언트, site 상수, 세그먼트 경로 매핑

**Files:**
- Create: `src/lib/utils.ts`, `src/lib/supabase/server.ts`, `src/lib/seo/site.ts`
- Modify: `data/segments.ts`
- Test: `src/lib/seo/__tests__/site.test.ts`, `data/__tests__/segments.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`data/__tests__/segments.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SEGMENT_BY_PATH, pathOf, PUBLIC_SEGMENTS } from '../segments'

describe('segment path mapping', () => {
  it('URL 경로 ↔ DB 값', () => {
    expect(pathOf('small_biz')).toBe('small-biz')
    expect(pathOf('youth')).toBe('youth')
    expect(SEGMENT_BY_PATH['small-biz']?.slug).toBe('small_biz')
    expect(SEGMENT_BY_PATH['nope']).toBeUndefined()
  })
  it('공개 세그먼트는 other를 제외한 3개', () => {
    expect(PUBLIC_SEGMENTS.map((s) => s.slug)).toEqual(['youth', 'parenting', 'small_biz'])
  })
})
```

`src/lib/seo/__tests__/site.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { absoluteUrl, siteName, siteUrl } from '../site'

describe('site', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'
    process.env.SITE_NAME = '테스트포털'
  })
  it('절대 URL은 슬래시를 중복하지 않는다', () => {
    expect(absoluteUrl('/youth')).toBe('https://example.com/youth')
    expect(absoluteUrl('youth')).toBe('https://example.com/youth')
    expect(siteUrl()).toBe('https://example.com')
  })
  it('빈 문자열 env는 기본값으로 (상대 URL 유출 방지)', () => {
    process.env.NEXT_PUBLIC_SITE_URL = ''
    process.env.SITE_NAME = '   '
    expect(siteUrl()).toBe('http://localhost:3000')
    expect(absoluteUrl('/youth')).toBe('http://localhost:3000/youth')
    expect(siteName()).toBe('지원금 포털')
  })

  it('사이트명은 env, 없으면 기본값', () => {
    expect(siteName()).toBe('테스트포털')
    delete process.env.SITE_NAME
    expect(siteName()).toBe('지원금 포털')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run data src/lib/seo`
Expected: FAIL — export 없음 / 모듈 없음

- [ ] **Step 3: 구현**

`data/segments.ts` 전체 교체:
```ts
import type { Segment } from '../src/types/database'

export interface SegmentDef {
  slug: Segment
  path: string // URL 세그먼트
  name: string
  sort_order: number
  description_md: string
}

export const SEGMENTS: SegmentDef[] = [
  { slug: 'youth', path: 'youth', name: '청년', sort_order: 1, description_md: '만 19~39세 청년을 위한 취업·주거·자산형성·창업 지원금.' },
  { slug: 'parenting', path: 'parenting', name: '출산·육아', sort_order: 2, description_md: '임신·출산·영유아·아동 양육 가정을 위한 급여와 바우처.' },
  { slug: 'small_biz', path: 'small-biz', name: '소상공인', sort_order: 3, description_md: '소상공인·자영업자·예비창업자를 위한 자금·경영·판로 지원.' },
  { slug: 'other', path: 'other', name: '기타', sort_order: 99, description_md: '' },
]

export const PUBLIC_SEGMENTS = SEGMENTS.filter((s) => s.slug !== 'other')
// 값은 신뢰할 수 없는 URL 세그먼트로 조회되므로 undefined를 타입에 남겨 호출자가 반드시 검사하게 한다
export const SEGMENT_BY_PATH: Record<string, SegmentDef | undefined> = Object.fromEntries(SEGMENTS.map((s) => [s.path, s]))
export const SEGMENT_BY_SLUG: Record<string, SegmentDef> = Object.fromEntries(SEGMENTS.map((s) => [s.slug, s]))
export function pathOf(slug: Segment): string {
  return SEGMENT_BY_SLUG[slug].path
}
```
`scripts/seed-static.ts`는 `{ slug, name, sort_order, description_md }`만 뽑아 쓰므로 수정 불필요.

`src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`src/lib/supabase/server.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

/** 공개 읽기 전용(anon) 클라이언트. 서버 컴포넌트·사이트맵에서 사용. 세션·쿠키 없음. */
export function createPublicClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 누락')
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}
```

`src/lib/seo/site.ts`:
```ts
export function siteName(): string {
  return process.env.SITE_NAME?.trim() || '지원금 포털'
}

// ?? 가 아니라 || 를 쓴다. 빈 문자열 env를 그대로 통과시키면 canonical·사이트맵·JSON-LD가
// 상대 URL로 새어나가 색인이 깨진다(.env.local.example은 대부분의 값을 빈 칸으로 배포한다).
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}/${path.replace(/^\/+/, '')}`
}

export const SITE_DESCRIPTION = '나이·상황·지역 조건으로 받을 수 있는 정부·지자체 지원금을 한눈에 확인하세요.'
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run data src/lib/seo`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add data src/lib/utils.ts src/lib/supabase/server.ts src/lib/seo
git commit -m "feat: 공통 기반 (cn, anon 클라이언트, site 상수, 세그먼트 URL 매핑)"
```

---

### Task 2: 순수 함수 — 포맷, 색인 정책, JSON-LD

**Files:**
- Create: `src/lib/benefits/format.ts`, `src/lib/seo/index-policy.ts`, `src/lib/seo/jsonld.ts`
- Test: `src/lib/benefits/__tests__/format.test.ts`, `src/lib/seo/__tests__/index-policy.test.ts`, `src/lib/seo/__tests__/jsonld.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/benefits/__tests__/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ddayLabel, deadlineLabel, firstLine, formatKstDate } from '../format'

describe('ddayLabel', () => {
  it('D-n, 오늘 마감, 마감됨, null', () => {
    expect(ddayLabel(12)).toBe('D-12')
    expect(ddayLabel(0)).toBe('오늘 마감')
    expect(ddayLabel(-3)).toBe('마감됨')
    expect(ddayLabel(null)).toBeNull()
  })
})

describe('deadlineLabel', () => {
  it('유형별 문구', () => {
    expect(deadlineLabel({ deadline_type: 'always', apply_start: null, apply_end: null })).toBe('상시 신청')
    expect(deadlineLabel({ deadline_type: 'period', apply_start: '2026-03-01', apply_end: '2026-03-31' })).toBe('2026.03.01 ~ 2026.03.31')
    expect(deadlineLabel({ deadline_type: 'period', apply_start: null, apply_end: '2026-03-31' })).toBe('2026.03.31까지')
    expect(deadlineLabel({ deadline_type: 'unknown', apply_start: null, apply_end: null })).toBe('공고 확인')
  })
})

describe('firstLine', () => {
  it('연도로 시작하는 줄은 연도를 보존한다 (번호 목록으로 오인 금지)', () => {
    expect(firstLine('2026.03.01. ~ 2026.03.31. 접수')).toBe('2026.03.01. ~ 2026.03.31. 접수')
    expect(firstLine('※ 2026. 3. 1~2027.2.28. 까지 적용')).toBe('2026. 3. 1~2027.2.28. 까지 적용')
  })

  it('번호 목록 접두사는 제거한다', () => {
    expect(firstLine('1) 지원 대상')).toBe('지원 대상')
    expect(firstLine('3. 신청 방법')).toBe('신청 방법')
  })

  it('원문의 첫 의미 있는 줄을 120자 이내로', () => {
    expect(firstLine('○ 3~5세에 대해 교육비를 지급합니다.\r\n  - 국공립 100,000원')).toBe('3~5세에 대해 교육비를 지급합니다.')
    expect(firstLine(null)).toBeNull()
    expect(firstLine('가'.repeat(200))!.length).toBe(120)
  })
})

describe('formatKstDate', () => {
  it('ISO → YYYY.MM.DD HH:mm (KST)', () => {
    expect(formatKstDate('2026-09-10T03:05:00.000Z')).toBe('2026.09.10 12:05')
  })
})
```

`src/lib/seo/__tests__/index-policy.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { benefitIndexable, hubIndexable, regionHubIndexable } from '../index-policy'

describe('index policy', () => {
  it('상세: 게재된 해설이 있고 open일 때만 색인', () => {
    expect(benefitIndexable({ status: 'open', article: { review_status: 'published', indexable: true } })).toBe(true)
    expect(benefitIndexable({ status: 'open', article: { review_status: 'stale', indexable: true } })).toBe(true) // stale도 유지
    expect(benefitIndexable({ status: 'open', article: { review_status: 'draft', indexable: false } })).toBe(false)
    expect(benefitIndexable({ status: 'open', article: null })).toBe(false)
    expect(benefitIndexable({ status: 'closed', article: { review_status: 'published', indexable: true } })).toBe(false)
  })
  it('세그먼트 허브는 항상 색인', () => {
    expect(hubIndexable()).toBe(true)
  })
  it('세그먼트×지역: 항목 3개 이상이고 지역 안내문이 있을 때', () => {
    expect(regionHubIndexable({ count: 3, description_md: '서울 안내' })).toBe(true)
    expect(regionHubIndexable({ count: 2, description_md: '서울 안내' })).toBe(false)
    expect(regionHubIndexable({ count: 10, description_md: null })).toBe(false)
    expect(regionHubIndexable({ count: 10, description_md: '  ' })).toBe(false)
  })
})
```

`src/lib/seo/__tests__/jsonld.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { governmentService, breadcrumbs, faqPage, itemList } from '../jsonld'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
})

describe('jsonld', () => {
  it('GovernmentService', () => {
    const j = governmentService({ title: '서울 임산부 교통비', summary: '70만원', agency: '서울특별시', region_name: '서울', apply_url: 'https://gov.kr/x', slug: 'a' })
    expect(j['@type']).toBe('GovernmentService')
    expect(j.name).toBe('서울 임산부 교통비')
    expect(j.provider).toEqual({ '@type': 'GovernmentOrganization', name: '서울특별시' })
    expect(j.areaServed).toBe('서울')
    expect(j.url).toBe('https://example.com/benefit/a')
    expect(j.sameAs).toBe('https://gov.kr/x')
  })
  it('BreadcrumbList 위치는 1부터', () => {
    const j = breadcrumbs([{ name: '홈', path: '/' }, { name: '청년', path: '/youth' }])
    expect(j.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: '청년', item: 'https://example.com/youth' })
  })
  it('FAQPage는 항목이 없으면 null', () => {
    expect(faqPage([])).toBeNull()
    expect(faqPage([{ q: 'Q', a: 'A' }])!.mainEntity[0].acceptedAnswer.text).toBe('A')
  })
  it('ItemList', () => {
    const j = itemList([{ name: 'a', path: '/benefit/a' }])
    expect(j.itemListElement[0].url).toBe('https://example.com/benefit/a')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/benefits/__tests__/format.test.ts src/lib/seo`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/benefits/format.ts`:
```ts
import type { DeadlineType } from '@/types/database'

export function ddayLabel(dday: number | null): string | null {
  if (dday === null) return null
  if (dday < 0) return '마감됨'
  if (dday === 0) return '오늘 마감'
  return `D-${dday}`
}

function dots(iso: string): string {
  return iso.replace(/-/g, '.')
}

export function deadlineLabel(b: { deadline_type: DeadlineType | string; apply_start: string | null; apply_end: string | null }): string {
  if (b.deadline_type === 'always') return '상시 신청'
  if (b.deadline_type === 'period' && b.apply_end) {
    return b.apply_start ? `${dots(b.apply_start)} ~ ${dots(b.apply_end)}` : `${dots(b.apply_end)}까지`
  }
  return '공고 확인'
}

// 글머리 기호 + (번호·원문자 목록 접두사) + 남은 기호를 제거한다. 기호 목록은 실제 보조금24
// 원문(fixtures/gov24)에서 확인된 것들이다. 번호는 1~2자리에 구분자 뒤 공백까지 있어야 목록으로
// 본다('2026.03.01.'의 연도가 잘리지 않게). 괄호·대괄호로 시작하는 줄은 의미 있는 내용이므로 남긴다.
const BULLET_PREFIX = /^[\s○●◦•‧∙·ㆍ□◇◈▪▫▶►▷☞※＊*\-–]*(?:[①-⑳]|\d{1,2}\s*[.)]\s+)?[\s○●◦•‧∙·ㆍ□◇◈▪▫▶►▷☞※＊*\-–]*/

/** 원문에서 첫 의미 있는 줄. 글머리 기호 제거, 120자 상한. */
export function firstLine(text: string | null | undefined, max = 120): string | null {
  if (!text) return null
  const line = text
    .split(/\r?\n/)
    .map((l) => l.replace(BULLET_PREFIX, '').trim())
    .find((l) => l.length > 0)
  if (!line) return null
  return line.length > max ? line.slice(0, max) : line
}

export function formatKstDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}
```

`src/lib/seo/index-policy.ts`:
```ts
/** 색인 여부는 이 파일에서만 결정한다. 페이지 robots 메타와 사이트맵이 모두 이 함수를 따른다. */

export interface ArticleFlags {
  review_status: string
  indexable: boolean
}

export function benefitIndexable(b: { status: string; article: ArticleFlags | null }): boolean {
  if (b.status !== 'open') return false
  if (!b.article) return false
  // published 후 원천이 바뀐 stale은 색인을 유지한다(페이지에 "내용 확인 중" 배지)
  return b.article.indexable && (b.article.review_status === 'published' || b.article.review_status === 'stale')
}

export function hubIndexable(): boolean {
  return true
}

export const REGION_HUB_MIN_ITEMS = 3

export function regionHubIndexable(r: { count: number; description_md: string | null }): boolean {
  return r.count >= REGION_HUB_MIN_ITEMS && !!r.description_md?.trim()
}
```

`src/lib/seo/jsonld.ts`:
```ts
import { absoluteUrl } from './site'

export function governmentService(b: {
  title: string
  summary: string | null
  agency: string | null
  region_name: string | null
  apply_url: string | null
  slug: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: b.title,
    description: b.summary ?? undefined,
    provider: b.agency ? { '@type': 'GovernmentOrganization', name: b.agency } : undefined,
    areaServed: b.region_name ?? '대한민국',
    url: absoluteUrl(`/benefit/${b.slug}`),
    sameAs: b.apply_url ?? undefined,
  }
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  }
}

export function faqPage(items: { q: string; a: string }[]) {
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

export function itemList(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: absoluteUrl(it.path) })),
  }
}

/** <script type="application/ld+json"> 에 넣을 문자열. XSS 방지를 위해 '<'를 이스케이프. */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/benefits/__tests__/format.test.ts src/lib/seo`
Expected: 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/benefits/format.ts src/lib/seo
git commit -m "feat: 포맷·색인 정책·JSON-LD 순수 함수"
```

---

### Task 3: 진단 상태(localStorage)와 칩 옵션

**Files:**
- Create: `src/lib/benefits/age-bands.ts`, `src/lib/diagnosis/options.ts`, `src/lib/diagnosis/storage.ts`
- Modify: `src/lib/benefits/search.ts` (AGE_BANDS를 leaf 모듈에서 re-export, situations 중복 제거)
- Test: `src/lib/diagnosis/__tests__/storage.test.ts`, `src/lib/diagnosis/__tests__/options.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/diagnosis/__tests__/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { readDiagnosis, writeDiagnosis, toSearchParams, isEmpty, type Diagnosis } from '../storage'

describe('diagnosis storage', () => {
  beforeEach(() => localStorage.clear())

  it('저장하고 읽는다', () => {
    const d: Diagnosis = { ageBand: '30s', situations: ['pregnancy'], region: 'seoul' }
    writeDiagnosis(d)
    expect(readDiagnosis()).toEqual(d)
  })
  it('없거나 깨진 값은 빈 진단', () => {
    expect(readDiagnosis()).toEqual({ ageBand: null, situations: [], region: null })
    localStorage.setItem('diagnosis', '{not json')
    expect(readDiagnosis()).toEqual({ ageBand: null, situations: [], region: null })
  })
  it('허용되지 않은 값은 걸러낸다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '99s', situations: ['x', 'single'], region: 'mars' }))
    expect(readDiagnosis()).toEqual({ ageBand: null, situations: ['single'], region: null })
  })
  it('검색 API 쿼리스트링으로 변환', () => {
    expect(toSearchParams({ ageBand: '20s', situations: ['job_seeker', 'single'], region: null }).toString()).toBe('age=20s&situations=job_seeker%2Csingle')
    expect(toSearchParams({ ageBand: null, situations: [], region: 'busan' }).toString()).toBe('region=busan')
  })
  it('isEmpty', () => {
    expect(isEmpty({ ageBand: null, situations: [], region: null })).toBe(true)
    expect(isEmpty({ ageBand: null, situations: ['single'], region: null })).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/diagnosis`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/diagnosis/options.ts`:
```ts
// AGE_BANDS는 leaf 모듈에서 가져온다. search.ts를 value로 import하면 codemap·regions·status까지
// 클라이언트 번들에 끌려온다(이 모듈은 클라이언트 컴포넌트가 쓴다).
import { AGE_BANDS, type AgeBand } from '@/lib/benefits/age-bands'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { REGIONS } from '../../../data/regions'

export const AGE_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: '10s', label: '10대' },
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50s+', label: '50대 이상' },
]

export const SITUATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'pregnancy', label: '임신·출산' },
  { value: 'has_child', label: '자녀 있음' },
  { value: 'job_seeker', label: '구직 중' },
  { value: 'business', label: '사업자' },
  { value: 'single', label: '1인 가구' },
  { value: 'no_house', label: '무주택' },
  { value: 'student', label: '대학(원)생' },
]

export const REGION_OPTIONS: { value: string; label: string }[] = REGIONS.map((r) => ({ value: r.slug, label: r.name }))

export const VALID_AGE = new Set<string>(AGE_BANDS)
export const VALID_SITUATION = new Set(Object.keys(SITUATION_TO_CONDITIONS))
export const VALID_REGION = new Set(REGIONS.map((r) => r.slug))

// 칩 목록과 codemap 키의 일치는 모듈 레벨 throw가 아니라
// src/lib/diagnosis/__tests__/options.test.ts 에서 양방향 집합 비교로 검증한다.
```

`src/lib/diagnosis/storage.ts`:
```ts
import type { AgeBand } from '@/lib/benefits/age-bands'
import { VALID_AGE, VALID_SITUATION, VALID_REGION } from './options'

export interface Diagnosis {
  ageBand: AgeBand | null
  situations: string[]
  region: string | null
}

export const STORAGE_KEY = 'diagnosis'

/** 읽기 전용 기본값. 호출자가 실수로 변형하지 못하게 동결한다. 새 객체가 필요하면 emptyDiagnosis(). */
export const EMPTY: Diagnosis = Object.freeze({ ageBand: null, situations: [], region: null }) as Diagnosis

/** 매번 새 객체를 돌려준다. 호출자가 situations를 직접 변형해도 모듈 상태가 오염되지 않는다. */
export function emptyDiagnosis(): Diagnosis {
  return { ageBand: null, situations: [], region: null }
}

function sanitize(raw: unknown): Diagnosis {
  if (!raw || typeof raw !== 'object') return emptyDiagnosis()
  const o = raw as Record<string, unknown>
  const ageBand = typeof o.ageBand === 'string' && VALID_AGE.has(o.ageBand) ? (o.ageBand as AgeBand) : null
  // 중복 제거: 손으로 편집한 payload가 캐시 키를 무한정 늘리지 못하게 한다
  const situations = Array.isArray(o.situations)
    ? [...new Set(o.situations.filter((s): s is string => typeof s === 'string' && VALID_SITUATION.has(s)))]
    : []
  const region = typeof o.region === 'string' && VALID_REGION.has(o.region) ? o.region : null
  return { ageBand, situations, region }
}

export function readDiagnosis(): Diagnosis {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : emptyDiagnosis()
  } catch {
    return emptyDiagnosis()
  }
}

export function writeDiagnosis(d: Diagnosis): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(d)))
  } catch {
    // 사생활 보호 모드 등에서 저장 실패는 무시
  }
}

export function toSearchParams(d: Diagnosis): URLSearchParams {
  const sp = new URLSearchParams()
  if (d.ageBand) sp.set('age', d.ageBand)
  if (d.situations.length) sp.set('situations', d.situations.join(','))
  if (d.region) sp.set('region', d.region)
  return sp
}

export function isEmpty(d: Diagnosis): boolean {
  return !d.ageBand && d.situations.length === 0 && !d.region
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/diagnosis`
Expected: 5 passed (vitest 환경이 jsdom이므로 localStorage 사용 가능)

- [ ] **Step 5: Commit**

```bash
git add src/lib/diagnosis
git commit -m "feat(diagnosis): 진단 상태 localStorage 스키마와 칩 옵션"
```

---

### Task 4: 서버 조회 함수 (queries.ts)

**Files:**
- Create: `src/lib/benefits/queries.ts`
- Test: `src/lib/benefits/__tests__/queries.test.ts`

모든 함수는 `createPublicClient()`를 쓰고 `unstable_cache`로 태그를 붙인다. 태그 이름은 Plan 1 Cron 라우트가 재검증하는 이름과 같아야 한다: `benefit:{slug}`, `segment:{seg}`, `benefits:home`.

- [ ] **Step 1: 실패하는 테스트 (Supabase mock)**

`src/lib/benefits/__tests__/queries.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// unstable_cache는 테스트에서 그대로 통과시킨다
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }))

const chain = () => {
  const c: Record<string, unknown> = {}
  const self = () => c
  for (const m of ['select', 'eq', 'neq', 'in', 'contains', 'gte', 'lte', 'gt', 'order', 'limit', 'range', 'not', 'is']) c[m] = vi.fn(self)
  c.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  return c as Record<string, ReturnType<typeof vi.fn>>
}
const from = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createPublicClient: () => ({ from }) }))

import { getBenefitBySlug, listBySegment, listDeadlineSoon, countByRegion } from '../queries'

describe('queries', () => {
  beforeEach(() => from.mockReset())

  it('getBenefitBySlug는 조건·해설을 함께 조인하고 없으면 null', async () => {
    const c = chain()
    c.maybeSingle.mockResolvedValue({ data: { slug: 'a', title: 'T', benefit_conditions: null, benefit_articles: null }, error: null })
    from.mockReturnValue(c)
    const b = await getBenefitBySlug('a')
    expect(from).toHaveBeenCalledWith('benefits')
    expect(c.select.mock.calls[0][0]).toMatch(/benefit_conditions\(/)
    expect(c.select.mock.calls[0][0]).toMatch(/benefit_articles\(/)
    expect(c.eq).toHaveBeenCalledWith('slug', 'a')
    expect(b?.title).toBe('T')

    c.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getBenefitBySlug('zzz')).toBeNull()
  })

  it('listBySegment는 open + 세그먼트 포함 + 지역(선택) 필터', async () => {
    const c = chain()
    c.limit.mockResolvedValue({ data: [{ slug: 'x' }], error: null })
    from.mockReturnValue(c)
    const rows = await listBySegment('youth', { region: 'seoul', limit: 20 })
    expect(c.eq).toHaveBeenCalledWith('status', 'open')
    expect(c.contains).toHaveBeenCalledWith('segments', ['youth'])
    expect(c.in).toHaveBeenCalledWith('region_code', ['seoul', 'ALL'])
    expect(rows).toEqual([{ slug: 'x' }])
  })

  it('listDeadlineSoon은 오늘~N일 사이 기간 항목만', async () => {
    const c = chain()
    c.limit.mockResolvedValue({ data: [], error: null })
    from.mockReturnValue(c)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T03:00:00Z'))
    await listDeadlineSoon(14)
    expect(c.eq).toHaveBeenCalledWith('deadline_type', 'period')
    expect(c.gte).toHaveBeenCalledWith('apply_end', '2026-09-10')
    expect(c.lte).toHaveBeenCalledWith('apply_end', '2026-09-24')
  })

  it('countByRegion은 region_code별 건수를 집계한다', async () => {
    const c = chain()
    c.contains.mockResolvedValue({ data: [{ region_code: 'seoul' }, { region_code: 'seoul' }, { region_code: 'ALL' }], error: null })
    from.mockReturnValue(c)
    const counts = await countByRegion('youth')
    expect(counts).toEqual({ seoul: 2, ALL: 1 })
  })

  it('오류는 throw', async () => {
    const c = chain()
    c.limit.mockResolvedValue({ data: null, error: { message: 'boom' } })
    from.mockReturnValue(c)
    await expect(listBySegment('youth', {})).rejects.toBeTruthy()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/benefits/__tests__/queries.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/benefits/queries.ts`:
```ts
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { kstDateString } from './status'
import type { Segment } from '@/types/database'

export interface BenefitListRow {
  slug: string
  title: string
  summary: string | null
  amount_text: string | null
  deadline_type: string
  apply_start: string | null
  apply_end: string | null
  region_code: string
  segments: Segment[]
  agency: string | null
  synced_at: string
}

export interface ConditionJoin {
  age_min: number | null
  age_max: number | null
  gender: string
  income_bands: string[]
  life_stages: string[]
  household_types: string[]
  occupations: string[]
  region_codes: string[]
}

export interface ArticleJoin {
  explainer_md: string | null
  steps_md: string | null
  faq_json: { q: string; a: string }[]
  checklist_json: { label: string; condition_key: string }[]
  related_ids: string[]
  review_status: string
  indexable: boolean
  reviewed_at: string | null
}

export interface BenefitDetail extends BenefitListRow {
  id: string
  target_text: string | null
  criteria_text: string | null
  apply_method: string | null
  apply_url: string | null
  contact: string | null
  status: string
  source_updated_at: string | null
  benefit_conditions: ConditionJoin | null
  benefit_articles: ArticleJoin | null
}

const LIST_COLS = 'slug, title, summary, amount_text, deadline_type, apply_start, apply_end, region_code, segments, agency, synced_at'
const DETAIL_COLS = `id, ${LIST_COLS}, target_text, criteria_text, apply_method, apply_url, contact, status, source_updated_at,
  benefit_conditions(age_min, age_max, gender, income_bands, life_stages, household_types, occupations, region_codes),
  benefit_articles(explainer_md, steps_md, faq_json, checklist_json, related_ids, review_status, indexable, reviewed_at)`

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export const getBenefitBySlug = unstable_cache(
  async (slug: string): Promise<BenefitDetail | null> => {
    const { data, error } = await createPublicClient().from('benefits').select(DETAIL_COLS).eq('slug', slug).maybeSingle()
    if (error) throw error
    if (!data) return null
    const d = data as unknown as BenefitDetail & { benefit_conditions: ConditionJoin | ConditionJoin[] | null; benefit_articles: ArticleJoin | ArticleJoin[] | null }
    return { ...d, benefit_conditions: one(d.benefit_conditions), benefit_articles: one(d.benefit_articles) }
  },
  ['benefit-by-slug'],
  { tags: ['benefits:all'], revalidate: 21600 },
)

export interface ListOptions {
  region?: string | null
  limit?: number
}

export const listBySegment = unstable_cache(
  async (segment: Segment, opts: ListOptions): Promise<BenefitListRow[]> => {
    let q = createPublicClient().from('benefits').select(LIST_COLS).eq('status', 'open').contains('segments', [segment])
    if (opts.region) q = q.in('region_code', [opts.region, 'ALL'])
    const { data, error } = await q.order('apply_end', { ascending: true, nullsFirst: false }).limit(opts.limit ?? 50)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['list-by-segment'],
  { tags: ['benefits:all'], revalidate: 3600 },
)

export const listDeadlineSoon = unstable_cache(
  // '오늘'을 인자로 받지 않는다. unstable_cache는 인자까지 키에 넣으므로 요청마다 new Date()를
  // 넘기면 키가 매번 달라져 캐시 적중률이 0이 되고 revalidate·태그가 무력화된다.
  async (days: number, limit = 8): Promise<BenefitListRow[]> => {
    const now = new Date()
    const from = kstDateString(now)
    const to = kstDateString(new Date(now.getTime() + days * 86_400_000))
    const { data, error } = await createPublicClient()
      .from('benefits')
      .select(LIST_COLS)
      .eq('status', 'open')
      .eq('deadline_type', 'period')
      .gte('apply_end', from)
      .lte('apply_end', to)
      .order('apply_end', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['deadline-soon'],
  { tags: ['benefits:home'], revalidate: 3600 },
)

export const listRecentlyUpdated = unstable_cache(
  // listDeadlineSoon과 같은 이유로 현재 시각을 인자로 받지 않는다.
  async (hours: number, limit = 8): Promise<BenefitListRow[]> => {
    const since = new Date(Date.now() - hours * 3_600_000).toISOString()
    const { data, error } = await createPublicClient()
      .from('benefits')
      .select(LIST_COLS)
      .eq('status', 'open')
      .gte('source_updated_at', since)
      .order('source_updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['recently-updated'],
  { tags: ['benefits:home'], revalidate: 3600 },
)

export const countByRegion = unstable_cache(
  async (segment: Segment): Promise<Record<string, number>> => {
    const { data, error } = await createPublicClient().from('benefits').select('region_code').eq('status', 'open').contains('segments', [segment])
    if (error) throw error
    const counts: Record<string, number> = {}
    for (const r of (data ?? []) as { region_code: string }[]) counts[r.region_code] = (counts[r.region_code] ?? 0) + 1
    return counts
  },
  ['count-by-region'],
  { tags: ['benefits:all'], revalidate: 3600 },
)

export const listRelated = unstable_cache(
  async (segment: Segment, region: string, excludeSlug: string, limit = 6): Promise<BenefitListRow[]> => {
    const { data, error } = await createPublicClient()
      .from('benefits')
      .select(LIST_COLS)
      .eq('status', 'open')
      .contains('segments', [segment])
      .in('region_code', [region, 'ALL'])
      .neq('slug', excludeSlug)
      .order('apply_end', { ascending: true, nullsFirst: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as BenefitListRow[]
  },
  ['related'],
  { tags: ['benefits:all'], revalidate: 21600 },
)

export const getRegionMeta = unstable_cache(
  async (slug: string): Promise<{ code: string; slug: string; name: string; description_md: string | null } | null> => {
    const { data, error } = await createPublicClient().from('regions').select('code, slug, name, description_md').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data
  },
  ['region-meta'],
  { tags: ['regions'], revalidate: 86400 },
)

export const getLastSyncAt = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await createPublicClient()
      .from('sync_runs')
      .select('finished_at')
      .is('error', null)
      .is('aborted_reason', null)
      // 진행 중인 동기화 행도 error·aborted_reason이 null이라 정렬 1위가 된다. finished_at을
      // 요구하지 않으면 동기화가 도는 동안 홈의 '마지막 확인' 줄이 빈다.
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.finished_at ?? null
  },
  ['last-sync'],
  { tags: ['benefits:home'], revalidate: 600 },
)
```

`sync_runs`는 RLS가 켜져 있고 공개 정책이 없다. `getLastSyncAt`이 anon으로 읽을 수 있게 마이그레이션을 추가한다:

`supabase/migrations/002_sync_runs_public_read.sql`:
```sql
create policy "public read sync_runs" on sync_runs for select using (true);
```
Supabase 대시보드 SQL Editor에서 실행한다.

태그 참고: Cron 라우트는 `benefit:{slug}`와 `segment:{seg}`도 재검증하지만, `unstable_cache`는 함수 단위 태그라 개별 slug 태그를 붙일 수 없다. 대신 상세·목록은 `benefits:all` 태그를 쓰고, Cron 라우트가 변경이 있을 때 `benefits:all`도 재검증하도록 Task 12에서 한 줄 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/benefits/__tests__/queries.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/benefits/queries.ts src/lib/benefits/__tests__/queries.test.ts supabase/migrations/002_sync_runs_public_read.sql
git commit -m "feat: 서버 조회 함수 (태그 캐시) + sync_runs 공개 읽기 정책"
```

---

### Task 5: 레이아웃 셸, 광고 슬롯, 필수 페이지

**Files:**
- Create: `src/app/(site)/layout.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `src/components/ads/AdSlot.tsx`, `src/app/(site)/about/page.tsx`, `src/app/(site)/privacy/page.tsx`, `src/app/(site)/terms/page.tsx`, `src/app/(site)/contact/page.tsx`, `src/app/ads.txt/route.ts`
- Modify: `src/app/layout.tsx`, `.env.local.example`
- Move: `src/app/page.tsx` → `src/app/(site)/page.tsx` (Task 7에서 내용 교체. `(site)/layout.tsx`가 이미 `<main>`으로 감싸므로 페이지에서 `<main>`을 또 쓰지 않는다)

- [ ] **Step 1: AdSlot 복사**

```bash
mkdir -p src/components/ads src/components/layout "src/app/(site)"
cp ../real_estate/src/components/ads/AdSlot.tsx src/components/ads/AdSlot.tsx
git mv src/app/page.tsx "src/app/(site)/page.tsx"
```
`AdSlot.tsx`는 수정 없이 사용한다(개발 모드에서는 점선 자리표시자, adfit/adsense 스크립트 로더 포함).

- [ ] **Step 2: 루트 레이아웃 갱신**

`src/app/layout.tsx` 전체 교체:
```tsx
import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { siteName, siteUrl, SITE_DESCRIPTION } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: { default: `${siteName()} — 나에게 맞는 정부 지원금 찾기`, template: `%s | ${siteName()}` },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(siteUrl()),
  openGraph: { type: 'website', locale: 'ko_KR', siteName: siteName() },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  const adsense = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {adsense && (
          <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`} crossOrigin="anonymous" strategy="afterInteractive" />
        )}
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  )
}
```

`.env.local.example`에 추가:
```bash
# 광고·분석 (승인 후 설정)
NEXT_PUBLIC_ADSENSE_CLIENT=
NEXT_PUBLIC_ADFIT_UNIT_MOBILE=
NEXT_PUBLIC_ADFIT_UNIT_PC=
NEXT_PUBLIC_GA_ID=
# 문의 이메일 (contact 페이지·footer)
NEXT_PUBLIC_CONTACT_EMAIL=
```

- [ ] **Step 3: 사이트 레이아웃·헤더·푸터**

`src/app/(site)/layout.tsx`:
```tsx
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
    </>
  )
}
```

`src/components/layout/Header.tsx`:
```tsx
import Link from 'next/link'
import { PUBLIC_SEGMENTS } from '../../../data/segments'
import { siteName } from '@/lib/seo/site'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-indigo-700">
          {siteName()}
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium sm:gap-5">
          {PUBLIC_SEGMENTS.map((s) => (
            <Link key={s.slug} href={`/${s.path}`} className="text-gray-700 hover:text-indigo-700">
              {s.name}
            </Link>
          ))}
          <Link href="/deadline" className="hidden text-gray-700 hover:text-indigo-700 sm:inline">
            마감 임박
          </Link>
          <Link href="/my" className="rounded-full bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700">
            내 진단
          </Link>
        </nav>
      </div>
    </header>
  )
}
```

`src/components/layout/Footer.tsx`:
```tsx
import Link from 'next/link'
import { siteName } from '@/lib/seo/site'

export default function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL
  return (
    <footer className="mt-16 border-t bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-500">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about" className="hover:text-gray-800">서비스 소개</Link>
          <Link href="/contact" className="hover:text-gray-800">문의하기</Link>
          <Link href="/privacy" className="hover:text-gray-800">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-gray-800">이용약관</Link>
        </div>
        <p>{siteName()}{email ? ` | 문의: ${email}` : ''}</p>
        <p className="mt-1">
          본 사이트는 행정안전부 보조금24 공공데이터를 가공해 제공합니다. 신청 자격과 기한은 반드시 각 지원금의 공식 페이지(정부24)에서 최종 확인하세요.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: 필수 페이지 4개**

`src/app/(site)/about/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { siteName } from '@/lib/seo/site'

export const metadata: Metadata = { title: '서비스 소개', description: '정부·지자체 지원금을 조건별로 찾아주는 서비스 소개' }

export default function AboutPage() {
  const name = siteName()
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>{name} 소개</h1>
      <p>
        {name}은 행정안전부 보조금24에 등록된 약 1만 건의 정부·지자체 지원금을 나이·상황·지역 조건으로 걸러
        "내가 받을 수 있는 것"을 한 화면에서 보여주는 서비스입니다. 어려운 공고문을 쉬운 말로 풀어 쓰고,
        신청 순서와 자주 묻는 질문을 함께 정리합니다.
      </p>
      <h2>데이터는 어디서 오나요</h2>
      <p>
        공공데이터포털의 「행정안전부_대한민국 공공서비스(혜택) 정보」 API를 매일 2회 동기화합니다.
        각 지원금 페이지 하단에 최종 확인 시각과 원문 링크를 표기합니다. 해설 콘텐츠는 원문을 근거로 초안을 만들고 사람이 검수한 뒤 게재합니다.
      </p>
      <h2>주의사항</h2>
      <p>
        지원 자격·금액·기한은 기관 사정에 따라 바뀔 수 있습니다. 신청 전 반드시 공식 페이지에서 최종 확인하세요.
        {name}은 신청을 대행하지 않으며 개인정보를 요구하지 않습니다.
      </p>
      <h2>수익 모델</h2>
      <p>서비스는 광고(Google AdSense, Kakao AdFit)로 운영됩니다. 광고는 콘텐츠와 구분해 "광고"로 표시합니다.</p>
      <p><Link href="/contact">문의하기</Link></p>
    </article>
  )
}
```

`src/app/(site)/privacy/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { siteName } from '@/lib/seo/site'

export const metadata: Metadata = { title: '개인정보처리방침' }

export default function PrivacyPage() {
  const name = siteName()
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>개인정보처리방침</h1>
      <p>시행일: 2026-09-10</p>
      <h2>1. 수집하는 개인정보</h2>
      <p>
        {name}(이하 "서비스")은 회원가입을 받지 않으며 이름·연락처 등 개인정보를 직접 수집하지 않습니다.
        조건 진단에서 선택한 나이대·상황·지역은 이용자의 브라우저(localStorage)에만 저장되고 서버로 전송되지 않습니다.
      </p>
      <h2>2. 자동 수집 정보</h2>
      <ul>
        <li>서비스 이용 통계 분석을 위해 Google Analytics 4가 쿠키와 기기 정보를 수집할 수 있습니다.</li>
        <li>광고 제공을 위해 Google AdSense, Kakao AdFit이 쿠키 및 광고 식별자를 사용할 수 있습니다.</li>
      </ul>
      <h2>3. 쿠키 거부</h2>
      <p>브라우저 설정에서 쿠키를 차단할 수 있으며, 차단 시에도 서비스 이용에는 제한이 없습니다. Google 광고 설정(adssettings.google.com)에서 맞춤 광고를 해제할 수 있습니다.</p>
      <h2>4. 제3자 제공</h2>
      <p>서비스는 이용자 정보를 제3자에게 제공하지 않습니다. 광고·분석 사업자의 처리에 대해서는 각 사업자의 개인정보처리방침을 따릅니다.</p>
      <h2>5. 문의</h2>
      <p>개인정보 관련 문의는 <a href="/contact">문의하기</a> 페이지의 이메일로 보내 주세요.</p>
    </article>
  )
}
```

`src/app/(site)/terms/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { siteName } from '@/lib/seo/site'

export const metadata: Metadata = { title: '이용약관' }

export default function TermsPage() {
  const name = siteName()
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>이용약관</h1>
      <p>시행일: 2026-09-10</p>
      <h2>1. 목적</h2>
      <p>이 약관은 {name}(이하 "서비스")의 이용 조건을 정합니다.</p>
      <h2>2. 서비스 내용</h2>
      <p>서비스는 공공데이터를 가공한 지원금 정보와 해설을 무료로 제공합니다. 신청 대행, 자격 판정, 상담은 제공하지 않습니다.</p>
      <h2>3. 정보의 정확성</h2>
      <p>
        서비스는 정보를 정확하게 유지하기 위해 노력하지만, 공고 변경·해석 차이로 실제와 다를 수 있습니다.
        이용자는 신청 전 공식 페이지에서 확인해야 하며, 서비스는 정보 오류로 인한 손해에 책임지지 않습니다.
      </p>
      <h2>4. 광고</h2>
      <p>서비스에는 Google AdSense, Kakao AdFit 광고가 게재됩니다. 광고 내용은 광고주의 책임입니다.</p>
      <h2>5. 지적재산권</h2>
      <p>공공데이터 원문은 해당 기관의 공공누리 조건을 따르며, 서비스가 작성한 해설은 서비스에 권리가 있습니다. 출처를 밝히면 비상업적 인용은 허용합니다.</p>
      <h2>6. 약관 변경</h2>
      <p>약관은 사전 고지 후 변경될 수 있으며, 변경 후 이용은 동의로 봅니다.</p>
    </article>
  )
}
```

`src/app/(site)/contact/page.tsx`:
```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '문의하기' }

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '(이메일 미설정)'
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 prose prose-gray">
      <h1>문의하기</h1>
      <p>정보 오류 신고, 제휴, 광고 문의는 아래 이메일로 보내 주세요. 영업일 기준 3일 안에 답변합니다.</p>
      <p>
        이메일: <a href={`mailto:${email}`}>{email}</a>
      </p>
      <h2>정보 오류 신고 시</h2>
      <ul>
        <li>지원금 페이지 주소</li>
        <li>잘못된 내용과 올바른 내용</li>
        <li>근거 자료(공고문 링크 등)</li>
      </ul>
    </article>
  )
}
```

`src/app/ads.txt/route.ts` (정적 `public/ads.txt`를 두지 않는다):

Google은 도메인 루트의 ads.txt에 자기 퍼블리셔 ID가 없으면 광고 게재를 차단한다. 주석만 있는 파일도
같은 취급이라, 승인 전에 자리만 잡아두려고 `public/ads.txt`를 배포하면 승인 후 노출이 0이 된다.
따라서 라우트로 두고 `NEXT_PUBLIC_ADSENSE_CLIENT`가 없으면 404를 준다.

```ts
export const dynamic = 'force-static'

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim()
  if (!client) return new Response(null, { status: 404 })
  // AdSense가 주는 값은 'ca-pub-...' 형태지만 ads.txt 레코드에는 'pub-...'을 쓴다.
  const publisherId = client.replace(/^ca-/, '')
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
```

`prose` 클래스는 Tailwind typography 플러그인이 필요하다. 설치 없이 쓰려면 `globals.css`에 최소 스타일을 추가한다:
```css
/* prose 최소 대체 (typography 플러그인 미사용) */
.prose h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 1rem; }
.prose h2 { font-size: 1.25rem; font-weight: 700; margin: 2rem 0 0.75rem; }
.prose p, .prose li { line-height: 1.75; color: #374151; }
.prose ul { list-style: disc; padding-left: 1.25rem; }
.prose a { color: #4338ca; text-decoration: underline; }
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: `/about /privacy /terms /contact` 정적 라우트 생성, 오류 없음.

- [ ] **Step 6: Commit**

```bash
# 여러 에이전트가 같은 워크트리를 쓸 수 있으므로 git add -A 를 쓰지 않는다. 남의 미커밋 작업이
# 함께 스테이징된다(실제로 이 태스크에서 한 번 발생해 reset --soft 로 되돌렸다).
git add src/app src/components public .env.local.example
git diff --cached --stat   # 내가 만든 파일만 있는지 확인
git commit -m "feat: 사이트 레이아웃(헤더·푸터), AdSlot, 필수 페이지 4개, ads.txt"
```

---

### Task 6: 공통 지원금 컴포넌트 (카드·배지·목록)

**Files:**
- Create: `src/components/benefits/DdayBadge.tsx`, `src/components/benefits/BenefitCard.tsx`, `src/components/benefits/BenefitList.tsx`, `src/components/benefits/AdPlacement.tsx`
- Test: `src/components/benefits/__tests__/BenefitCard.test.tsx`

- [ ] **Step 1: 실패하는 테스트**

`src/components/benefits/__tests__/BenefitCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BenefitCard from '../BenefitCard'

const row = {
  slug: '서울-임산부-교통비', title: '서울시 임산부 교통비 지원', summary: '임산부 교통비 70만원',
  amount_text: '○ 교통 포인트 70만원\r\n - 카드 충전', deadline_type: 'period', apply_start: null, apply_end: '2026-09-22',
  region_code: 'seoul', segments: ['parenting' as const], agency: '서울특별시', synced_at: '2026-09-10T00:00:00Z',
}
const now = new Date('2026-09-10T03:00:00Z')

describe('BenefitCard', () => {
  it('제목 링크, D-day, 지역, 금액 첫 줄을 보여준다', () => {
    render(<BenefitCard row={row} now={now} />)
    expect(screen.getByRole('link', { name: /서울시 임산부 교통비 지원/ })).toHaveAttribute('href', '/benefit/서울-임산부-교통비')
    expect(screen.getByText('D-12')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    expect(screen.getByText('교통 포인트 70만원')).toBeInTheDocument()
  })
  it('상시는 상시 배지, 전국은 전국 표기', () => {
    render(<BenefitCard row={{ ...row, deadline_type: 'always', apply_end: null, region_code: 'ALL' }} now={now} />)
    expect(screen.getByText('상시')).toBeInTheDocument()
    expect(screen.getByText('전국')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/benefits`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/components/benefits/DdayBadge.tsx`:
```tsx
import { daysUntil } from '@/lib/benefits/status'
import { ddayLabel } from '@/lib/benefits/format'
import { cn } from '@/lib/utils'

export default function DdayBadge({ deadline_type, apply_end, now }: { deadline_type: string; apply_end: string | null; now?: Date }) {
  if (deadline_type === 'always') return <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">상시</span>
  const d = daysUntil(apply_end, now)
  const label = ddayLabel(d)
  if (!label) return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">공고 확인</span>
  const urgent = d !== null && d <= 14
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', urgent ? 'bg-red-50 text-red-700' : 'bg-indigo-50 text-indigo-700')}>{label}</span>
}
```

`src/components/benefits/BenefitCard.tsx`:
```tsx
import Link from 'next/link'
import type { BenefitListRow } from '@/lib/benefits/queries'
import { firstLine } from '@/lib/benefits/format'
import { REGIONS } from '../../../data/regions'
import DdayBadge from './DdayBadge'

const REGION_NAME: Record<string, string> = Object.fromEntries(REGIONS.map((r) => [r.slug, r.name]))

export function regionName(code: string): string {
  return code === 'ALL' ? '전국' : (REGION_NAME[code] ?? code)
}

export default function BenefitCard({ row, now }: { row: BenefitListRow; now?: Date }) {
  const amount = firstLine(row.amount_text, 80)
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <DdayBadge deadline_type={row.deadline_type} apply_end={row.apply_end} now={now} />
        <span className="text-xs text-gray-500">{regionName(row.region_code)}</span>
        {row.agency && <span className="text-xs text-gray-400">· {row.agency}</span>}
      </div>
      <h3 className="text-base font-semibold leading-snug">
        <Link href={`/benefit/${row.slug}`} className="hover:text-indigo-700">
          {row.title}
        </Link>
      </h3>
      {amount && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{amount}</p>}
    </article>
  )
}
```

`src/components/benefits/AdPlacement.tsx`:
```tsx
import type { ReactNode } from 'react'
import AdSlot from '@/components/ads/AdSlot'

export type AdPlacementSlot = 'home' | 'list' | 'detail-1' | 'detail-2' | 'rail'

// NEXT_PUBLIC_* 는 정적으로 분석 가능한 참조만 빌드 시 치환된다. process.env[`...${slot}...`] 같은
// 동적 인덱싱은 클라이언트 번들에서 조용히 undefined가 되므로 슬롯별로 나열한다.
const ADSENSE_SLOT: Record<AdPlacementSlot, string | undefined> = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
  list: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST,
  'detail-1': process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL_1,
  'detail-2': process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL_2,
  rail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL,
}

function AdFrame({ isRail, children }: { isRail: boolean; children: ReactNode }) {
  // aria-label은 role 없는 div에서는 무시된다. aside는 complementary 역할을 가져 라벨이 실제로 노출된다.
  return (
    <aside className="my-6" style={{ minHeight: isRail ? 600 : 100 }} aria-label="광고">
      <p className="mb-1 text-[10px] text-gray-400">광고</p>
      {children}
    </aside>
  )
}

/** 광고 위치별 단일 진입점. 승인 전에는 애드핏, 승인 후 env로 애드센스 전환. 높이를 예약해 CLS를 막는다. */
export default function AdPlacement({ slot }: { slot: AdPlacementSlot }) {
  const isRail = slot === 'rail'
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  const adsenseSlot = ADSENSE_SLOT[slot]

  // 클라이언트와 슬롯 ID가 모두 있어야 애드센스를 태운다. 하나만 있으면 AdSlot이 아무것도 렌더하지
  // 않는데 높이는 예약돼 빈 박스가 남아 CLS를 해친다. 그래서 애드핏으로 폴백하고, 그것도 없으면 null.
  if (adsenseClient && adsenseSlot) {
    return (
      <AdFrame isRail={isRail}>
        <AdSlot type="adsense" adClient={adsenseClient} adSlot={adsenseSlot} adFormat={isRail ? 'vertical' : 'auto'} />
      </AdFrame>
    )
  }

  const unit = isRail ? process.env.NEXT_PUBLIC_ADFIT_UNIT_PC : process.env.NEXT_PUBLIC_ADFIT_UNIT_MOBILE
  if (!unit) return null
  return (
    <AdFrame isRail={isRail}>
      <AdSlot type="adfit" adUnit={unit} adWidth={isRail ? 300 : 320} adHeight={isRail ? 600 : 100} />
    </AdFrame>
  )
}
```
`.env.local.example`에 `NEXT_PUBLIC_ADSENSE_SLOT_HOME=`, `..._LIST=`, `..._DETAIL_1=`, `..._DETAIL_2=`, `..._RAIL=` 5줄을 추가한다.

`src/components/benefits/BenefitList.tsx`:
```tsx
import { Fragment } from 'react'
import type { BenefitListRow } from '@/lib/benefits/queries'
import BenefitCard from './BenefitCard'
import AdPlacement from './AdPlacement'

/** 카드 목록. 5번째 항목 뒤에 광고 1개(스펙 7). */
export default function BenefitList({ rows, now, emptyText = '조건에 맞는 지원금이 없습니다.' }: { rows: BenefitListRow[]; now?: Date; emptyText?: string }) {
  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">{emptyText}</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <Fragment key={r.slug}>
          <BenefitCard row={r} now={now} />
          {i === 4 && (
            <div className="sm:col-span-2">
              <AdPlacement slot="list" />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/benefits`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/benefits .env.local.example
git commit -m "feat(ui): 지원금 카드·D-day 배지·목록·광고 배치"
```

---

### Task 7: 홈 — 조건 진단 패널 + 마감 임박·신규·세그먼트 블록

**Files:**
- Create: `src/components/diagnosis/DiagnosisPanel.tsx`
- Modify: `src/app/(site)/page.tsx`
- Test: `src/components/diagnosis/__tests__/DiagnosisPanel.test.tsx`

- [ ] **Step 1: 실패하는 테스트**

`src/components/diagnosis/__tests__/DiagnosisPanel.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DiagnosisPanel from '../DiagnosisPanel'

describe('DiagnosisPanel', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 27, items: [] })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('칩을 고르면 개수를 조회하고 localStorage에 저장한다', async () => {
    render(<DiagnosisPanel />)
    fireEvent.click(screen.getByRole('button', { name: '30대' }))
    fireEvent.click(screen.getByRole('button', { name: '임신·출산' }))
    fireEvent.click(screen.getByRole('button', { name: '서울' }))
    await waitFor(() => expect(screen.getByRole('link', { name: /내 지원금 27개 보기/ })).toBeInTheDocument())
    const url = new URL(fetchMock.mock.calls.at(-1)![0] as string, 'http://localhost')
    expect(url.pathname).toBe('/api/benefits/search')
    expect(url.searchParams.get('count')).toBe('1')
    expect(url.searchParams.get('age')).toBe('30s')
    expect(JSON.parse(localStorage.getItem('diagnosis')!)).toEqual({ ageBand: '30s', situations: ['pregnancy'], region: 'seoul' })
    expect(screen.getByRole('link', { name: /내 지원금 27개 보기/ })).toHaveAttribute('href', '/my')
  })

  it('저장된 진단이 있으면 이어서 보기 상태로 시작한다', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: ['job_seeker'], region: null }))
    render(<DiagnosisPanel />)
    expect(screen.getByRole('button', { name: '20대' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByText(/이어서 보기/)).toBeInTheDocument())
  })

  it('아무것도 고르지 않으면 안내 문구', () => {
    render(<DiagnosisPanel />)
    expect(screen.getByText(/조건을 골라 주세요/)).toBeInTheDocument()
  })

  it('같은 칩을 다시 누르면 해제된다', () => {
    render(<DiagnosisPanel />)
    const b = screen.getByRole('button', { name: '1인 가구' })
    fireEvent.click(b)
    expect(b).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(b)
    expect(b).toHaveAttribute('aria-pressed', 'false')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/diagnosis`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/components/diagnosis/DiagnosisPanel.tsx`:
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AGE_OPTIONS, SITUATION_OPTIONS, REGION_OPTIONS } from '@/lib/diagnosis/options'
import { readDiagnosis, writeDiagnosis, toSearchParams, isEmpty, EMPTY, type Diagnosis } from '@/lib/diagnosis/storage'
import { cn } from '@/lib/utils'

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-3.5 text-sm transition',
        on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400',
      )}
    >
      {children}
    </button>
  )
}

export default function DiagnosisPanel() {
  const [d, setD] = useState<Diagnosis>(EMPTY)
  const [total, setTotal] = useState<number | null>(null)
  const [restored, setRestored] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // 첫 렌더 후 localStorage 복원. 서버에서는 readDiagnosis()가 항상 빈 값을 주므로
  // 렌더 중에 읽으면 hydration 불일치가 난다. 반드시 useEffect에서 읽는다.
  useEffect(() => {
    const saved = readDiagnosis()
    if (!isEmpty(saved)) {
      setD(saved)
      setRestored(true)
    }
  }, [])

  // 조건이 바뀌면 저장하고 개수 조회
  useEffect(() => {
    if (isEmpty(d)) {
      setTotal(null)
      return
    }
    writeDiagnosis(d)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const sp = toSearchParams(d)
    sp.set('count', '1')
    fetch(`/api/benefits/search?${sp.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTotal(j.total))
      .catch(() => {})
    return () => ac.abort()
  }, [d])

  const toggleSituation = (v: string) => {
    setRestored(false)
    setD((p) => ({ ...p, situations: p.situations.includes(v) ? p.situations.filter((s) => s !== v) : [...p.situations, v] }))
  }
  const pick = <K extends 'ageBand' | 'region'>(k: K, v: Diagnosis[K]) => {
    setRestored(false)
    setD((p) => ({ ...p, [k]: p[k] === v ? null : v }))
  }

  return (
    <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 p-5 text-white shadow-md sm:p-7">
      <h1 className="text-2xl font-extrabold sm:text-3xl">내가 받을 수 있는 지원금은?</h1>
      <p className="mt-1 text-sm text-indigo-100">3가지만 고르면 바로 보여드립니다. 회원가입 없음, 정보는 내 브라우저에만 저장됩니다.</p>

      <div className="mt-5 space-y-4 rounded-xl bg-white p-4 text-gray-900">
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">나이</p>
          <div className="flex flex-wrap gap-2">
            {AGE_OPTIONS.map((o) => (
              <Chip key={o.value} on={d.ageBand === o.value} onClick={() => pick('ageBand', o.value)}>{o.label}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">상황 (여러 개 가능)</p>
          <div className="flex flex-wrap gap-2">
            {SITUATION_OPTIONS.map((o) => (
              <Chip key={o.value} on={d.situations.includes(o.value)} onClick={() => toggleSituation(o.value)}>{o.label}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">지역</p>
          <div className="flex flex-wrap gap-2">
            {REGION_OPTIONS.map((o) => (
              <Chip key={o.value} on={d.region === o.value} onClick={() => pick('region', o.value)}>{o.label}</Chip>
            ))}
          </div>
        </div>

        {isEmpty(d) ? (
          <p className="text-center text-sm text-gray-500">조건을 골라 주세요. 하나만 골라도 됩니다.</p>
        ) : (
          <Link
            href="/my"
            className="block rounded-xl bg-indigo-600 py-3.5 text-center text-base font-bold text-white hover:bg-indigo-700"
          >
            {restored ? '이어서 보기: ' : ''}
            {total === null ? '내 지원금 찾는 중…' : `내 지원금 ${total.toLocaleString()}개 보기 →`}
          </Link>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: 홈 페이지**

`src/app/(site)/page.tsx` 전체 교체:
```tsx
import Link from 'next/link'
import DiagnosisPanel from '@/components/diagnosis/DiagnosisPanel'
import BenefitCard from '@/components/benefits/BenefitCard'
import AdPlacement from '@/components/benefits/AdPlacement'
import { listDeadlineSoon, listRecentlyUpdated, getLastSyncAt } from '@/lib/benefits/queries'
import { formatKstDate } from '@/lib/benefits/format'
import { PUBLIC_SEGMENTS } from '../../../data/segments'

export const revalidate = 3600

export default async function HomePage() {
  const [soon, recent, lastSync] = await Promise.all([listDeadlineSoon(14, 8), listRecentlyUpdated(48, 8), getLastSyncAt()])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <DiagnosisPanel />

      <AdPlacement slot="home" />

      {/* 2주 이내 마감이 0건인 시기가 실제로 생긴다(기간형 공고 614건). 제목만 남은 빈 섹션을 만들지 않는다. */}
      {soon.length > 0 && (
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">마감 임박 (2주 이내)</h2>
          <Link href="/deadline" className="text-sm text-indigo-700 hover:underline">전체 보기</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {soon.map((r) => <BenefitCard key={r.slug} row={r} now={now} />)}
        </div>
      </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold">분야별로 보기</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PUBLIC_SEGMENTS.map((s) => (
            <Link key={s.slug} href={`/${s.path}`} className="rounded-xl border bg-white p-5 hover:border-indigo-300 hover:shadow-sm">
              <h3 className="text-lg font-bold">{s.name} 지원금</h3>
              <p className="mt-1 text-sm text-gray-600">{s.description_md}</p>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">최근 갱신된 지원금</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((r) => <BenefitCard key={r.slug} row={r} now={now} />)}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-gray-400">
        데이터 출처: 행정안전부 보조금24 · 최종 동기화 {lastSync ? formatKstDate(lastSync) : '확인 중'}
      </p>
    </div>
  )
}
```

- [ ] **Step 5: 통과 확인 + 화면 확인**

Run: `npx vitest run src/components/diagnosis` → 4 passed
Run: `npm run dev -- -p 3111` 후 http://localhost:3111 열기. 칩을 눌러 개수가 바뀌고, 새로 고침 후 "이어서 보기"가 나오는지 확인. 폭 400px로 줄여 칩이 줄바꿈되고 가로 스크롤이 없는지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/components/diagnosis "src/app/(site)/page.tsx"
git commit -m "feat(home): 조건 진단 패널과 마감 임박·분야·최근 갱신 블록"
```

---

### Task 8: /my 진단 결과 (CSR, noindex)

**Files:**
- Create: `src/components/diagnosis/DiagnosisResults.tsx`, `src/app/(site)/my/page.tsx`
- Test: `src/components/diagnosis/__tests__/DiagnosisResults.test.tsx`

- [ ] **Step 1: 실패하는 테스트**

`src/components/diagnosis/__tests__/DiagnosisResults.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DiagnosisResults from '../DiagnosisResults'

const item = (slug: string, extra = {}) => ({
  slug, title: `제목 ${slug}`, summary: null, amount_text: '10만원', deadline_type: 'always', apply_end: null,
  region_code: 'ALL', segments: ['youth'], hasConditions: true, dday: null, ...extra,
})

describe('DiagnosisResults', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('진단이 없으면 홈으로 안내', () => {
    render(<DiagnosisResults />)
    expect(screen.getByRole('link', { name: /조건 고르러 가기/ })).toHaveAttribute('href', '/')
  })

  it('저장된 진단으로 검색해 목록과 총 개수를 보여주고, 조건 확인 필요 그룹을 구분한다', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: ['job_seeker'], region: 'seoul' }))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ total: 2, items: [item('a'), item('b', { hasConditions: false })] })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(screen.getByText(/총 2개/)).toBeInTheDocument())
    expect(screen.getByText('제목 a')).toBeInTheDocument()
    expect(screen.getByText(/조건 확인 필요/)).toBeInTheDocument()
    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost')
    expect(url.searchParams.get('age')).toBe('20s')
    expect(url.searchParams.get('limit')).toBe('50')
  })

  it('더 보기를 누르면 offset을 늘려 추가 조회', async () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: [], region: null }))
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ total: 60, items: Array.from({ length: 50 }, (_, i) => item(`a${i}`)) })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total: 60, items: Array.from({ length: 10 }, (_, i) => item(`b${i}`)) })))
    render(<DiagnosisResults />)
    await waitFor(() => expect(screen.getByRole('button', { name: /더 보기/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }))
    await waitFor(() => expect(screen.getByText('제목 b9')).toBeInTheDocument())
    expect(new URL(fetchMock.mock.calls[1][0] as string, 'http://localhost').searchParams.get('offset')).toBe('50')
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/components/diagnosis/__tests__/DiagnosisResults.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/components/diagnosis/DiagnosisResults.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SearchResultItem } from '@/lib/benefits/search'
import { readDiagnosis, toSearchParams, isEmpty, type Diagnosis } from '@/lib/diagnosis/storage'
import { AGE_OPTIONS, SITUATION_OPTIONS, REGION_OPTIONS } from '@/lib/diagnosis/options'
import BenefitCard from '@/components/benefits/BenefitCard'
import AdPlacement from '@/components/benefits/AdPlacement'

const PAGE = 50

function label(d: Diagnosis): string {
  const parts = [
    AGE_OPTIONS.find((o) => o.value === d.ageBand)?.label,
    ...d.situations.map((s) => SITUATION_OPTIONS.find((o) => o.value === s)?.label),
    REGION_OPTIONS.find((o) => o.value === d.region)?.label,
  ].filter(Boolean)
  return parts.join(' · ')
}

function toRow(i: SearchResultItem) {
  return { ...i, apply_start: null, agency: null, synced_at: '', segments: i.segments as ('youth' | 'parenting' | 'small_biz' | 'other')[] }
}

export default function DiagnosisResults() {
  const [d, setD] = useState<Diagnosis | null>(null)
  const [items, setItems] = useState<SearchResultItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setD(readDiagnosis())
  }, [])

  const load = async (diag: Diagnosis, offset: number) => {
    setLoading(true)
    setError(false)
    try {
      const sp = toSearchParams(diag)
      sp.set('limit', String(PAGE))
      sp.set('offset', String(offset))
      const r = await fetch(`/api/benefits/search?${sp.toString()}`)
      if (!r.ok) throw new Error(String(r.status))
      const j = (await r.json()) as { total: number; items: SearchResultItem[] }
      setTotal(j.total)
      setItems((prev) => (offset === 0 ? j.items : [...prev, ...j.items]))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (d && !isEmpty(d)) void load(d, 0)
  }, [d])

  if (d === null) return <p className="py-10 text-center text-sm text-gray-500">불러오는 중…</p>
  if (isEmpty(d)) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">아직 고른 조건이 없습니다.</p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white">조건 고르러 가기</Link>
      </div>
    )
  }

  const matched = items.filter((i) => i.hasConditions)
  const unsure = items.filter((i) => !i.hasConditions)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{label(d)}</span> 조건 · 총 {total.toLocaleString()}개
        </p>
        <Link href="/" className="text-sm text-indigo-700 hover:underline">조건 바꾸기</Link>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {matched.map((i, idx) => (
          <div key={i.slug} className="contents">
            <BenefitCard row={toRow(i)} />
            {idx === 4 && <div className="sm:col-span-2"><AdPlacement slot="list" /></div>}
          </div>
        ))}
      </div>

      {unsure.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-bold text-gray-700">조건 확인 필요 <span className="text-sm font-normal text-gray-500">— 대상 조건이 등록되지 않아 직접 확인이 필요한 지원금</span></h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {unsure.map((i) => <BenefitCard key={i.slug} row={toRow(i)} />)}
          </div>
        </section>
      )}

      {items.length < total && (
        <div className="mt-6 text-center">
          <button type="button" disabled={loading} onClick={() => load(d, items.length)} className="rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
            {loading ? '불러오는 중…' : `더 보기 (${items.length}/${total})`}
          </button>
        </div>
      )}
    </div>
  )
}
```

`src/app/(site)/my/page.tsx`:
```tsx
import type { Metadata } from 'next'
import DiagnosisResults from '@/components/diagnosis/DiagnosisResults'

export const metadata: Metadata = {
  title: '내 진단 결과',
  robots: { index: false, follow: true },
}

export default function MyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="mb-4 text-2xl font-extrabold">내 지원금</h1>
      <DiagnosisResults />
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/components/diagnosis`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/diagnosis "src/app/(site)/my"
git commit -m "feat(my): 진단 결과 페이지 (CSR, noindex, 더 보기, 조건 확인 필요 그룹)"
```

---

### Task 9: 세그먼트 허브 + 세그먼트×지역

> **착수 전 확인 (Plan 2 실행 중 발견):** 실데이터의 소관기관명이 `전남광주통합특별시`로 들어와
> `extractRegion`이 광주를 전부 `jeonnam`으로 분류한다(전남 1,053건, 광주 1건). 지역 칩과 사이트맵이
> 1건짜리 광주 페이지를 만들지 않도록, 건수가 0 또는 1인 지역은 칩·링크·사이트맵에서 제외한다.
> 지역 taxonomy 자체를 바꾸는 결정(광주 슬러그 폐지 또는 리다이렉트)은 스펙 12장에 기록되어 있고
> 사용자 확인이 필요하다. 또한 `benefits.region_code`는 코드가 아니라 slug를 담는다는 점에 주의한다.


**Files:**
- Create: `src/app/(site)/[segment]/page.tsx`, `src/app/(site)/[segment]/[region]/page.tsx`, `src/components/JsonLd.tsx`
- Test: `src/lib/seo/__tests__/hub-meta.test.ts`, `src/lib/seo/hub-meta.ts`

메타 문자열 생성은 순수 함수 `hub-meta.ts`로 분리해 테스트한다.

- [ ] **Step 1: 실패하는 테스트**

`src/lib/seo/__tests__/hub-meta.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hubTitle, hubDescription, regionHubTitle, regionHubDescription } from '../hub-meta'

describe('hub meta', () => {
  it('세그먼트 허브 title/description', () => {
    expect(hubTitle('청년', 2026)).toBe('2026 청년 지원금 총정리 · 조건별 조회')
    expect(hubDescription('청년', 956)).toBe('청년 지원금 956개를 나이·지역 조건으로 걸러 확인하세요. 마감 임박 순 정렬, 신청 방법과 자격을 쉬운 말로 정리했습니다.')
  })
  it('세그먼트×지역', () => {
    expect(regionHubTitle('서울', '청년', 2026)).toBe('2026 서울 청년 지원금 · 조건별 조회')
    expect(regionHubDescription('서울', '청년', 41)).toBe('서울에서 받을 수 있는 청년 지원금 41개(전국 공통 포함). 마감 임박 순으로 정리했습니다.')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/seo/__tests__/hub-meta.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/seo/hub-meta.ts`:
```ts
export function hubTitle(segmentName: string, year: number): string {
  return `${year} ${segmentName} 지원금 총정리 · 조건별 조회`
}
export function hubDescription(segmentName: string, count: number): string {
  return `${segmentName} 지원금 ${count.toLocaleString()}개를 나이·지역 조건으로 걸러 확인하세요. 마감 임박 순 정렬, 신청 방법과 자격을 쉬운 말로 정리했습니다.`
}
export function regionHubTitle(regionName: string, segmentName: string, year: number): string {
  return `${year} ${regionName} ${segmentName} 지원금 · 조건별 조회`
}
export function regionHubDescription(regionName: string, segmentName: string, count: number): string {
  return `${regionName}에서 받을 수 있는 ${segmentName} 지원금 ${count.toLocaleString()}개(전국 공통 포함). 마감 임박 순으로 정리했습니다.`
}
export function kstYear(now: Date = new Date()): number {
  return new Date(now.getTime() + 9 * 3_600_000).getUTCFullYear()
}
```

`src/components/JsonLd.tsx`:
```tsx
import { jsonLdString } from '@/lib/seo/jsonld'

export default function JsonLd({ data }: { data: unknown | unknown[] }) {
  const list = Array.isArray(data) ? data.filter(Boolean) : [data]
  return (
    <>
      {list.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(d) }} />
      ))}
    </>
  )
}
```

`src/app/(site)/[segment]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEGMENT_BY_PATH, PUBLIC_SEGMENTS } from '../../../../data/segments'
import { REGIONS } from '../../../../data/regions'
import { listBySegment, countByRegion } from '@/lib/benefits/queries'
import { hubTitle, hubDescription, kstYear } from '@/lib/seo/hub-meta'
import { breadcrumbs, itemList } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitList from '@/components/benefits/BenefitList'
import JsonLd from '@/components/JsonLd'

export const revalidate = 3600

export function generateStaticParams() {
  return PUBLIC_SEGMENTS.map((s) => ({ segment: s.path }))
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }): Promise<Metadata> {
  const { segment } = await params
  const seg = SEGMENT_BY_PATH[segment]
  if (!seg || seg.slug === 'other') return {}
  const counts = await countByRegion(seg.slug)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return {
    title: hubTitle(seg.name, kstYear()),
    description: hubDescription(seg.name, total),
    alternates: { canonical: absoluteUrl(`/${seg.path}`) },
  }
}

export default async function SegmentHubPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params
  const seg = SEGMENT_BY_PATH[segment]
  if (!seg || seg.slug === 'other') notFound()

  const now = new Date()
  const [rows, counts] = await Promise.all([listBySegment(seg.slug, { limit: 40 }), countByRegion(seg.slug)])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={[breadcrumbs([{ name: '홈', path: '/' }, { name: seg.name, path: `/${seg.path}` }]), itemList(rows.slice(0, 20).map((r) => ({ name: r.title, path: `/benefit/${r.slug}` })))]} />
      <nav className="text-xs text-gray-500">홈 › {seg.name}</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{seg.name} 지원금 {total.toLocaleString()}개</h1>
      <p className="mt-2 max-w-2xl text-gray-600">{seg.description_md}</p>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">지역별로 보기</h2>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <Link key={r.slug} href={`/${seg.path}/${r.slug}`} className="rounded-full border bg-white px-3 py-1.5 text-sm hover:border-indigo-400">
              {r.name} <span className="text-gray-400">{((counts[r.slug] ?? 0) + (counts.ALL ?? 0)).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">마감 임박 순</h2>
        <BenefitList rows={rows} now={now} />
      </section>
    </div>
  )
}
```

`src/app/(site)/[segment]/[region]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SEGMENT_BY_PATH, PUBLIC_SEGMENTS } from '../../../../../data/segments'
import { REGIONS } from '../../../../../data/regions'
import { listBySegment, getRegionMeta } from '@/lib/benefits/queries'
import { regionHubTitle, regionHubDescription, kstYear } from '@/lib/seo/hub-meta'
import { regionHubIndexable } from '@/lib/seo/index-policy'
import { breadcrumbs, itemList } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitList from '@/components/benefits/BenefitList'
import JsonLd from '@/components/JsonLd'

export const revalidate = 21600

export function generateStaticParams() {
  return PUBLIC_SEGMENTS.flatMap((s) => REGIONS.map((r) => ({ segment: s.path, region: r.slug })))
}

async function load(segmentPath: string, regionSlug: string) {
  const seg = SEGMENT_BY_PATH[segmentPath]
  const reg = REGIONS.find((r) => r.slug === regionSlug)
  if (!seg || seg.slug === 'other' || !reg) return null
  const [rows, meta] = await Promise.all([listBySegment(seg.slug, { region: reg.slug, limit: 60 }), getRegionMeta(reg.slug)])
  return { seg, reg, rows, meta }
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string; region: string }> }): Promise<Metadata> {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) return {}
  const { seg, reg, rows, meta } = data
  const indexable = regionHubIndexable({ count: rows.length, description_md: meta?.description_md ?? null })
  return {
    title: regionHubTitle(reg.name, seg.name, kstYear()),
    description: regionHubDescription(reg.name, seg.name, rows.length),
    alternates: { canonical: absoluteUrl(`/${seg.path}/${reg.slug}`) },
    robots: { index: indexable, follow: true },
  }
}

export default async function RegionHubPage({ params }: { params: Promise<{ segment: string; region: string }> }) {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) notFound()
  const { seg, reg, rows, meta } = data
  const now = new Date()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={[breadcrumbs([{ name: '홈', path: '/' }, { name: seg.name, path: `/${seg.path}` }, { name: reg.name, path: `/${seg.path}/${reg.slug}` }]), itemList(rows.slice(0, 20).map((r) => ({ name: r.title, path: `/benefit/${r.slug}` })))]} />
      <nav className="text-xs text-gray-500">홈 › {seg.name} › {reg.name}</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{reg.name} {seg.name} 지원금 {rows.length.toLocaleString()}개</h1>
      {meta?.description_md ? (
        <p className="mt-2 max-w-2xl whitespace-pre-line text-gray-600">{meta.description_md}</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{reg.name} 지자체 지원금과 전국 공통 지원금을 함께 보여줍니다.</p>
      )}
      <section className="mt-6">
        <BenefitList rows={rows} now={now} emptyText={`${reg.name}의 ${seg.name} 지원금이 아직 없습니다. 전국 공통 지원금은 ${seg.name} 페이지에서 확인하세요.`} />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: 테스트·빌드·화면 확인**

Run: `npx vitest run src/lib/seo` → PASS
Run: `npm run build` → `/[segment]` 3개, `/[segment]/[region]` 51개 정적 생성.
`http://localhost:3111/youth`, `/small-biz/seoul` 열어 목록·지역 칩·JSON-LD(`view-source`에서 `application/ld+json` 2개) 확인. `/other`는 404.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(site)/[segment]" src/components/JsonLd.tsx src/lib/seo
git commit -m "feat(hub): 세그먼트 허브와 세그먼트×지역 페이지 (메타·JSON-LD·색인 정책)"
```

---

### Task 10: 지원금 상세 페이지 (A안)

**Files:**
- Create: `src/lib/benefits/checklist.ts`, `src/components/benefits/Checklist.tsx`, `src/components/benefits/SummaryGrid.tsx`, `src/components/benefits/StickyRail.tsx`, `src/components/benefits/SourceFooter.tsx`, `src/components/benefits/Markdown.tsx`, `src/app/(site)/benefit/[slug]/page.tsx`
- Test: `src/lib/benefits/__tests__/checklist.test.ts`, `src/components/benefits/__tests__/Checklist.test.tsx`

- [ ] **Step 1: 실패하는 테스트 (순수 함수)**

`src/lib/benefits/__tests__/checklist.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildChecklist, evaluateChecklist } from '../checklist'

const cond = { age_min: 19, age_max: 34, gender: 'any', income_bands: [], life_stages: [], household_types: ['no_house'], occupations: ['job_seeker'], region_codes: ['seoul'] }

describe('buildChecklist', () => {
  it('조건 행에서 체크 항목을 만든다 (나이·지역·가구·직업)', () => {
    const items = buildChecklist(cond, null)
    expect(items.map((i) => i.key)).toEqual(['age', 'region', 'household:no_house', 'occupation:job_seeker'])
    expect(items[0].label).toBe('만 19~34세')
    expect(items[1].label).toBe('서울 거주')
    expect(items[2].label).toBe('무주택 세대')
    expect(items[3].label).toBe('구직자·실업자')
  })
  it('검수된 체크리스트가 있으면 그것을 우선한다', () => {
    const items = buildChecklist(cond, [{ label: '서울 6개월 이상 거주', condition_key: 'region' }])
    expect(items).toEqual([{ key: 'region', label: '서울 6개월 이상 거주' }])
  })
  it('조건이 없으면 빈 배열', () => {
    expect(buildChecklist(null, null)).toEqual([])
  })
})

describe('evaluateChecklist', () => {
  const items = buildChecklist(cond, null)
  it('진단값으로 항목을 채운다: 확인/불일치/미확인', () => {
    const r = evaluateChecklist(items, cond, { ageBand: '20s', situations: ['job_seeker'], region: 'busan' })
    expect(r.map((x) => x.state)).toEqual(['pass', 'fail', 'unknown', 'pass'])
  })
  it('나이대 범위가 조건과 일부 겹치면 pass', () => {
    const r = evaluateChecklist(items, cond, { ageBand: '30s', situations: [], region: null })
    expect(r[0].state).toBe('pass') // 30~39 ∩ 19~34
    expect(r[1].state).toBe('unknown')
  })
  it('진단이 없으면 모두 unknown', () => {
    expect(evaluateChecklist(items, cond, { ageBand: null, situations: [], region: null }).every((x) => x.state === 'unknown')).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/benefits/__tests__/checklist.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 순수 함수 구현**

`src/lib/benefits/checklist.ts`:
```ts
import type { ConditionJoin } from './queries'
import type { Diagnosis } from '@/lib/diagnosis/storage'
import { ageBandToRange } from './search'
import { SITUATION_TO_CONDITIONS } from '@/lib/conditions/codemap'
import { REGIONS } from '../../../data/regions'

export interface CheckItem {
  key: string // 'age' | 'region' | 'gender' | 'household:x' | 'occupation:x' | 'life:x' | 'income:x' | 검수자가 정한 키
  label: string
}
export type CheckState = 'pass' | 'fail' | 'unknown'
export interface EvaluatedItem extends CheckItem {
  state: CheckState
}

const REGION_NAME: Record<string, string> = Object.fromEntries(REGIONS.map((r) => [r.slug, r.name]))

const HOUSEHOLD_LABEL: Record<string, string> = {
  multicultural: '다문화가족', defector: '북한이탈주민', single_parent: '한부모·조손 가정', single: '1인 가구',
  multi_child: '다자녀 가구', no_house: '무주택 세대', new_resident: '신규 전입', extended: '확대가족', disabled: '장애인', veteran: '국가보훈대상자',
}
const OCCUPATION_LABEL: Record<string, string> = {
  farmer: '농업인', fisher: '어업인', livestock: '축산업인', forester: '임업인', college: '대학(원)생',
  worker: '근로자·직장인', job_seeker: '구직자·실업자', small_biz: '소상공인·중소기업',
}
const LIFE_LABEL: Record<string, string> = {
  pre_parent: '예비부모·난임', pregnancy: '임산부', birth: '출산·입양 가정', elementary: '초등학생', middle_school: '중학생', high_school: '고등학생',
}
const INCOME_LABEL: Record<string, string> = { '0-50': '중위소득 50% 이하', '51-75': '중위소득 51~75%', '76-100': '중위소득 76~100%', '101-200': '중위소득 101~200%', '200+': '중위소득 200% 초과' }

/** 검수된 checklist_json이 있으면 그것을, 없으면 조건 행으로 자동 생성. */
export function buildChecklist(cond: ConditionJoin | null, reviewed: { label: string; condition_key: string }[] | null): CheckItem[] {
  if (reviewed && reviewed.length) return reviewed.map((r) => ({ key: r.condition_key, label: r.label }))
  if (!cond) return []
  const items: CheckItem[] = []
  if (cond.age_min !== null && cond.age_max !== null) {
    const upper = cond.age_max >= 100 ? '' : `~${cond.age_max}`
    items.push({ key: 'age', label: cond.age_max >= 100 ? `만 ${cond.age_min}세 이상` : `만 ${cond.age_min}${upper}세` })
  }
  if (cond.gender !== 'any') items.push({ key: 'gender', label: cond.gender === 'female' ? '여성' : '남성' })
  if (cond.region_codes.length) items.push({ key: 'region', label: `${cond.region_codes.map((c) => REGION_NAME[c] ?? c).join('·')} 거주` })
  if (cond.income_bands.length) items.push({ key: `income:${cond.income_bands.join('|')}`, label: cond.income_bands.map((b) => INCOME_LABEL[b] ?? b).join(' 또는 ') })
  for (const l of cond.life_stages) items.push({ key: `life:${l}`, label: LIFE_LABEL[l] ?? l })
  for (const h of cond.household_types) items.push({ key: `household:${h}`, label: HOUSEHOLD_LABEL[h] ?? h })
  for (const o of cond.occupations) items.push({ key: `occupation:${o}`, label: OCCUPATION_LABEL[o] ?? o })
  return items
}

function situationCovers(situations: string[], kind: 'life' | 'household' | 'occupation', value: string): boolean {
  return situations.some((s) => (SITUATION_TO_CONDITIONS[s]?.[kind] ?? []).includes(value))
}

/** 진단값으로 각 항목을 pass/fail/unknown으로 평가. 판정 근거가 없는 항목은 unknown. */
export function evaluateChecklist(items: CheckItem[], cond: ConditionJoin | null, d: Diagnosis): EvaluatedItem[] {
  return items.map((it) => {
    let state: CheckState = 'unknown'
    if (it.key === 'age' && cond && cond.age_min !== null && cond.age_max !== null) {
      const r = ageBandToRange(d.ageBand)
      if (r) state = r[1] < cond.age_min || r[0] > cond.age_max ? 'fail' : 'pass'
    } else if (it.key === 'region' && cond?.region_codes.length) {
      if (d.region) state = cond.region_codes.includes(d.region) ? 'pass' : 'fail'
    } else if (it.key.startsWith('household:') || it.key.startsWith('occupation:') || it.key.startsWith('life:')) {
      const [kind, value] = it.key.split(':') as ['household' | 'occupation' | 'life', string]
      if (d.situations.length && situationCovers(d.situations, kind, value)) state = 'pass'
    }
    return { ...it, state }
  })
}

export function summarize(evaluated: EvaluatedItem[]): string {
  if (!evaluated.length) return ''
  const pass = evaluated.filter((e) => e.state === 'pass').length
  const fail = evaluated.filter((e) => e.state === 'fail').length
  if (fail > 0) return `${evaluated.length}개 중 ${fail}개가 내 조건과 다릅니다. 공식 페이지에서 확인해 보세요.`
  if (pass === evaluated.length) return `${evaluated.length}개 조건 모두 충족! 바로 신청해 보세요.`
  if (pass > 0) return `${evaluated.length}개 중 ${pass}개 충족 · 나머지는 직접 확인하세요.`
  return '홈에서 조건을 고르면 자동으로 체크됩니다.'
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/benefits/__tests__/checklist.test.ts`
Expected: 6 passed

- [ ] **Step 5: 클라이언트 체크리스트 컴포넌트 테스트**

`src/components/benefits/__tests__/Checklist.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Checklist from '../Checklist'

const cond = { age_min: 19, age_max: 34, gender: 'any', income_bands: [], life_stages: [], household_types: [], occupations: ['job_seeker'], region_codes: ['seoul'] }
const items = [{ key: 'age', label: '만 19~34세' }, { key: 'region', label: '서울 거주' }, { key: 'occupation:job_seeker', label: '구직자·실업자' }]

describe('Checklist', () => {
  beforeEach(() => localStorage.clear())

  it('진단값으로 프리필하고 요약 문장을 보여준다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: ['job_seeker'], region: 'seoul' }))
    render(<Checklist items={items} cond={cond} />)
    expect(screen.getByText(/3개 조건 모두 충족/)).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(3)
  })

  it('사용자가 직접 체크를 바꿀 수 있다', () => {
    render(<Checklist items={items} cond={cond} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes[0].checked).toBe(false)
    fireEvent.click(boxes[0])
    expect(boxes[0].checked).toBe(true)
    expect(screen.getByText(/3개 중 1개 충족/)).toBeInTheDocument()
  })

  it('항목이 없으면 안내만', () => {
    render(<Checklist items={[]} cond={null} />)
    expect(screen.getByText(/대상 조건이 등록되지 않은/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: 컴포넌트 구현**

`src/components/benefits/Checklist.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ConditionJoin } from '@/lib/benefits/queries'
import { evaluateChecklist, summarize, type CheckItem, type CheckState } from '@/lib/benefits/checklist'
import { readDiagnosis } from '@/lib/diagnosis/storage'
import { cn } from '@/lib/utils'

export default function Checklist({ items, cond }: { items: CheckItem[]; cond: ConditionJoin | null }) {
  const [states, setStates] = useState<CheckState[]>(() => items.map(() => 'unknown'))

  useEffect(() => {
    setStates(evaluateChecklist(items, cond, readDiagnosis()).map((e) => e.state))
  }, [items, cond])

  if (!items.length) {
    return (
      <section id="check" className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-bold">내가 대상인지 30초 체크</h2>
        <p className="mt-2 text-sm text-gray-600">이 지원금은 대상 조건이 등록되지 않은 항목입니다. 아래 원문 "지원대상"과 공식 페이지에서 확인하세요.</p>
      </section>
    )
  }

  const evaluated = items.map((it, i) => ({ ...it, state: states[i] ?? 'unknown' }))
  const toggle = (i: number) => setStates((p) => p.map((s, j) => (j === i ? (s === 'pass' ? 'unknown' : 'pass') : s)))

  return (
    <section id="check" className="rounded-xl border bg-white p-4">
      <h2 className="text-base font-bold">내가 대상인지 30초 체크</h2>
      <ul className="mt-3 space-y-2">
        {evaluated.map((e, i) => (
          <li key={e.key} className="flex items-start gap-2">
            <input
              id={`chk-${i}`}
              type="checkbox"
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={e.state === 'pass'}
              onChange={() => toggle(i)}
            />
            <label htmlFor={`chk-${i}`} className={cn('text-sm', e.state === 'fail' && 'text-red-700 line-through decoration-red-300')}>
              {e.label}
              {e.state === 'fail' && <span className="ml-1 text-xs no-underline">내 조건과 다름</span>}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">{summarize(evaluated)}</p>
      <p className="mt-2 text-xs text-gray-500">
        <Link href="/" className="underline">홈에서 조건을 고르면</Link> 자동으로 채워집니다. 체크는 참고용이며 최종 자격은 공식 페이지에서 확인하세요.
      </p>
    </section>
  )
}
```

`src/components/benefits/SummaryGrid.tsx`:
```tsx
import { deadlineLabel, firstLine } from '@/lib/benefits/format'
import type { BenefitDetail } from '@/lib/benefits/queries'

export default function SummaryGrid({ b }: { b: BenefitDetail }) {
  const cells = [
    { k: '지원 내용', v: firstLine(b.amount_text, 60) ?? '공식 페이지 확인' },
    { k: '대상', v: firstLine(b.target_text, 60) ?? '공식 페이지 확인' },
    { k: '신청 기간', v: deadlineLabel(b) },
    { k: '신청처', v: b.apply_method ? b.apply_method.replace(/\|\|/g, ' · ') : (b.agency ?? '공식 페이지 확인') },
  ]
  return (
    <section aria-label="한눈에 보기" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.k} className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-semibold text-gray-500">{c.k}</p>
          <p className="mt-0.5 line-clamp-3 text-sm font-semibold text-gray-900">{c.v}</p>
        </div>
      ))}
    </section>
  )
}
```

`src/components/benefits/Markdown.tsx` (해설 마크다운 최소 렌더러, 외부 의존 없음):
```tsx
/** 검수 콘텐츠용 최소 마크다운: #/## 제목, - 목록, 1. 목록, 빈 줄 단락. 인라인 서식·HTML은 처리하지 않는다(텍스트로 출력). */
export default function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return (
    <div className="space-y-3 text-[15px] leading-7 text-gray-800">
      {blocks.map((blk, i) => {
        const lines = blk.split('\n').filter((l) => l.trim())
        if (!lines.length) return null
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*[-*•]\s+/, '')}</li>)}</ul>
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return <ol key={i} className="list-decimal space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*\d+[.)]\s+/, '')}</li>)}</ol>
        if (/^##\s+/.test(lines[0])) return <h3 key={i} className="pt-2 text-base font-bold">{lines[0].replace(/^##\s+/, '')}</h3>
        if (/^#\s+/.test(lines[0])) return <h2 key={i} className="pt-2 text-lg font-bold">{lines[0].replace(/^#\s+/, '')}</h2>
        return <p key={i} className="whitespace-pre-line">{lines.join('\n')}</p>
      })}
    </div>
  )
}
```

`src/components/benefits/StickyRail.tsx`:
```tsx
import Link from 'next/link'
import AdPlacement from './AdPlacement'

export default function StickyRail({ applyUrl, sections }: { applyUrl: string | null; sections: { id: string; label: string }[] }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 space-y-4">
        <nav aria-label="목차" className="rounded-xl border bg-white p-4 text-sm">
          <p className="mb-2 text-xs font-semibold text-gray-500">목차</p>
          <ul className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="text-gray-700 hover:text-indigo-700">{s.label}</a></li>
            ))}
          </ul>
        </nav>
        {applyUrl && (
          <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-indigo-600 py-3 text-center font-bold text-white hover:bg-indigo-700">
            공식 사이트에서 신청 →
          </a>
        )}
        <AdPlacement slot="rail" />
        <Link href="/my" className="block rounded-xl border bg-white py-2.5 text-center text-sm font-semibold hover:bg-gray-50">내 진단 결과 보기</Link>
      </div>
    </aside>
  )
}
```

`src/components/benefits/SourceFooter.tsx`:
```tsx
import { formatKstDate } from '@/lib/benefits/format'

export default function SourceFooter({ agency, syncedAt, sourceUpdatedAt, applyUrl }: { agency: string | null; syncedAt: string; sourceUpdatedAt: string | null; applyUrl: string | null }) {
  const stale = Date.now() - new Date(syncedAt).getTime() > 24 * 3_600_000
  return (
    <footer className="mt-8 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
      <p>출처: 행정안전부 보조금24{agency ? ` · ${agency}` : ''}{sourceUpdatedAt ? ` · 원문 수정 ${formatKstDate(sourceUpdatedAt)}` : ''}</p>
      <p className={stale ? 'mt-1 text-gray-400' : 'mt-1'}>최종 확인 {formatKstDate(syncedAt)}{stale ? ' · 24시간 이상 지난 정보입니다. 공식 페이지에서 확인하세요.' : ''}</p>
      {applyUrl && <p className="mt-1"><a href={applyUrl} target="_blank" rel="noopener noreferrer" className="underline">정부24 원문 보기</a></p>}
    </footer>
  )
}
```

- [ ] **Step 7: 상세 페이지**

`src/app/(site)/benefit/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBenefitBySlug, listRelated } from '@/lib/benefits/queries'
import { buildChecklist } from '@/lib/benefits/checklist'
import { firstLine, deadlineLabel } from '@/lib/benefits/format'
import { daysUntil } from '@/lib/benefits/status'
import { benefitIndexable } from '@/lib/seo/index-policy'
import { governmentService, breadcrumbs, faqPage } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import { kstYear } from '@/lib/seo/hub-meta'
import { SEGMENT_BY_SLUG } from '../../../../../data/segments'
import { regionName } from '@/components/benefits/BenefitCard'
import DdayBadge from '@/components/benefits/DdayBadge'
import SummaryGrid from '@/components/benefits/SummaryGrid'
import Checklist from '@/components/benefits/Checklist'
import Markdown from '@/components/benefits/Markdown'
import StickyRail from '@/components/benefits/StickyRail'
import SourceFooter from '@/components/benefits/SourceFooter'
import AdPlacement from '@/components/benefits/AdPlacement'
import BenefitCard from '@/components/benefits/BenefitCard'
import JsonLd from '@/components/JsonLd'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return [] // 요청 시 생성 (1만 건 전체 빌드는 하지 않음)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const b = await getBenefitBySlug(decodeURIComponent(slug))
  if (!b) return {}
  const indexable = benefitIndexable({ status: b.status, article: b.benefit_articles })
  const desc = [firstLine(b.amount_text, 50), firstLine(b.target_text, 40), deadlineLabel(b)].filter(Boolean).join(' · ').slice(0, 120)
  return {
    title: `${b.title} 자격조건·신청방법 (${kstYear()})`,
    description: desc,
    alternates: { canonical: absoluteUrl(`/benefit/${b.slug}`) },
    robots: { index: indexable, follow: true },
    openGraph: { title: b.title, description: desc, type: 'article' },
  }
}

export default async function BenefitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const b = await getBenefitBySlug(decodeURIComponent(slug))
  if (!b) notFound()

  const now = new Date()
  const seg = SEGMENT_BY_SLUG[b.segments[0] ?? 'other']
  const related = await listRelated(seg.slug, b.region_code, b.slug, 6)
  const article = b.benefit_articles
  const published = benefitIndexable({ status: b.status, article })
  const checklist = buildChecklist(b.benefit_conditions, article?.checklist_json ?? null)
  const faq = article?.faq_json ?? []
  const closed = b.status !== 'open'

  const sections = [
    { id: 'summary', label: '한눈에 보기' },
    { id: 'check', label: '대상 체크' },
    ...(article?.explainer_md ? [{ id: 'explainer', label: '해설' }] : [{ id: 'original', label: '원문 안내' }]),
    ...(article?.steps_md ? [{ id: 'steps', label: '신청 순서' }] : []),
    ...(faq.length ? [{ id: 'faq', label: '자주 묻는 질문' }] : []),
    { id: 'related', label: '함께 받는 지원금' },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={[
        governmentService({ title: b.title, summary: b.summary, agency: b.agency, region_name: b.region_code === 'ALL' ? null : regionName(b.region_code), apply_url: b.apply_url, slug: b.slug }),
        breadcrumbs([{ name: '홈', path: '/' }, ...(seg.slug !== 'other' ? [{ name: seg.name, path: `/${seg.path}` }] : []), { name: b.title, path: `/benefit/${b.slug}` }]),
        published ? faqPage(faq) : null,
      ]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0">
          <nav className="text-xs text-gray-500">
            <Link href="/">홈</Link>{seg.slug !== 'other' && <> › <Link href={`/${seg.path}`}>{seg.name}</Link></>}
            {b.region_code !== 'ALL' && seg.slug !== 'other' && <> › <Link href={`/${seg.path}/${b.region_code}`}>{regionName(b.region_code)}</Link></>}
          </nav>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{b.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
            <DdayBadge deadline_type={b.deadline_type} apply_end={b.apply_end} now={now} />
            <span>{regionName(b.region_code)}</span>
            {seg.slug !== 'other' && <span>· {seg.name}</span>}
            {article?.review_status === 'stale' && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">내용 확인 중</span>}
          </div>

          {closed && (
            <div className="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
              이 지원금은 마감되었거나 원천에서 내려갔습니다. 다음 공고가 올라오면 이 페이지에서 갱신됩니다. 아래 "함께 받을 수 있는 지원금"을 확인해 보세요.
            </div>
          )}

          <div id="summary" className="mt-5"><SummaryGrid b={b} /></div>

          <div className="mt-5"><Checklist items={checklist} cond={b.benefit_conditions} /></div>

          <AdPlacement slot="detail-1" />

          {article?.explainer_md ? (
            <section id="explainer" className="mt-2">
              <h2 className="mb-2 text-lg font-bold">쉽게 풀어쓴 해설</h2>
              <Markdown text={article.explainer_md} />
            </section>
          ) : (
            <section id="original" className="mt-2 space-y-4">
              <h2 className="text-lg font-bold">원문 안내</h2>
              {b.target_text && <div><h3 className="text-sm font-semibold text-gray-500">지원 대상</h3><p className="whitespace-pre-line text-[15px] leading-7">{b.target_text}</p></div>}
              {b.criteria_text && <div><h3 className="text-sm font-semibold text-gray-500">선정 기준</h3><p className="whitespace-pre-line text-[15px] leading-7">{b.criteria_text}</p></div>}
              {b.amount_text && <div><h3 className="text-sm font-semibold text-gray-500">지원 내용</h3><p className="whitespace-pre-line text-[15px] leading-7">{b.amount_text}</p></div>}
            </section>
          )}

          {article?.steps_md && (
            <section id="steps" className="mt-8">
              <h2 className="mb-2 text-lg font-bold">신청 순서</h2>
              <Markdown text={article.steps_md} />
            </section>
          )}

          {b.apply_method && !article?.steps_md && (
            <p className="mt-6 text-sm text-gray-700"><span className="font-semibold">신청 방법:</span> {b.apply_method.replace(/\|\|/g, ', ')}{b.contact ? ` · 문의 ${b.contact.replace(/\|\|/g, ', ')}` : ''}</p>
          )}

          {faq.length > 0 && (
            <section id="faq" className="mt-8">
              <h2 className="mb-2 text-lg font-bold">자주 묻는 질문</h2>
              <dl className="divide-y rounded-xl border bg-white">
                {faq.map((f, i) => (
                  <div key={i} className="p-4">
                    <dt className="font-semibold">Q. {f.q}</dt>
                    <dd className="mt-1 text-[15px] leading-7 text-gray-700">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <AdPlacement slot="detail-2" />

          <section id="related" className="mt-2">
            <h2 className="mb-3 text-lg font-bold">함께 받을 수 있는 지원금</h2>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {related.map((r) => <div key={r.slug} className="w-[78%] shrink-0 snap-start sm:w-auto"><BenefitCard row={r} now={now} /></div>)}
            </div>
          </section>

          <SourceFooter agency={b.agency} syncedAt={b.synced_at} sourceUpdatedAt={b.source_updated_at} applyUrl={b.apply_url} />
        </article>

        <StickyRail applyUrl={b.apply_url} sections={sections} />
      </div>

      {b.apply_url && !closed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 backdrop-blur lg:hidden">
          <a href={b.apply_url} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-indigo-600 py-3 text-center font-bold text-white">
            공식 사이트에서 신청 → {daysUntil(b.apply_end, now) !== null && daysUntil(b.apply_end, now)! >= 0 ? `(D-${daysUntil(b.apply_end, now)})` : ''}
          </a>
        </div>
      )}
      <div className="h-20 lg:hidden" />
    </div>
  )
}
```

- [ ] **Step 8: 통과 확인 + 화면 확인**

Run: `npx vitest run src/lib/benefits src/components/benefits` → PASS
`http://localhost:3111/benefit/<실제 slug>` 열기(slug는 `/youth` 목록에서 클릭). 확인: 4칸 요약, 체크리스트가 홈 진단값으로 프리필, 데스크톱(≥1024px) 우측 레일 sticky, 모바일 하단 고정 버튼, `view-source`에 `noindex`(해설 미게재이므로) 및 JSON-LD 2개.

- [ ] **Step 9: Commit**

```bash
git add src/lib/benefits/checklist.ts src/lib/benefits/__tests__/checklist.test.ts src/components/benefits "src/app/(site)/benefit"
git commit -m "feat(detail): 지원금 상세 A안 (요약 4칸, 30초 체크 프리필, 해설/원문, FAQ, 관련, 레일, 하단 CTA)"
```

---

### Task 11: 마감 캘린더 + 가이드 페이지

**Files:**
- Create: `src/lib/benefits/calendar.ts`, `src/app/(site)/deadline/page.tsx`, `src/app/(site)/guide/[slug]/page.tsx`
- Modify: `src/lib/benefits/queries.ts` (getGuide, listDeadlineSoon limit 확대)
- Test: `src/lib/benefits/__tests__/calendar.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/benefits/__tests__/calendar.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { groupByWeek } from '../calendar'

const row = (slug: string, end: string) => ({ slug, title: slug, summary: null, amount_text: null, deadline_type: 'period', apply_start: null, apply_end: end, region_code: 'ALL', segments: ['other' as const], agency: null, synced_at: '' })
const now = new Date('2026-09-10T03:00:00Z') // 목요일

describe('groupByWeek', () => {
  it('이번 주 / 다음 주 / 이달 안 / 그 이후 로 묶고 각 그룹은 마감 오름차순', () => {
    const g = groupByWeek([row('c', '2026-09-25'), row('a', '2026-09-11'), row('b', '2026-09-16'), row('d', '2026-10-05')], now)
    expect(g.map((x) => x.label)).toEqual(['이번 주', '다음 주', '이달 안', '그 이후'])
    expect(g[0].rows.map((r) => r.slug)).toEqual(['a'])
    expect(g[1].rows.map((r) => r.slug)).toEqual(['b'])
    expect(g[2].rows.map((r) => r.slug)).toEqual(['c'])
    expect(g[3].rows.map((r) => r.slug)).toEqual(['d'])
  })
  it('빈 그룹은 제외', () => {
    expect(groupByWeek([row('a', '2026-09-11')], now).map((x) => x.label)).toEqual(['이번 주'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/benefits/__tests__/calendar.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/benefits/calendar.ts`:
```ts
import type { BenefitListRow } from './queries'
import { kstDateString } from './status'

export interface WeekGroup { label: string; rows: BenefitListRow[] }

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** KST 기준 이번 주(일요일까지) / 다음 주 / 이달 안 / 그 이후. 마감 오름차순. */
export function groupByWeek(rows: BenefitListRow[], now: Date): WeekGroup[] {
  const today = kstDateString(now)
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0=일
  const daysToSunday = dow === 0 ? 0 : 7 - dow
  const endOfWeek = addDays(today, daysToSunday) // 이번 주 일요일
  const endOfNextWeek = addDays(endOfWeek, 7)
  const endOfMonth = `${today.slice(0, 7)}-31`
  const sorted = [...rows].filter((r) => r.apply_end && r.apply_end >= today).sort((a, b) => a.apply_end!.localeCompare(b.apply_end!))
  const groups: WeekGroup[] = [
    { label: '이번 주', rows: sorted.filter((r) => r.apply_end! <= endOfWeek) },
    { label: '다음 주', rows: sorted.filter((r) => r.apply_end! > endOfWeek && r.apply_end! <= endOfNextWeek) },
    { label: '이달 안', rows: sorted.filter((r) => r.apply_end! > endOfNextWeek && r.apply_end! <= endOfMonth) },
    { label: '그 이후', rows: sorted.filter((r) => r.apply_end! > endOfNextWeek && r.apply_end! > endOfMonth) },
  ]
  return groups.filter((g) => g.rows.length)
}
```

`src/lib/benefits/queries.ts`에 추가:
```ts
export const getGuide = unstable_cache(
  async (slug: string): Promise<{ slug: string; title: string; body_md: string; segment: string | null; published_at: string | null } | null> => {
    const { data, error } = await createPublicClient().from('guides').select('slug, title, body_md, segment, published_at').eq('slug', slug).maybeSingle()
    if (error) throw error
    return data
  },
  ['guide'],
  { tags: ['guides'], revalidate: 86400 },
)

export const listGuides = unstable_cache(
  async (): Promise<{ slug: string; title: string; segment: string | null; published_at: string | null }[]> => {
    const { data, error } = await createPublicClient().from('guides').select('slug, title, segment, published_at').not('published_at', 'is', null).order('published_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  ['guides'],
  { tags: ['guides'], revalidate: 86400 },
)
```

`src/app/(site)/deadline/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { listDeadlineSoon } from '@/lib/benefits/queries'
import { groupByWeek } from '@/lib/benefits/calendar'
import { kstYear } from '@/lib/seo/hub-meta'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitList from '@/components/benefits/BenefitList'

export const revalidate = 3600

export const metadata: Metadata = {
  title: `${kstYear()} 마감 임박 지원금 캘린더`,
  description: '이번 주·다음 주·이달 안에 신청이 끝나는 정부·지자체 지원금을 마감일 순으로 모았습니다.',
  alternates: { canonical: absoluteUrl('/deadline') },
}

export default async function DeadlinePage() {
  const now = new Date()
  const rows = await listDeadlineSoon(45, 200)
  const groups = groupByWeek(rows, now)
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">마감 임박 지원금</h1>
      <p className="mt-2 text-gray-600">앞으로 45일 안에 신청이 끝나는 지원금입니다. 상시 신청 지원금은 분야별 페이지에서 확인하세요.</p>
      {groups.length === 0 && <p className="mt-8 text-gray-500">현재 마감 예정인 지원금이 없습니다.</p>}
      {groups.map((g) => (
        <section key={g.label} className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{g.label} <span className="text-sm font-normal text-gray-500">{g.rows.length}개</span></h2>
          <BenefitList rows={g.rows} now={now} />
        </section>
      ))}
    </div>
  )
}
```

`src/app/(site)/guide/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGuide } from '@/lib/benefits/queries'
import { absoluteUrl } from '@/lib/seo/site'
import Markdown from '@/components/benefits/Markdown'
import AdPlacement from '@/components/benefits/AdPlacement'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() { return [] }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const g = await getGuide(decodeURIComponent(slug))
  if (!g || !g.published_at) return {}
  return { title: g.title, description: g.body_md.slice(0, 120).replace(/\s+/g, ' '), alternates: { canonical: absoluteUrl(`/guide/${g.slug}`) } }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const g = await getGuide(decodeURIComponent(slug))
  if (!g || !g.published_at) notFound()
  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{g.title}</h1>
      <div className="mt-6"><Markdown text={g.body_md} /></div>
      <AdPlacement slot="detail-2" />
    </article>
  )
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/benefits/__tests__/calendar.test.ts` → 2 passed
`http://localhost:3111/deadline`에서 그룹 표시 확인. `/guide/없는-글`은 404.

- [ ] **Step 5: Commit**

```bash
git add src/lib/benefits "src/app/(site)/deadline" "src/app/(site)/guide"
git commit -m "feat: 마감 캘린더(주 단위 그룹)와 가이드 페이지"
```

---

### Task 12: 사이트맵 · robots · OG 이미지 · Cron 태그 보강

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`, `src/lib/seo/sitemap-entries.ts`
- Modify: `src/app/api/cron/sync-gov24/route.ts`, `src/app/api/cron/__tests__/sync-gov24.test.ts`
- Test: `src/lib/seo/__tests__/sitemap-entries.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/seo/__tests__/sitemap-entries.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { benefitEntries, regionHubEntries, staticEntries } from '../sitemap-entries'

beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com' })

describe('sitemap entries', () => {
  it('상세는 색인 가능한 것만, lastmod는 원문 수정·검수 중 최신', () => {
    const rows = [
      { slug: 'a', status: 'open', source_updated_at: '2026-09-01T00:00:00Z', benefit_articles: { review_status: 'published', indexable: true, reviewed_at: '2026-09-05T00:00:00Z' } },
      { slug: 'b', status: 'open', source_updated_at: '2026-09-01T00:00:00Z', benefit_articles: null },
      { slug: 'c', status: 'closed', source_updated_at: '2026-09-01T00:00:00Z', benefit_articles: { review_status: 'published', indexable: true, reviewed_at: null } },
    ]
    const e = benefitEntries(rows)
    expect(e.map((x) => x.url)).toEqual(['https://example.com/benefit/a'])
    expect(e[0].lastModified).toEqual(new Date('2026-09-05T00:00:00Z'))
  })
  it('세그먼트×지역은 항목 3개 이상 + 안내문 있는 것만', () => {
    const e = regionHubEntries(
      [{ segmentPath: 'youth', regionSlug: 'seoul', count: 5 }, { segmentPath: 'youth', regionSlug: 'jeju', count: 2 }, { segmentPath: 'parenting', regionSlug: 'seoul', count: 9 }],
      { seoul: '서울 안내', jeju: '제주 안내' },
    )
    expect(e.map((x) => x.url)).toEqual(['https://example.com/youth/seoul', 'https://example.com/parenting/seoul'])
  })
  it('정적 항목에 홈·세그먼트 3개·마감·필수 페이지 포함, /my 제외', () => {
    const urls = staticEntries().map((x) => x.url)
    expect(urls).toContain('https://example.com/')
    expect(urls).toContain('https://example.com/small-biz')
    expect(urls).toContain('https://example.com/deadline')
    expect(urls).toContain('https://example.com/about')
    expect(urls.some((u) => u.endsWith('/my'))).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/seo/__tests__/sitemap-entries.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/lib/seo/sitemap-entries.ts`:
```ts
import type { MetadataRoute } from 'next'
import { absoluteUrl } from './site'
import { benefitIndexable, regionHubIndexable } from './index-policy'
import { PUBLIC_SEGMENTS } from '../../../data/segments'

type Entry = MetadataRoute.Sitemap[number]

export function benefitEntries(rows: { slug: string; status: string; source_updated_at: string | null; benefit_articles: { review_status: string; indexable: boolean; reviewed_at: string | null } | null }[]): Entry[] {
  return rows
    .filter((r) => benefitIndexable({ status: r.status, article: r.benefit_articles }))
    .map((r) => {
      const times = [r.source_updated_at, r.benefit_articles?.reviewed_at].filter((t): t is string => !!t).map((t) => new Date(t).getTime())
      return { url: absoluteUrl(`/benefit/${r.slug}`), lastModified: times.length ? new Date(Math.max(...times)) : new Date(), changeFrequency: 'weekly', priority: 0.8 }
    })
}

export function regionHubEntries(counts: { segmentPath: string; regionSlug: string; count: number }[], descriptions: Record<string, string | null>): Entry[] {
  return counts
    .filter((c) => regionHubIndexable({ count: c.count, description_md: descriptions[c.regionSlug] ?? null }))
    .map((c) => ({ url: absoluteUrl(`/${c.segmentPath}/${c.regionSlug}`), lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 }))
}

export function staticEntries(): Entry[] {
  const now = new Date()
  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    ...PUBLIC_SEGMENTS.map((s) => ({ url: absoluteUrl(`/${s.path}`), lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 })),
    { url: absoluteUrl('/deadline'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/contact'), lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: absoluteUrl('/privacy'), lastModified: now, changeFrequency: 'yearly', priority: 0.1 },
    { url: absoluteUrl('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.1 },
  ]
}
```

`src/app/sitemap.ts` (사이트맵 인덱스: Next는 `generateSitemaps`로 분할):
```ts
import type { MetadataRoute } from 'next'
import { createPublicClient } from '@/lib/supabase/server'
import { benefitEntries, regionHubEntries, staticEntries } from '@/lib/seo/sitemap-entries'
import { PUBLIC_SEGMENTS } from '../../data/segments'
import { REGIONS } from '../../data/regions'

export const revalidate = 3600

// id 0: 정적+지역 허브, id 1..3: 세그먼트별 상세(색인 가능한 것만)
export async function generateSitemaps() {
  return [{ id: 0 }, ...PUBLIC_SEGMENTS.map((_, i) => ({ id: i + 1 }))]
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient()
  if (id === 0) {
    const [{ data: regions }, { data: rows }] = await Promise.all([
      supabase.from('regions').select('slug, description_md'),
      supabase.from('benefits').select('region_code, segments').eq('status', 'open'),
    ])
    const descriptions = Object.fromEntries((regions ?? []).map((r) => [r.slug, r.description_md]))
    const counts = PUBLIC_SEGMENTS.flatMap((s) =>
      REGIONS.map((r) => ({
        segmentPath: s.path,
        regionSlug: r.slug,
        count: (rows ?? []).filter((b) => b.segments.includes(s.slug) && (b.region_code === r.slug || b.region_code === 'ALL')).length,
      })),
    )
    return [...staticEntries(), ...regionHubEntries(counts, descriptions)]
  }
  const seg = PUBLIC_SEGMENTS[id - 1]
  if (!seg) return []
  const { data } = await supabase
    .from('benefits')
    // !inner: 해설 행이 있는 지원금만 조인 결과에 남는다
    .select('slug, status, source_updated_at, benefit_articles!inner(review_status, indexable, reviewed_at)')
    .eq('status', 'open')
    .contains('segments', [seg.slug])
  return benefitEntries(((data ?? []) as unknown as Parameters<typeof benefitEntries>[0]).map((r) => ({ ...r, benefit_articles: Array.isArray(r.benefit_articles) ? r.benefit_articles[0] ?? null : r.benefit_articles })))
}
```

`src/app/robots.ts`:
```ts
import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/my', '/api/', '/admin/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
```

`src/app/opengraph-image.tsx`:
```tsx
import { ImageResponse } from 'next/og'
import { siteName, SITE_DESCRIPTION } from '@/lib/seo/site'

export const runtime = 'edge'
export const alt = '지원금 포털'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#4338ca,#6366f1)', color: 'white', fontSize: 64, fontWeight: 800 }}>
        <div>{siteName()}</div>
        <div style={{ marginTop: 24, fontSize: 32, fontWeight: 400, opacity: 0.9 }}>{SITE_DESCRIPTION}</div>
      </div>
    ),
    size,
  )
}
```

`src/app/api/cron/sync-gov24/route.ts`의 재검증 블록에 한 줄 추가:
```ts
    if (result.changed > 0 || result.closed > 0 || result.removed > 0) {
      revalidateTag('benefits:home')
      revalidateTag('benefits:all') // unstable_cache 조회 함수(상세·목록·집계)
    }
```
아래 세 줄을 위 블록으로 **교체**한다(앞의 두 루프까지 함께 지운다):
```ts
    for (const slug of result.changedSlugs) revalidateTag(`benefit:${slug}`)
    for (const seg of result.changedSegments) revalidateTag(`segment:${seg}`)
    if (result.changed > 0 || result.closed > 0) revalidateTag('benefits:home')
```
두 루프를 지우는 이유: `unstable_cache`의 태그는 함수 단위라 `benefit:{slug}`·`segment:{seg}` 태그를 가진
캐시 항목이 하나도 없다. 즉 두 루프는 아무것도 무효화하지 못하는 no-op이면서, 원본 갱신 시각이 통째로
바뀌는 동기화(실제로 10,947건 전부 변경으로 잡힌 적이 있다)에서는 만 번 넘는 호출이 되어 Vercel Hobby의
60초 maxDuration을 위협한다. `benefits:all` 하나가 상세·목록·집계 전부를 덮는다.

테스트 `sync-gov24.test.ts`의 성공 케이스에 `expect(revalidateTag).toHaveBeenCalledWith('benefits:all')`를
추가하고, `benefit:`/`segment:` 태그로는 더 이상 호출되지 않는지도 확인한다.

- [ ] **Step 4: 통과 확인 + 빌드**

Run: `npx vitest run src/lib/seo src/app/api/cron` → PASS
Run: `npm run build` → `/sitemap/[id]`, `/robots.txt`, `/opengraph-image` 생성.
`curl -s http://localhost:3111/sitemap.xml | head` → sitemapindex에 4개 항목. `curl -s http://localhost:3111/sitemap/1.xml | grep -c '<url>'` → 검수 콘텐츠가 없는 지금은 0(정상, Plan 3에서 채워짐). `curl -s http://localhost:3111/robots.txt`.

- [ ] **Step 5: Commit**

```bash
git add src/app/sitemap.ts src/app/robots.ts src/app/opengraph-image.tsx src/lib/seo src/app/api/cron
git commit -m "feat(seo): 분할 사이트맵(색인 정책 반영), robots, OG 이미지, Cron benefits:all 재검증"
```

---

### Task 13: 검색 정렬 개선 (Plan 2 이관 항목)

**Files:**
- Modify: `src/lib/benefits/search.ts`, `src/lib/benefits/__tests__/search.test.ts`

스펙 12절: 사용자 지역 일치 항목을 전국(ALL)보다 위로, 상황 조건이 실제로 일치한 항목을 "조건 무관" 항목보다 위로.

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/benefits/__tests__/search.test.ts`에 추가:
```ts
import { matchScore } from '../search'

describe('matchScore', () => {
  const base = { age_min: null, age_max: null, gender: 'any' as const, life_stages: [], household_types: [], occupations: [], region_codes: [] }
  const q = { ageRange: [20, 29] as [number, number], situations: ['job_seeker'], region: 'seoul' }
  it('상황 일치 +2, 지역 일치 +1, 나이 조건 일치 +1', () => {
    expect(matchScore({ ...base, occupations: ['job_seeker'], region_codes: ['seoul'], age_min: 19, age_max: 34 }, q)).toBe(4)
    expect(matchScore({ ...base, region_codes: ['seoul'] }, q)).toBe(1)
    expect(matchScore(base, q)).toBe(0)
    expect(matchScore(null, q)).toBe(0)
  })
})

describe('rankBenefits with score', () => {
  it('점수 높은 항목이 먼저, 같은 점수 안에서 마감 임박 → 상시 → 조건 확인 필요', () => {
    const rows = [
      { slug: 'generic-soon', deadline_type: 'period', apply_end: '2026-09-15', hasConditions: true, score: 0 },
      { slug: 'match-always', deadline_type: 'always', apply_end: null, hasConditions: true, score: 3 },
      { slug: 'match-soon', deadline_type: 'period', apply_end: '2026-09-20', hasConditions: true, score: 3 },
      { slug: 'unsure', deadline_type: 'unknown', apply_end: null, hasConditions: false, score: 0 },
    ]
    expect(rankBenefits(rows, new Date('2026-09-10T03:00:00Z')).map((r) => r.slug)).toEqual(['match-soon', 'match-always', 'generic-soon', 'unsure'])
  })
})
```
기존 `rankBenefits` 테스트('마감 임박 → 상시 → 조건 확인 필요 순')의 4개 행 객체에 각각 `score: 0`을 추가한다(기존 순서 기대값은 그대로 유효). `SearchResultItem`을 만드는 Task 8의 `DiagnosisResults.test.tsx` `item()` 헬퍼에도 `score: 0`을 넣는다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/benefits/__tests__/search.test.ts`
Expected: FAIL — `matchScore` 없음

- [ ] **Step 3: 구현**

`src/lib/benefits/search.ts` 수정:
```ts
// Rankable에 score 추가
export interface Rankable {
  slug: string
  deadline_type: string
  apply_end: string | null
  hasConditions: boolean
  score: number
}

/** 사용자 입력과 실제로 맞물린 정도. 상황 일치 2, 지역 일치 1, 나이 조건 존재·일치 1. 조건 없음은 0. */
export function matchScore(c: CondLike | null, q: Criteria): number {
  if (!c) return 0
  let s = 0
  if (q.situations.length && c.life_stages.length + c.household_types.length + c.occupations.length > 0) s += 2
  if (q.region && c.region_codes.includes(q.region)) s += 1
  if (q.ageRange && c.age_min !== null && c.age_max !== null) s += 1
  return s
}

export function rankBenefits<T extends Rankable>(rows: T[], now: Date): T[] {
  const group = (r: Rankable) => (!r.hasConditions ? 2 : r.deadline_type === 'period' && r.apply_end ? 0 : 1)
  return [...rows].sort((a, b) => {
    const s = b.score - a.score
    if (s !== 0) return s
    const g = group(a) - group(b)
    if (g !== 0) return g
    if (group(a) === 0) return (daysUntil(a.apply_end, now) ?? 0) - (daysUntil(b.apply_end, now) ?? 0)
    return a.slug.localeCompare(b.slug)
  })
}
```
`searchBenefits`의 매핑에서 `hasConditions: !!cond` 옆에 `score: matchScore(cond, q)`를 추가하고, `SearchResultItem`에 `score: number`를 추가한다. `matchesConditions`는 그대로(통과 여부), `matchScore`는 정렬용이다.

- [ ] **Step 4: 통과 확인 + 실호출**

Run: `npx vitest run src/lib/benefits` → PASS
`curl -s "http://localhost:3111/api/benefits/search?age=20s&situations=job_seeker&region=seoul&limit=5"` → 상위 항목이 구직·서울 관련이어야 한다(Plan 1 때 인플루엔자 예방접종이 상단이던 문제 해소 확인).

- [ ] **Step 5: Commit**

```bash
git add src/lib/benefits/search.ts src/lib/benefits/__tests__/search.test.ts
git commit -m "feat(search): 조건 일치 점수로 정렬 (지역·상황·나이 일치 우선)"
```

---

### Task 14: 전체 검증 · 성능 · 문서

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-09-10-benefits-portal-design.md`(12절)

- [ ] **Step 1: 전체 테스트·린트·빌드**

```bash
npm run test:run && npm run lint && npm run build
```
Expected: 전부 통과. 빌드 산출물에 `/`, `/[segment]`(3), `/[segment]/[region]`(51), `/benefit/[slug]`, `/deadline`, `/guide/[slug]`, `/my`, 필수 4페이지, `/sitemap/[id]`, `/robots.txt`, `/opengraph-image`.

- [ ] **Step 2: Lighthouse (모바일)**

```bash
npm run build && npm run start -- -p 3111 &
npx lighthouse http://localhost:3111/ --preset=perf --form-factor=mobile --screenEmulation.mobile --output=json --output-path=/tmp/lh-home.json --chrome-flags="--headless" --quiet
npx lighthouse "http://localhost:3111/benefit/$(curl -s 'http://localhost:3111/api/benefits/search?limit=1' | python3 -c 'import json,sys;print(json.load(sys.stdin)["items"][0]["slug"])')" --preset=perf --form-factor=mobile --screenEmulation.mobile --output=json --output-path=/tmp/lh-detail.json --chrome-flags="--headless" --quiet
python3 -c 'import json;[print(f, json.load(open(f))["categories"]["performance"]["score"]*100, json.load(open(f))["audits"]["cumulative-layout-shift"]["numericValue"]) for f in ["/tmp/lh-home.json","/tmp/lh-detail.json"]]'
```
Expected: 성능 90 이상, CLS 0.1 미만(스펙 10). 미달 시 원인은 보통 (a) 광고 슬롯 높이 미예약 → `AdPlacement`의 `minHeight` 확인, (b) 큰 이미지 없음이므로 폰트/JS. 광고 env가 비어 있으면 슬롯이 렌더되지 않으므로 CLS는 통과해야 한다.

- [ ] **Step 3: 반응형·접근성 수동 확인**

- 400px 폭에서 홈·상세·허브 모두 가로 스크롤 없음(개발자 도구 device toolbar)
- 상세 페이지 모바일 하단 고정 버튼이 푸터를 가리지 않음(`h-20` 여백)
- 칩 버튼 높이 44px 이상(`min-h-11`)
- 키보드 Tab으로 칩·체크박스·링크 순회 가능

- [ ] **Step 4: README 갱신**

`README.md`의 "검색 API" 섹션 뒤에 추가:
```markdown
## 페이지

| 경로 | 내용 | 색인 |
|---|---|---|
| `/` | 조건 진단 + 마감 임박 + 분야 | O |
| `/my` | 진단 결과 (localStorage 기반) | X |
| `/youth` `/parenting` `/small-biz` | 세그먼트 허브 | O |
| `/{segment}/{region}` | 세그먼트×지역 (항목 3개 이상 + 지역 안내문 있을 때만) | 조건부 |
| `/benefit/{slug}` | 상세 (검수 게재된 해설이 있을 때만) | 조건부 |
| `/deadline` | 마감 캘린더 | O |
| `/guide/{slug}` | 가이드 | O |

색인 규칙은 `src/lib/seo/index-policy.ts` 한 곳에서 결정하고 페이지 robots 메타와 사이트맵이 모두 따른다.

## 광고

`AdPlacement` 컴포넌트가 유일한 진입점. `NEXT_PUBLIC_ADSENSE_CLIENT`가 있으면 애드센스, 없고 `NEXT_PUBLIC_ADFIT_UNIT_*`가 있으면 애드핏, 둘 다 없으면 렌더하지 않음.
```

- [ ] **Step 5: 스펙 12절 갱신**

Plan 2 이관 질문 중 "검색 랭킹" 항목을 다음으로 교체:
```markdown
- 검색 랭킹 → Plan 2 Task 13에서 `matchScore`(상황 2·지역 1·나이 1)로 정렬. 조건 무관 항목은 점수 0으로 뒤에 온다.
```

- [ ] **Step 6: Commit 및 병합**

```bash
git add docs README.md
git diff --cached --stat
git commit -m "docs: Plan 2 완료 — 페이지·색인 정책·광고 안내, 스펙 갱신"
git checkout main && git merge --ff-only feat/plan-2-screens
```

---

## 완료 기준 (스펙 11. 2단계)

- [ ] 홈 진단 칩 → 개수 → `/my` 목록까지 동작하고 새로 고침 후 복원
- [ ] 세그먼트 허브 3개, 세그먼트×지역 51개, 상세, 마감 캘린더, 필수 4페이지 렌더
- [ ] 상세 30초 체크가 진단값으로 프리필되고 요약 문장이 바뀜
- [ ] 색인: 해설 없는 상세와 `/my`는 noindex, 사이트맵은 색인 정책과 일치
- [ ] 데스크톱 우측 레일 sticky, 모바일 하단 CTA, 400px 가로 스크롤 없음
- [ ] Lighthouse 모바일 성능 90 이상, CLS 0.1 미만
- [ ] 테스트·린트·빌드 통과

## Plan 3 예고 (별도 문서)

초안 스크립트(`scripts/draft-articles.ts`, Claude API), 검수 화면 `/admin/review`(Supabase Auth), 핵심 지원금 150개 검수·게재, 가이드 10편, 지역 안내문 17개. Plan 2가 만든 `benefit_articles` 조인·`Markdown` 렌더러·색인 정책을 그대로 쓴다.
