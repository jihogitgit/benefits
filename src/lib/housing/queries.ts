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
