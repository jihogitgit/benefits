import { PUBLIC_SEGMENTS, SEGMENT_OTHER, SEGMENT_BY_PATH } from '../../../data/segments'
import { REGIONS } from '../../../data/regions'
import { normalizeQuery } from './query-text'
import type { Segment } from '@/types/database'

/**
 * /benefits 전체 목록의 필터·정렬 입력.
 *
 * 허브(/youth 등)는 마감 임박 순 40개에서 잘리고 정렬·필터가 없어, 제목의 "N개"를 끝까지
 * 볼 길이 없었다. 상시 접수 사업은 마감 정렬에서 맨 뒤로 밀려 40개 안에 거의 들지 못했다.
 * 이 페이지가 그 나머지를 받는다.
 *
 * 입력은 전부 쿼리스트링이다 — 필터 상태가 주소에 남아야 공유·뒤로 가기·새로고침이 된다.
 * 허용 목록에 없는 값은 버린다(캐시 키가 임의 문자열로 불어나지 않게).
 */

export const BROWSE_PAGE_SIZE = 20

export const BROWSE_SEGMENTS = [...PUBLIC_SEGMENTS, SEGMENT_OTHER]

/** 'national'은 전국 공통(region_code='ALL')만. 시·도 slug는 그 지역 + 전국 공통. */
export const REGION_NATIONAL = 'national'

export const BROWSE_STATUSES = [
  { key: 'all', label: '전체' },
  { key: 'always', label: '상시 신청' },
  { key: 'period', label: '기간 접수 중' },
  { key: 'soon', label: '2주 안 마감' },
] as const
export type BrowseStatus = (typeof BROWSE_STATUSES)[number]['key']

export const BROWSE_SORTS = [
  { key: 'deadline', label: '마감 임박순' },
  { key: 'recent', label: '최근 갱신순' },
  // created_at은 처음 들어온 날이다. 원문 문구만 고쳐도 바뀌는 갱신순과 달리 새 사업만 앞에 온다.
  { key: 'new', label: '새로 등록순' },
] as const
export type BrowseSort = (typeof BROWSE_SORTS)[number]['key']

/** '2주 안 마감'의 폭. 홈의 "마감 임박 (2주 이내)" 섹션과 같은 값이다. */
export const SOON_DAYS = 14

export interface BrowseInput {
  /** 세그먼트의 URL path(youth·parenting·small-biz·other). 없으면 전체. */
  seg: string | null
  region: string | null
  status: BrowseStatus
  sort: BrowseSort
  /** 해설이 발행된 사업만 */
  explained: boolean
  q: string
  page: number
}

export const BROWSE_DEFAULTS: BrowseInput = { seg: null, region: null, status: 'all', sort: 'deadline', explained: false, q: '', page: 1 }

/** 이 페이지가 해석하는 쿼리 키. 나머지(utm 등)는 필터가 아니다. */
export const BROWSE_KEYS = new Set(['seg', 'region', 'status', 'sort', 'explained', 'q', 'page'])

type RawParams = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

const SEG_PATHS = new Set(BROWSE_SEGMENTS.map((s) => s.path))
const REGION_SLUGS = new Set([REGION_NATIONAL, ...REGIONS.map((r) => r.slug)])
const STATUS_KEYS = new Set<string>(BROWSE_STATUSES.map((s) => s.key))
const SORT_KEYS = new Set<string>(BROWSE_SORTS.map((s) => s.key))

/** 페이지 상한. 20건씩이라 1만 건을 넘는 번호는 존재하지 않는 페이지다. */
const PAGE_MAX = 600

export function parseBrowseParams(sp: RawParams): BrowseInput {
  const seg = first(sp.seg)
  const region = first(sp.region)
  const status = first(sp.status)
  const sort = first(sp.sort)
  const page = Number(first(sp.page))
  return {
    seg: seg && SEG_PATHS.has(seg) ? seg : null,
    region: region && REGION_SLUGS.has(region) ? region : null,
    status: status && STATUS_KEYS.has(status) ? (status as BrowseStatus) : 'all',
    sort: sort && SORT_KEYS.has(sort) ? (sort as BrowseSort) : 'deadline',
    explained: first(sp.explained) === '1',
    q: normalizeQuery(first(sp.q)),
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, PAGE_MAX) : 1,
  }
}

/** 기본값과 같은 항목은 주소에서 뺀다. 같은 목록이 서로 다른 주소를 갖지 않게 한다. */
export function browseHref(input: BrowseInput, patch: Partial<BrowseInput> = {}): string {
  const v = { ...input, ...patch }
  const sp = new URLSearchParams()
  if (v.seg) sp.set('seg', v.seg)
  if (v.region) sp.set('region', v.region)
  if (v.status !== 'all') sp.set('status', v.status)
  if (v.sort !== 'deadline') sp.set('sort', v.sort)
  if (v.explained) sp.set('explained', '1')
  if (v.q) sp.set('q', v.q)
  if (v.page > 1) sp.set('page', String(v.page))
  const s = sp.toString()
  return s ? `/benefits?${s}` : '/benefits'
}

/** 기본 목록(아무 필터도 없는 1페이지)인지. 색인·canonical 판단에 쓴다. */
export function isDefaultBrowse(input: BrowseInput): boolean {
  return browseHref(input) === '/benefits'
}

export function segmentSlugOf(path: string | null): Segment | null {
  return path ? (SEGMENT_BY_PATH[path]?.slug ?? null) : null
}

/** region_code 열에 거는 값. 이 열은 행정코드가 아니라 시·도 slug('seoul')와 'ALL'을 담는다. national·미지정은 null. */
export function regionFilterOf(slug: string | null): string | null {
  if (!slug || slug === REGION_NATIONAL) return null
  return REGION_SLUGS.has(slug) ? slug : null
}
