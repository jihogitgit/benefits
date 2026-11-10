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
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}

/**
 * 원천 URL을 링크로 내보내도 되는 http(s) 주소로. detail_url은 상세 페이지의 <a href>가 되므로
 * javascript:·data: 같은 스킴은 버린다(null). 'www.x.kr'처럼 스킴 없이 호스트만 오면 https://를 붙인다.
 */
export function safeHttpUrl(v: string | null | undefined): string | null {
  const t = v?.trim()
  if (!t) return null
  const withScheme = !t.includes('://') && /^[\w.-]+\.[a-z]{2,}/i.test(t) ? `https://${t}` : t
  try {
    const u = new URL(withScheme)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

const ORDERED = REGIONS.flatMap((r) => r.keywords.map((kw) => ({ kw, slug: r.slug }))).sort((a, b) => b.kw.length - a.kw.length)

/**
 * 청약홈 시도명은 '광주'처럼 짧다. regions.ts는 보조금24의 '광주시'(경기 광주시) 혼동 때문에 맨 '광주'를 키워드에서 뺐으므로,
 * 공고 쪽에서만 첫 토큰이 정확히 일치할 때 먼저 푼다. '경기도 광주시'는 첫 토큰이 '경기도'라 여기 걸리지 않는다.
 */
const HOUSING_EXACT: Record<string, string> = { 광주: 'gwangju' }

/** 시도명 → REGIONS slug. '전국'은 ALL, 못 맞추면 UNKNOWN(ALL과 구별). 긴 키워드부터 본다. */
export function mapHousingRegion(name: string | null | undefined): string {
  if (!name) return HOUSING_REGION_UNKNOWN
  const head = name.trim().split(/\s+/)[0]
  if (head === '전국') return REGION_ALL
  if (Object.hasOwn(HOUSING_EXACT, head)) return HOUSING_EXACT[head]
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

/** HOUSE_SECD '10'이 신혼희망타운(실측). 이름으로도 한 번 더 본다. */
export function aptKind(item: Pick<AptDetailItem, 'HOUSE_SECD' | 'HOUSE_DTL_SECD_NM' | 'HOUSE_NM'>): HousingKind {
  const name = `${item.HOUSE_DTL_SECD_NM ?? ''} ${item.HOUSE_NM ?? ''}`
  return item.HOUSE_SECD === '10' || name.includes('신혼희망타운') ? 'newlywed_town' : 'apt'
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
    .map((r) => {
      const area = num(r.SUPLY_AR)
      return {
        house_type: r.HOUSE_TY as string,
        supply_area: area == null ? null : Math.round(area * 100) / 100, // numeric(7,2)
        max_price_manwon: num(r.LTTOT_TOP_AMOUNT),
        general_units: num(r.SUPLY_HSHLDCO),
        special_units: num(r.SPSPLY_HSHLDCO),
        sp_newlywed: num(r.NWWDS_HSHLDCO),
        sp_first_life: num(r.LFE_FRST_HSHLDCO),
        sp_multi_child: num(r.MNYCH_HSHLDCO),
        sp_old_parents: num(r.OLD_PARNTS_SUPORT_HSHLDCO),
        sp_institution: num(r.INSTT_RECOMEND_HSHLDCO),
        sp_etc: num(r.ETC_HSHLDCO),
      }
    })
}

export function aggregateUnits(units: HousingUnitTypeInput[]): Pick<HousingNoticeRow, 'sp_newlywed_units' | 'sp_first_life_units' | 'sp_multi_child_units'> {
  const sum = (pick: (u: HousingUnitTypeInput) => number | null) => units.reduce((a, u) => a + (pick(u) ?? 0), 0)
  return { sp_newlywed_units: sum((u) => u.sp_newlywed), sp_first_life_units: sum((u) => u.sp_first_life), sp_multi_child_units: sum((u) => u.sp_multi_child) }
}

// 문자열 정렬이 안전한 이유: 입력이 모두 toIsoDate가 만든 ISO(YYYY-MM-DD)다.
const minDate = (...ds: (string | null)[]): string | null => ds.filter((d): d is string => !!d).sort()[0] ?? null
const maxDate = (...ds: (string | null)[]): string | null => ds.filter((d): d is string => !!d).sort().at(-1) ?? null

// 해시는 상세 항목만 덮는다. 주택형(MdlItem)만 고쳐진 경우는 감지하지 않는다(설계 4절: 주택형은 바뀐 공고만 받는다).
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
    detail_url: safeHttpUrl(item.PBLANC_URL) ?? safeHttpUrl(item.HMPG_ADRES),
    raw: item,
    content_hash: contentHash(item),
    synced_at: now.toISOString(),
  }
}

export function normalizeApt(item: AptDetailItem, units: HousingUnitTypeInput[], slug: string, now: Date): HousingNoticeRow {
  const special_start = toIsoDate(item.SPSPLY_RCEPT_BGNDE)
  const special_end = toIsoDate(item.SPSPLY_RCEPT_ENDDE)
  const rank1_start = minDate(toIsoDate(item.GNRL_RNK1_CRSPAREA_RCPTDE), toIsoDate(item.GNRL_RNK1_ETC_GG_RCPTDE), toIsoDate(item.GNRL_RNK1_ETC_AREA_RCPTDE))
  const rank1_end = maxDate(toIsoDate(item.GNRL_RNK1_CRSPAREA_ENDDE), toIsoDate(item.GNRL_RNK1_ETC_GG_ENDDE), toIsoDate(item.GNRL_RNK1_ETC_AREA_ENDDE))
  const rank2_start = minDate(toIsoDate(item.GNRL_RNK2_CRSPAREA_RCPTDE), toIsoDate(item.GNRL_RNK2_ETC_GG_RCPTDE), toIsoDate(item.GNRL_RNK2_ETC_AREA_RCPTDE))
  const rank2_end = maxDate(toIsoDate(item.GNRL_RNK2_CRSPAREA_ENDDE), toIsoDate(item.GNRL_RNK2_ETC_GG_ENDDE), toIsoDate(item.GNRL_RNK2_ETC_AREA_ENDDE))
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
    detail_url: safeHttpUrl(item.DTL_URL),
    raw: item,
    content_hash: contentHash(item),
    synced_at: now.toISOString(),
  }
}
