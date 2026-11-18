import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/server'
import { CACHE_TAGS, housingTag, isSlugLike } from '@/lib/cache-tags'
import type { HousingKind, HousingSource, HousingStatus, HousingUnitTypeRow } from '@/types/housing'
import { REGION_ALL } from '../../../data/regions'
import { resolveEligibility } from './eligibility-type'
import { ELIGIBILITY_GUIDES } from './eligibility-guides'
import { effectiveHousingStatus, sortActiveHousing } from './status'
import { kstDateString } from '@/lib/benefits/status'

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
  /** 유형별 공통 자격 한 줄. DB 열이 아니라 listHousing이 붙인다(withEligibility). 안내가 없는 유형은 null. */
  eligibility_summary?: string | null
  /** 제목이 자격 완화·상시모집·선착순을 알리는 LH 임대 공고. */
  eligibility_relaxed?: boolean
}

/** 카드에 실을 자격 한 줄. 서버에서만 부른다 — 안내 데이터가 클라이언트 번들에 들어가지 않게. */
export function withEligibility<T extends HousingCardRow>(row: T): T {
  const m = resolveEligibility(row)
  const guide = m ? ELIGIBILITY_GUIDES[m.key] : undefined
  return { ...row, eligibility_summary: guide?.summary ?? null, eligibility_relaxed: !!guide && !!m?.relaxed }
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
  /** active = 접수중(마감 임박 순) → 접수 예정(시작 임박 순), closed = 마감(최근 마감 순). removed는 어디에도 안 나온다. */
  status: HousingListStatus
  kind: HousingKind | null
  /** REGIONS slug. 그 지역 + 전국(ALL)을 함께 낸다. null이면 전체. */
  region: string | null
  limit: number
}

/** 상한. PostgREST 단일 응답이 1000행으로 잘리므로 1000 이하로 유지해야 한다. 180일 창의 공고는 수백 건이라 전체를 한 번에 받아도 된다(홈·my 블록이 이 목록을 메모리에서 거른다). */
export const HOUSING_LIST_LIMIT = 500

/** 접수 일자로 보아 아직 끝나지 않은 공고(PostgREST or 조건). 일자가 없는 공고(LH)는 DB 상태를 믿는다. */
const notEnded = (today: string) => `receipt_end.is.null,receipt_end.gte.${today}`

/**
 * 목록. 상태는 DB 값만 믿지 않고 접수 일자로 다시 센다(effectiveHousingStatus) — 동기화가 밀려도 끝난 공고가
 * 접수중 목록 위에 뜨지 않게. active는 전부 받아 메모리에서 정렬한 뒤 limit만큼 자른다(접수중이 예정보다 먼저여야
 * 하는데 DB 정렬 하나로는 안 된다. 접수중+예정은 수백 건이다).
 * today(KST 날짜)가 캐시 키에 들어가므로 자정에 목록이 새로 만들어진다.
 */
const listHousingCached = unstable_cache(
  async (input: HousingListInput, today: string): Promise<HousingCardRow[]> => {
    const now = new Date(`${today}T00:00:00+09:00`)
    // 필터를 다 건 뒤에 정렬·limit을 건다. Supabase 빌더는 limit 뒤에는 필터 메서드가 없다.
    let q = createPublicClient().from('housing_notices').select(CARD_COLS)
    q = input.status === 'active'
      ? q.in('status', ['open', 'upcoming']).or(notEnded(today))
      : q.or(`status.eq.closed,and(status.in.(open,upcoming),receipt_end.lt.${today})`)
    if (input.kind) q = q.eq('kind', input.kind)
    if (input.region) q = q.in('region_code', [input.region, REGION_ALL])
    const active = input.status === 'active'
    const { data, error } = await q
      .order('receipt_end', { ascending: active, nullsFirst: false })
      .order('slug')
      .limit(active ? HOUSING_LIST_LIMIT : input.limit)
    if (error) throw error
    const rows = ((data ?? []) as unknown as HousingCardRow[]).map((r) => withEligibility({ ...r, status: effectiveHousingStatus(r, now) }))
    return active ? sortActiveHousing(rows).slice(0, input.limit) : rows
  },
  ['housing-list-v3'], // v3: 상태를 접수 일자로 다시 세고, 접수중을 먼저 낸다
  { tags: [CACHE_TAGS.housingLists], revalidate: DAY },
)

export function listHousing(input: HousingListInput): Promise<HousingCardRow[]> {
  return listHousingCached(input, kstDateString(new Date()))
}

/** 지역별 접수중+예정 건수(그 지역 전용만, ALL 제외). 색인 판정(housingRegionIndexable)과 사이트맵이 쓴다. */
const countActiveCached = unstable_cache(
  async (today: string): Promise<Record<string, number>> => {
    // PostgREST는 한 응답을 1000행에서 조용히 자른다. limit을 키워도 소용없으므로 slug 순으로 페이지를 넘긴다.
    const PAGE = 1000
    const out: Record<string, number> = {}
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await createPublicClient()
        .from('housing_notices')
        .select('region_code')
        .in('status', ['open', 'upcoming'])
        .or(notEnded(today))
        .order('slug')
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = data ?? []
      for (const r of rows) {
        const code = r.region_code as string
        if (code === REGION_ALL) continue
        out[code] = (out[code] ?? 0) + 1
      }
      if (rows.length < PAGE) break
    }
    return out
  },
  ['housing-count-by-region-v2'],
  { tags: [CACHE_TAGS.housingLists], revalidate: DAY },
)

export function countActiveHousingByRegion(): Promise<Record<string, number>> {
  return countActiveCached(kstDateString(new Date()))
}

/** 상세. generateMetadata와 페이지가 한 요청에서 두 번 불러도 조회는 한 번(React cache). */
export const getHousingBySlug = cache(async (slug: string): Promise<HousingDetail | null> => {
  if (!isSlugLike(slug)) return null
  const d = await unstable_cache(
    fetchHousingBySlug,
    ['housing-by-slug', slug],
    { tags: [CACHE_TAGS.housingAll, housingTag(slug)], revalidate: WEEK },
  )(slug)
  // 캐시는 일주일이다. 상태는 캐시 밖에서 오늘 날짜로 다시 센다(끝난 공고에 '신청하기'가 남지 않게).
  return d ? { ...d, status: effectiveHousingStatus(d, new Date()) } : null
})

const fetchHousingBySlug = async (slug: string): Promise<HousingDetail | null> => {
  const { data, error } = await createPublicClient()
    .from('housing_notices')
    .select('*, housing_unit_types(*)')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const d = data as unknown as HousingDetail
  d.housing_unit_types = [...(d.housing_unit_types ?? [])].sort((a, b) => a.house_type.localeCompare(b.house_type, 'ko'))
  return d
}
