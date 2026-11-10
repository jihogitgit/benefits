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
