import type { HousingKind, HousingSource } from '@/types/housing'

/**
 * 자격 안내의 단위. 공고 하나하나가 아니라 **유형**이다 — 두 API 어디에도 자격 본문이 없고(공고문 PDF에만 있다),
 * 유형별 공통 기준은 법령·지침으로 정해져 있어 한 번 검수해 여러 공고에 붙일 수 있다.
 *
 * 유형은 원천의 세부 구분(kind_detail)으로 정하고, 매입임대만 제목으로 한 번 더 가른다. 매입임대는
 * 원천이 한 덩어리('매입임대')로 주는데 청년·신혼·일반의 자격이 서로 전혀 달라서다.
 */
export type EligibilityKey =
  | 'national_rent'
  | 'permanent_rent'
  | 'happy_house'
  | 'integrated_rent'
  | 'public_rent_50'
  | 'public_rent_convertible'
  | 'purchase_general'
  | 'purchase_youth'
  | 'purchase_newlywed'
  | 'purchase_multichild'
  | 'purchase_senior'
  | 'purchase_dundun'
  | 'purchase_reit'
  | 'purchase_overview'
  | 'jeonse_rent'
  | 'landlord_rent'
  | 'public_sale'
  | 'lh_sale_leftover'
  | 'newlywed_town_sale'
  | 'newlywed_town_rent'
  | 'private_sale'
  | 'remainder'
  | 'resupply'
  | 'officetel'
  | 'urban_house'
  | 'private_rent'

export interface EligibilityInput {
  source: HousingSource
  kind: HousingKind
  kind_detail: string | null
  title: string
}

export interface EligibilityMatch {
  key: EligibilityKey
  /**
   * 제목이 자격 완화를 알린다(입주자격완화·상시모집·선착순). 유형의 공통 기준보다 느슨하게 받는 공고라
   * 공통 기준을 그대로 보여주면 "나는 안 된다"고 잘못 읽힌다. 화면이 이 표시를 먼저 보여준다.
   */
  relaxed: boolean
}

const compact = (s: string) => s.replace(/\s+/g, '')

/**
 * 매입임대 제목 분류(실제 제목 246건으로 맞췄다, 2026-11-11). 순서가 뜻이다.
 * - 입주자가 아니라 운영기관을 뽑는 공고는 자격 안내 대상이 아니다(null).
 * - 든든전세는 다른 낱말보다 먼저 본다 — 소득·자산을 보지 않는 유형이 있어 다른 매입임대와 기준이 다르다.
 * - '청년신혼부부매입임대리츠'는 청년·신혼이 함께 나오지만 별도 사업이다.
 * - 청년과 신혼이 같이 나오면 한쪽으로 단정하지 않고 개관으로 보낸다.
 * - 수식어가 없으면("매입임대주택 예비입주자 모집") 여러 유형을 함께 뽑는 공고일 수 있어 개관으로 보낸다.
 */
function purchaseKey(title: string): EligibilityKey | null {
  const t = compact(title)
  if (/운영기관|공동생활가정/.test(t)) return null
  if (t.includes('든든전세')) return 'purchase_dundun'
  if (t.includes('리츠')) return 'purchase_reit'
  const newlywed = /신혼|신생아/.test(t)
  const youth = /청년|대학생/.test(t)
  if (newlywed && youth) return 'purchase_overview'
  if (newlywed) return 'purchase_newlywed'
  if (youth) return 'purchase_youth'
  if (t.includes('다자녀')) return 'purchase_multichild'
  if (t.includes('고령자')) return 'purchase_senior'
  if (/일반|기존주택|다가구/.test(t)) return 'purchase_general'
  return 'purchase_overview'
}

/** '공공임대'는 원천이 50년 임대와 분양전환 임대를 한 이름으로 준다. 기간이 제목에 없으면 단정하지 않는다. */
function publicRentKey(title: string): EligibilityKey | null {
  const t = compact(title)
  if (t.includes('50년')) return 'public_rent_50'
  // 앞에 숫자가 붙은 것은 연도('2026년')나 다른 기간('15년')이다.
  if (/분양전환|(?<!\d)(5|6|10)년/.test(t)) return 'public_rent_convertible'
  return null
}

/**
 * LH '분양주택'의 절반 이상은 정식 입주자모집이 아니라 잔여세대·공가세대 처분이다(선착순·무순위·일반매각).
 * 자격이 공고마다 다르고("유주택자 가능"까지 있다) 공공분양 일반 기준과 맞지 않아 따로 뺀다.
 */
const LH_LEFTOVER = /잔여|선착순|일반매각|무순위|공가세대|미분양|추가입주자/

const LH_BY_DETAIL: Record<string, EligibilityKey> = {
  국민임대: 'national_rent',
  영구임대: 'permanent_rent',
  행복주택: 'happy_house',
  통합공공임대: 'integrated_rent',
  전세임대: 'jeonse_rent',
  집주인임대: 'landlord_rent',
  '공공분양(신혼희망)': 'newlywed_town_sale',
  '행복주택(신혼희망)': 'newlywed_town_rent',
}

const APPLYHOME_ETC_BY_DETAIL: Record<string, EligibilityKey> = {
  오피스텔: 'officetel',
  도시형생활주택: 'urban_house',
  민간임대: 'private_rent',
}

const RELAXED = /자격완화|상시모집|선착순/
const LH_SALE_KEYS: ReadonlySet<EligibilityKey> = new Set(['lh_sale_leftover', 'public_sale', 'newlywed_town_sale'])

function keyOf(n: EligibilityInput): EligibilityKey | null {
  const detail = (n.kind_detail ?? '').trim()
  if (n.source === 'lh') {
    if (detail === '매입임대') return purchaseKey(n.title)
    if (detail === '공공임대' || detail === '6년 공공임대주택') return publicRentKey(detail === '공공임대' ? n.title : `${n.title} 6년`)
    if (detail === '분양주택') return LH_LEFTOVER.test(compact(n.title)) ? 'lh_sale_leftover' : 'public_sale'
    return LH_BY_DETAIL[detail] ?? null
  }
  switch (n.kind) {
    case 'newlywed_town':
      return 'newlywed_town_sale'
    case 'apt':
      if (detail === '민영') return 'private_sale'
      if (detail === '국민') return 'public_sale'
      return null
    case 'apt_remainder':
      if (detail === '무순위') return 'remainder'
      if (detail === '불법행위 재공급') return 'resupply'
      return null
    case 'officetel_etc':
      return APPLYHOME_ETC_BY_DETAIL[detail] ?? null
    default:
      return null
  }
}

/**
 * 공고 → 자격 유형. 모르는 구분이면 null(안내를 붙이지 않는다). 틀린 유형의 자격을 보여주느니 비워 둔다.
 * 가정어린이집은 주택이 아니라 단지 내 어린이집 운영자 모집이라 일부러 null이다.
 */
export function resolveEligibility(n: EligibilityInput): EligibilityMatch | null {
  const key = keyOf(n)
  if (!key) return null
  // LH 임대만 본다. 분양은 잔여세대 유형이 따로 있고(그 자체가 완화 공고), 정식 분양 공고의 '선착순'은 임대의 완화 조항과 근거가 다르다.
  const relaxed = n.source === 'lh' && !LH_SALE_KEYS.has(key) && RELAXED.test(compact(n.title))
  return { key, relaxed }
}
