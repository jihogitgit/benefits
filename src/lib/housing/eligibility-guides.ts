import type { EligibilityKey } from '@/lib/housing/eligibility-type'

/**
 * 공고 유형별 공통 자격 안내. 근거 조사: docs/research/2026-11-11-housing-eligibility-{rental,sale}.md
 *
 * 무엇을 싣고 무엇을 안 싣나
 * - 조사 문서에서 VERIFIED(법령 별표·훈령·고시 원문 또는 마이홈·LH 안내 페이지에서 직접 확인)인 내용만 싣는다.
 *   확인 못한 항목은 지어 채우지 않고 "공고문에서 확인"으로 둔다.
 * - 마이홈 안내와 법령이 어긋난 곳은 법령을 따랐다(국민임대 2인 가구 80%, 매입임대 재계약 14회 등).
 * - 확인 범위가 옛 공고 1건뿐인 유형(집주인 임대주택)은 싣지 않았다. 안내가 없으면 화면은 아무것도 붙이지 않는다.
 * - 우선공급·가점의 세부 순위는 담지 않는다. 여기는 "신청해 볼 수 있는가"를 가리는 곳이다.
 *
 * 해마다 고칠 것: 아래 Y(금액)와 URBAN_INCOME_100·MEDIAN_INCOME_100(소득표), ELIGIBILITY_AS_OF.
 * 금액은 통계가 새로 나오면 바뀐다(자산 고시는 산식만 정한다). 비율은 법령이 바뀔 때만 바뀐다.
 */
export const ELIGIBILITY_AS_OF = '2026-11-11'
/** 금액이 적용되는 연도. 화면이 "2026년 적용"이라고 밝힌다. */
export const ELIGIBILITY_YEAR = 2026

/** 2026년 적용 자산 한도. 출처: 마이홈·LH청약플러스 유형별 안내(조사 문서 기본표 2). */
const Y = {
  carLimit: '4,542만원',
  /** 국민임대·통합공공임대·행복주택(신혼부부·고령자 등) */
  assetNational: '3억 4,500만원',
  /** 행복주택 청년 */
  assetYouth: '2억 5,100만원',
  /** 행복주택 대학생 */
  assetStudent: '1억 800만원',
  /** 영구임대·일반 매입임대 */
  assetPermanent: '2억 4,500만원',
  /** 5·10년 분양전환공공임대 — 총자산이 아니라 부동산 */
  realEstateConvertible: '2억 1,550만원',
  /** 6년 분양전환공공임대 — 총자산 */
  assetSixYear: '3억 6,200만원',
} as const

/**
 * 전년도 도시근로자 가구원수별 가구당 월평균소득 100%(원), 2026년 적용. 1~8인.
 * 출처: LH청약플러스 행복주택 입주자격 안내. 8인 초과는 1인마다 959,198원을 더한다.
 */
export const URBAN_INCOME_100 = [3_813_363, 5_866_270, 8_168_429, 8_802_202, 9_326_985, 9_906_263, 10_485_541, 11_064_819] as const

/** 2026년 기준 중위소득 100%(원). 1~8인. 통합공공임대만 이 척도를 쓴다. 출처: 마이홈 통합공공임대 안내. */
export const MEDIAN_INCOME_100 = [2_564_238, 4_199_292, 5_359_036, 6_494_738, 7_556_719, 8_555_952, 9_515_150, 10_474_348] as const

/**
 * 소득 한도 금액. 공공임대의 소득 비율은 1인 가구 +20%p, 2인 가구 +10%p를 더한다
 * (공공주택 특별법 시행규칙 별표 3·4·5·5의2, 매입임대 지침 제14조의3).
 */
export function incomeLimit(base: readonly number[], pct: number, householdSize: number): number {
  const bump = householdSize === 1 ? 20 : householdSize === 2 ? 10 : 0
  return Math.round((base[householdSize - 1] * (pct + bump)) / 100)
}

export interface EligibilityRow {
  label: string
  text: string
}

export interface EligibilitySource {
  label: string
  url: string
}

export interface EligibilityGuide {
  /** 유형 이름. "국민임대 공통 신청 자격"처럼 제목에 쓴다. */
  name: string
  /** 한 줄 요약. 상세 첫머리. */
  summary: string
  rows: EligibilityRow[]
  /** 흔한 오해·주의. */
  notes?: string[]
  /**
   * 소득 금액표. scale은 척도, pcts는 보여줄 비율(3인 이상 기준 비율. 1·2인 가산은 표가 계산한다).
   * 가산 규칙이 다른 유형(분양 등)은 싣지 않는다.
   */
  income?: { scale: 'urban' | 'median'; pcts: number[] }
  sources: EligibilitySource[]
  /** partial: 공식 출처로 확인한 범위가 좁다(옛 공고 1건 등). 화면이 그렇다고 밝힌다. */
  confidence: 'verified' | 'partial'
}

const LAW_RULE_URL = 'https://www.law.go.kr/법령/공공주택특별법시행규칙'
const LAW_PURCHASE: EligibilitySource = { label: '기존주택등 매입임대주택 업무처리지침', url: 'https://www.law.go.kr/행정규칙/기존주택등매입임대주택업무처리지침' }
const MYHOME_PURCHASE: EligibilitySource = { label: '마이홈 매입임대주택 안내', url: 'https://www.myhome.go.kr/hws/portal/cont/selectBuyRentalHouseView.do' }

/** 매입임대 공통 주의. 유형마다 되풀이된다. */
const PURCHASE_EXEMPT = '생계·주거·의료·교육급여 수급 가구, 지원대상 한부모가족, 차상위 가구는 소득·자산 조사를 받지 않습니다.'
const SMALL_HOUSEHOLD_BUMP = '1인·2인 가구는 소득 비율을 각각 20%p·10%p 더 인정합니다.'

const RENTAL: Partial<Record<EligibilityKey, EligibilityGuide>> = {
  national_rent: {
    name: '국민임대',
    summary: '무주택세대구성원이고 소득이 도시근로자 월평균소득의 70% 이하(1인 90%, 2인 80%)면 신청할 수 있습니다.',
    rows: [
      { label: '대상', text: '입주자 모집공고일 현재 무주택세대구성원.' },
      { label: '소득', text: '전용 50㎡ 미만은 50% 이하(1인 70%, 2인 60%)에게 먼저 공급하고 남으면 70% 이하(1인 90%, 2인 80%)까지. 전용 50~60㎡는 70% 이하(1인 90%, 2인 80%). 전용 60㎡ 초과는 100% 이하(1인 120%, 2인 110%).' },
      { label: '자산', text: `총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '전용 50㎡ 미만은 필요 없습니다. 50㎡ 이상은 자격이 아니라 순위에 쓰입니다(1순위 24회 이상 납입, 2순위 6회 이상).' },
      { label: '거주지', text: '자격이 아니라 경쟁할 때 순위입니다. 전용 50㎡ 미만은 해당 시·군·구 거주자가 1순위, 연접 지역이 2순위.' },
      { label: '임대 기간', text: '30년. 2년 단위로 계약합니다.' },
    ],
    notes: ['2023년 3월 28일 이후 태어난 자녀가 있으면 소득 비율을 10%p(2명 이상이면 20%p) 더 인정합니다.'],
    income: { scale: 'urban', pcts: [50, 70, 100] },
    sources: [
      { label: '공공주택 특별법 시행규칙 제15조·별표 4', url: LAW_RULE_URL },
      { label: '마이홈 국민임대주택 안내', url: 'https://www.myhome.go.kr/hws/portal/cont/selectNationalRentalHouseView.do' },
    ],
    confidence: 'verified',
  },

  permanent_rent: {
    name: '영구임대',
    summary: '생계·의료급여 수급자, 지원대상 한부모가족, 장애인, 국가유공자 등 법에서 정한 대상이 먼저입니다. 일반 저소득 가구는 2순위입니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원. 1순위는 생계·의료급여 수급자, 지원대상 한부모가족, 국가유공자·북한이탈주민·장애인·아동복지시설 퇴소자(소득 70% 이하이고 자산 기준 충족), 65세 이상 수급권자·차상위 등.' },
      { label: '2순위', text: '소득 50% 이하(1인 70%, 2인 60%)이고 자산 기준을 충족하는 가구, 소득 100% 이하인 장애인 등.' },
      { label: '자산', text: `총자산 ${Y.assetPermanent} 이하, 자동차 ${Y.carLimit} 이하. 수급자처럼 소득·자산 요건이 붙지 않는 자격에는 적용하지 않습니다.` },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
      { label: '신청', text: '거주지 행정복지센터에 신청하고, 시·도지사가 입주자를 선정해 LH에 통보합니다.' },
      { label: '임대 기간', text: '50년. 2년 단위로 계약합니다.' },
    ],
    income: { scale: 'urban', pcts: [50, 70, 100] },
    sources: [
      { label: '공공주택 특별법 시행규칙 제14조·별표 3', url: LAW_RULE_URL },
      { label: '마이홈 영구임대주택 안내', url: 'https://www.myhome.go.kr/hws/portal/cont/selectPermanentRHView.do' },
    ],
    confidence: 'verified',
  },

  happy_house: {
    name: '행복주택',
    summary: '대학생·청년·신혼부부·한부모·고령자·주거급여 수급자 가운데 한 계층에 해당해야 합니다. 소득은 대체로 도시근로자 월평균소득 100% 이하(1인 120%, 2인 110%)입니다.',
    rows: [
      { label: '대학생', text: `무주택자이고 혼인 중이 아닐 것. 재학 중이거나 다음 학기 입·복학 예정, 또는 졸업·중퇴 후 2년 이내. 본인과 부모 소득 합계 100% 이하(1인 120%, 2인 110%). 본인 총자산 ${Y.assetStudent} 이하, 자동차는 없어야 합니다. 최대 10년.` },
      { label: '청년', text: `무주택자이고 혼인 중이 아닐 것. 19~39세이거나 소득 있는 일을 한 기간이 5년 이내. 소득 100% 이하(1인 120%, 2인 110%). 총자산 ${Y.assetYouth} 이하, 자동차 ${Y.carLimit} 이하. 최대 10년.` },
      { label: '신혼부부·한부모', text: `무주택세대구성원. 혼인 7년 이내이거나 6세 이하 자녀가 있는 부부, 예비신혼부부, 6세 이하 자녀를 둔 한부모. 소득 100% 이하(맞벌이 120%). 2인 가구는 110%(맞벌이 130%). 총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하. 자녀가 없으면 최대 10년, 있으면 14년.` },
      { label: '고령자', text: `무주택세대구성원인 65세 이상. 소득 100% 이하(1인 120%, 2인 110%). 총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하. 최대 20년.` },
      { label: '주거급여 수급자', text: '무주택세대구성원인 주거급여 수급자. 별도 소득 요건이 없습니다. 최대 20년.' },
      { label: '청약통장', text: '청년과 신혼부부·한부모는 입주 전까지 가입한 사실을 증명해야 합니다(납입 횟수는 무관). 대학생·고령자·주거급여 수급자는 필요 없습니다.' },
      { label: '거주지', text: '자격이 아니라 순위입니다. 거주지나 직장·학교가 해당 지역 또는 연접 지역이면 1순위.' },
    ],
    notes: [
      '청년 나이는 19~39세입니다. 통합공공임대의 청년(18~39세)과 다릅니다.',
      '입주 후 다른 계층 자격을 갖추면 새로 계약할 수 있고, 그때부터 새 계층의 최대 거주 기간이 적용됩니다.',
    ],
    income: { scale: 'urban', pcts: [100] },
    sources: [
      { label: '공공주택 특별법 시행규칙 제17조·별표 5', url: LAW_RULE_URL },
      { label: 'LH청약플러스 행복주택 입주자격', url: 'https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?mi=1201663&cntntsId=1201391' },
    ],
    confidence: 'verified',
  },

  integrated_rent: {
    name: '통합공공임대',
    summary: '무주택세대구성원이고 소득이 기준 중위소득 150% 이하(1인 170%, 2인 160%)면 신청할 수 있습니다. 다른 임대와 달리 기준 중위소득으로 잽니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원. 청년(18~39세, 혼인 중 아님)은 본인만 무주택이면 됩니다.' },
      { label: '소득', text: '기준 중위소득 150% 이하(1인 170%, 2인 160%). 신혼부부·한부모는 맞벌이면 180%(2인 가구 190%)까지.' },
      { label: '우선공급', text: '공급 주택의 60% 범위에서 기준 중위소득 100% 이하 가구 등에게 먼저 공급합니다.' },
      { label: '자산', text: `총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '일반공급 자격 요건이 아닙니다.' },
      { label: '거주 기간', text: '자격을 유지하면 30년. 그 뒤에도 임대료를 더 내고 계속 살 수 있습니다.' },
    ],
    notes: ['소득 기준이 "도시근로자 월평균소득"이 아니라 "기준 중위소득"입니다. 같은 150%라도 금액이 다릅니다.'],
    income: { scale: 'median', pcts: [100, 150] },
    sources: [
      { label: '공공주택 특별법 시행규칙 제17조의2·별표 5의2', url: LAW_RULE_URL },
      { label: '마이홈 통합공공임대주택 안내', url: 'https://www.myhome.go.kr/hws/portal/cont/selectIntegratedPubRentalHouseView.do' },
    ],
    confidence: 'verified',
  },

  public_rent_convertible: {
    name: '분양전환 공공임대(5·6·10년)',
    summary: '무주택세대구성원이고 청약통장이 있어야 합니다. 임대의무기간이 끝나면 살던 집을 분양받을 수 있습니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원. 전용 85㎡ 이하는 해당 주택건설지역 거주자.' },
      { label: '청약통장', text: '필요합니다. 1순위는 수도권 가입 1년·12회 납입, 수도권 밖 6개월·6회 납입.' },
      { label: '소득(5·10년형)', text: '전용 60㎡ 이하만 봅니다. 100% 이하(맞벌이 200%). 1인 120%, 2인 110%.' },
      { label: '자산(5·10년형)', text: `부동산 ${Y.realEstateConvertible} 이하, 자동차 ${Y.carLimit} 이하. 총자산이 아니라 부동산 기준입니다.` },
      { label: '6년형', text: `면적과 관계없이 소득 100% 이하(맞벌이 200%). 1인 120%, 2인 110%. 총자산 ${Y.assetSixYear} 이하. 청년 특별공급(19~39세, 혼인 중 아님, 주택을 가진 적 없음)이 따로 있습니다.` },
    ],
    notes: ['자산 요건은 최초 입주자 모집 때만 봅니다.', '몇 년형인지에 따라 기준이 다릅니다. 공고 제목과 공고문에서 임대의무기간을 확인하세요.'],
    sources: [
      { label: '공공주택 특별법 시행규칙 제19조·별표 6·별표 6의2', url: LAW_RULE_URL },
      { label: 'LH청약플러스 공공임대 입주자격', url: 'https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?mi=1224&cntntsId=1111' },
    ],
    confidence: 'verified',
  },

  public_rent_50: {
    name: '50년 공공임대',
    summary: '해당 지역 무주택세대구성원이고 청약통장이 있어야 합니다. 새로 짓지 않는 유형이라 예비입주자로만 뽑습니다.',
    rows: [
      { label: '대상', text: '주택건설지역에 사는 무주택세대구성원.' },
      { label: '청약통장', text: '필요합니다. 일정 횟수 이상 납입한 가입자가 1순위입니다.' },
      { label: '소득·자산', text: '공통 기준을 공식 자료에서 확인하지 못했습니다. 공고문에서 확인하세요.' },
      { label: '임대 기간', text: '분양전환 없이 50년. 자격을 유지하면 2년 단위로 갱신합니다.' },
    ],
    sources: [{ label: '마이홈 5·10·50년 공공임대주택 안내', url: 'https://www.myhome.go.kr/hws/portal/cont/selectPubRentalHouseView.do' }],
    confidence: 'partial',
  },

  purchase_general: {
    name: '일반 매입임대',
    summary: '생계·의료급여 수급자, 지원대상 한부모가족, 장애인 등이 1순위이고, 소득 50% 이하 가구가 2순위입니다.',
    rows: [
      { label: '대상', text: '사업 대상 지역에 사는 무주택세대구성원.' },
      { label: '1순위', text: '생계·의료급여 수급자, 지원대상 한부모가족, 수급권자·차상위 중 주거 여건이 열악한 가구 또는 고령자, 소득 70% 이하(1인 90%, 2인 80%)이고 자산 기준을 충족하는 장애인.' },
      { label: '2순위', text: '소득 50% 이하(1인 70%, 2인 60%)이고 자산 기준을 충족하는 가구, 소득 100% 이하인 장애인.' },
      { label: '자산', text: `총자산 ${Y.assetPermanent} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
      { label: '거주 기간', text: '2년 단위 계약, 재계약 14회까지. 65세 이상이거나 1순위 요건을 유지하면 횟수 제한이 없습니다.' },
    ],
    notes: [PURCHASE_EXEMPT],
    income: { scale: 'urban', pcts: [50, 70] },
    sources: [{ label: `${LAW_PURCHASE.label} 제9조·제17조`, url: LAW_PURCHASE.url }, MYHOME_PURCHASE],
    confidence: 'verified',
  },

  purchase_youth: {
    name: '청년 매입임대',
    summary: '무주택 미혼 청년(대학생, 졸업 2년 이내 미취업자, 19~39세)이 대상입니다. 본인 소득이 100% 이하(1인 가구 120%)면 3순위로 신청할 수 있습니다.',
    rows: [
      { label: '대상', text: '무주택자인 미혼 청년. 대학생, 졸업·중퇴 후 2년 이내 미취업자, 19~39세.' },
      { label: '1순위', text: '생계·주거·의료급여 수급 가구, 지원대상 한부모가족, 차상위 가구의 청년.' },
      { label: '2순위', text: `본인과 부모의 소득 합계 100% 이하. 본인과 부모의 총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '3순위', text: `본인 소득 100% 이하(1인 가구 120%). 본인 총자산 ${Y.assetYouth} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
      { label: '거주 기간', text: '2년 단위 계약, 최장 10년. 입주 후 혼인하면 더 살 수 있습니다.' },
    ],
    income: { scale: 'urban', pcts: [100] },
    sources: [{ label: `${LAW_PURCHASE.label} 제10조·제18조`, url: LAW_PURCHASE.url }, MYHOME_PURCHASE],
    confidence: 'verified',
  },

  purchase_newlywed: {
    name: '신혼·신생아 매입임대',
    summary: '무주택 신혼부부, 예비신혼부부, 6세 이하 자녀를 둔 가구, 최근 2년 안에 출산한 가구가 대상입니다. Ⅰ유형과 Ⅱ유형의 소득 기준이 크게 다릅니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원. 혼인 7년 이내 신혼부부, 예비신혼부부, 6세 이하 자녀를 둔 한부모·혼인 가구, 신생아 가구(최근 2년 내 출산·임신·입양). 신생아 가구와 지원대상 한부모가족이 1순위입니다.' },
      { label: 'Ⅰ유형 소득·자산', text: `소득 70% 이하(맞벌이 90%). 총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하. 최장 20년.` },
      { label: 'Ⅱ유형 소득·자산', text: `소득 130% 이하(맞벌이 200%). 총자산 ${Y.assetSixYear} 이하. 최장 10년, 자녀가 있으면 14년.` },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
    ],
    notes: [SMALL_HOUSEHOLD_BUMP, '공고 제목의 Ⅰ·Ⅱ(전세형)를 먼저 확인하세요. 두 유형은 소득 기준과 거주 기간이 다릅니다.', PURCHASE_EXEMPT],
    income: { scale: 'urban', pcts: [70, 130] },
    sources: [{ label: `${LAW_PURCHASE.label} 제11조·제12조·제19조·제20조`, url: LAW_PURCHASE.url }, MYHOME_PURCHASE],
    confidence: 'verified',
  },

  purchase_multichild: {
    name: '다자녀 매입임대',
    summary: '미성년 자녀가 2명 이상(태아 포함)인 무주택 가구가 대상이고, 소득이 70% 이하여야 합니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원인 다자녀 가구. 미성년 자녀 2명 이상, 태아 포함.' },
      { label: '순위', text: '수급자·차상위·지원대상 한부모가족이 먼저이고, 그중에서도 신생아 가구가 1순위입니다. 그 밖의 가구는 3순위.' },
      { label: '소득', text: '70% 이하.' },
      { label: '자산', text: `총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
      { label: '거주 기간', text: '2년 단위 계약, 최장 20년.' },
    ],
    notes: [PURCHASE_EXEMPT],
    income: { scale: 'urban', pcts: [70] },
    sources: [{ label: `${LAW_PURCHASE.label} 제14조의2·제22조의2`, url: LAW_PURCHASE.url }, MYHOME_PURCHASE],
    confidence: 'verified',
  },

  purchase_senior: {
    name: '고령자 매입임대',
    summary: '사업 대상 지역에 사는 65세 이상 무주택세대구성원이 대상입니다. 순위와 소득·자산 기준은 일반 매입임대와 같습니다.',
    rows: [
      { label: '대상', text: '사업 대상 지역에 사는 무주택세대구성원인 65세 이상.' },
      { label: '1순위', text: '생계·의료급여 수급자, 지원대상 한부모가족, 수급권자·차상위 등.' },
      { label: '2순위', text: '소득 50% 이하(1인 70%, 2인 60%)이고 자산 기준을 충족하는 가구.' },
      { label: '자산', text: `총자산 ${Y.assetPermanent} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
    ],
    notes: [PURCHASE_EXEMPT],
    income: { scale: 'urban', pcts: [50] },
    sources: [{ label: `${LAW_PURCHASE.label} 제14조·제22조`, url: LAW_PURCHASE.url }, MYHOME_PURCHASE],
    confidence: 'verified',
  },

  purchase_dundun: {
    name: '든든전세주택',
    summary: '무주택세대구성원이면 소득·자산과 관계없이 신청할 수 있습니다. 자녀가 많을수록, 신생아가 있을수록 유리합니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원. 모집 권역에 주민등록이 있어야 합니다.' },
      { label: '소득·자산', text: '요건이 없습니다.' },
      { label: '선정', text: '배점으로 뽑습니다. 신생아 가구 2점, 자녀 3명 이상 3점, 2명 2점, 1명 1점. 동점이면 추첨.' },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
      { label: '거주 기간', text: '2년 단위 계약, 최장 8년. 보증금은 시세의 80~90% 수준입니다.' },
    ],
    notes: ['제목에 "분양전환형"이 있으면 6년 뒤 살던 집을 분양받을 기회가 있습니다. 다만 분양 우선권은 입주자 모집 당시 소득 130% 이하(맞벌이 200%)이고 자산 기준을 충족했던 입주자에게 주어집니다.'],
    sources: [
      { label: `${LAW_PURCHASE.label} 제9조의3·제17조의3`, url: LAW_PURCHASE.url },
      { label: 'LH 든든전세주택 안내', url: 'https://www.lh.or.kr/menu.es?mid=a10401040400' },
    ],
    confidence: 'verified',
  },

  purchase_reit: {
    name: '청년·신혼부부 매입임대리츠',
    summary: '무주택 신혼부부·예비신혼부부·6세 이하 자녀 한부모가 1순위, 청년이 2순위입니다. 소득은 100% 이하(맞벌이 120%)입니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원. 1순위 신혼부부·예비신혼부부·6세 이하 자녀를 둔 한부모, 2순위 청년, 3순위 6세 이하 자녀를 둔 혼인 가구.' },
      { label: '소득', text: '100% 이하(맞벌이 120%).' },
      { label: '자산', text: `부동산 ${Y.realEstateConvertible} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '자격 요건이 아닙니다.' },
      { label: '거주 기간', text: '2년 단위 계약, 최장 10년.' },
    ],
    notes: [SMALL_HOUSEHOLD_BUMP],
    income: { scale: 'urban', pcts: [100] },
    sources: [{ label: `${LAW_PURCHASE.label} 제13조·제21조`, url: LAW_PURCHASE.url }],
    confidence: 'verified',
  },

  purchase_overview: {
    name: '매입임대',
    summary: '매입임대는 대상에 따라 유형이 나뉘고 자격이 서로 다릅니다. 이 공고가 어느 유형을 뽑는지 공고문에서 먼저 확인하세요.',
    rows: [
      { label: '일반', text: `수급자·한부모·장애인 등이 1순위, 소득 50% 이하 가구가 2순위. 총자산 ${Y.assetPermanent} 이하.` },
      { label: '청년', text: '무주택 미혼 청년(19~39세, 대학생 등). 본인 소득 100% 이하면 3순위.' },
      { label: '신혼·신생아', text: 'Ⅰ유형 소득 70% 이하(맞벌이 90%), Ⅱ유형 130% 이하(맞벌이 200%).' },
      { label: '다자녀', text: '미성년 자녀 2명 이상, 소득 70% 이하.' },
      { label: '고령자', text: '65세 이상. 기준은 일반 유형과 같습니다.' },
      { label: '든든전세', text: '무주택이면 소득·자산과 관계없이 신청.' },
      { label: '청약통장', text: '어느 유형도 자격 요건이 아닙니다.' },
    ],
    notes: ['모든 유형이 무주택이어야 합니다.', SMALL_HOUSEHOLD_BUMP, PURCHASE_EXEMPT],
    income: { scale: 'urban', pcts: [50, 70, 100] },
    sources: [LAW_PURCHASE, MYHOME_PURCHASE],
    confidence: 'verified',
  },

  jeonse_rent: {
    name: '전세임대',
    summary: '입주자가 고른 집을 LH가 전세로 빌려 다시 임대하는 제도입니다. 일반 유형은 수급자·한부모·장애인 등이 1순위, 소득 50% 이하 가구가 2순위입니다.',
    rows: [
      { label: '대상', text: '사업 대상 지역에 사는 무주택세대구성원.' },
      { label: '일반 1순위', text: '생계·의료급여 수급자, 보호대상 한부모가족, 소득 70% 이하 장애인, 수급권자·차상위 고령자 등.' },
      { label: '일반 2순위', text: `소득 50% 이하이고 총자산 ${Y.assetPermanent} 이하, 자동차 ${Y.carLimit} 이하인 가구.` },
      { label: '청년', text: '무주택 대학생·취업준비생·19~39세. 본인 소득 100% 이하면 3순위.' },
      { label: '신혼·신생아', text: 'Ⅰ유형 소득 70% 이하(맞벌이 90%), Ⅱ유형 100% 이하(맞벌이 120%).' },
    ],
    notes: ['전세금 지원 한도는 해마다 바뀝니다. 공고문에서 확인하세요.'],
    income: { scale: 'urban', pcts: [50, 70, 100] },
    sources: [
      { label: '마이홈 전세임대주택 안내', url: 'https://www.myhome.go.kr/hws/portal/cont/selectCharterRentalHouseView.do' },
      { label: '공공주택 특별법 시행규칙 제21조', url: LAW_RULE_URL },
    ],
    confidence: 'verified',
  },
}

/** 임대 공고가 "자격완화·상시모집·선착순"일 때 붙이는 설명. 근거: 시행규칙 제14조③·제15조②·제17조③·제17조의2②, 매입임대 지침 제14조의3. */
export const RELAXED_NOTICE =
  '이 공고는 제목에 자격 완화·상시모집·선착순이 들어 있습니다. 입주자를 뽑고도 남은 주택은 법령에 따라 자격을 일부 완화하거나 선착순으로 공급할 수 있습니다. 무엇을 얼마나 완화하는지는 공고마다 다르니, 아래 공통 기준에 맞지 않더라도 공고문을 확인해 보세요.'

const LAW_SUPPLY_URL = 'https://www.law.go.kr/법령/주택공급에관한규칙'
const APPLYHOME_QUALF: EligibilitySource = { label: '청약홈 청약자격 안내', url: 'https://www.applyhome.co.kr/ar/ara/selectSubscrptIntroQualfView.do' }
const APPLYHOME_REMNDR: EligibilitySource = { label: '청약홈 무순위·잔여세대 안내', url: 'https://www.applyhome.co.kr/ar/ara/selectSubscrptIntroRemndrHshldView.do' }
const APPLYHOME_ETC: EligibilitySource = { label: '청약홈 오피스텔·도시형·민간임대 안내', url: 'https://www.applyhome.co.kr/ar/arb/selectPROUSubscriptionHouseInfoView.do' }

/** 신혼희망타운 2026년 공급 지구 적용액. 출처: LH청약플러스 신혼희망타운 분양가이드, LH 홈페이지. */
const NT = {
  asset: '3억 6,200만원',
  income130: '3인 이하 월 979만원, 4인 월 1,144만원',
  income200: '3인 이하 월 1,506만원, 4인 월 1,760만원',
} as const

/**
 * 분양 유형. 소득 금액표는 싣지 않는다 — 분양은 가구원 구분("3인 이하")이 임대와 달라 같은 표를 쓰면 틀린다.
 * 민영 특별공급의 자산(부동산가액) 금액과 공공분양 자산 금액은 2026년 적용액을 공식 자료로 확인하지 못해 싣지 않았다.
 */
const SALE: Partial<Record<EligibilityKey, EligibilityGuide>> = {
  private_sale: {
    name: '민영주택 분양',
    summary: '청약통장(주택청약종합저축)이 있어야 합니다. 1순위는 가입 기간과 지역별 예치금을 채워야 하고, 유주택자도 일반공급에는 신청할 수 있습니다.',
    rows: [
      { label: '대상', text: '입주자 모집공고일 현재 해당 지역(같은 광역권 포함)에 사는 성년자. 일반공급은 무주택이 아니어도 신청할 수 있지만 1주택 세대는 가점제에서 빠지고 추첨으로만 참여합니다.' },
      { label: '1순위', text: '수도권은 통장 가입 1년, 수도권 밖은 6개월이 지나고 지역별 예치금을 채운 사람. 지자체가 수도권 2년, 수도권 밖 1년까지 늘릴 수 있습니다.' },
      { label: '예치금', text: '거주지 기준. 전용 85㎡ 이하는 서울·부산 300만원, 그 밖의 광역시 250만원, 나머지 지역 200만원. 모든 면적은 각각 1,500만원, 1,000만원, 500만원.' },
      { label: '규제지역 1순위', text: '투기과열지구·청약과열지역은 가입 2년, 세대주, 최근 5년 안에 당첨된 세대원이 없을 것, 2주택 이상 세대가 아닐 것을 모두 채워야 합니다.' },
      { label: '2순위', text: '1순위가 아닌 통장 가입자. 경쟁하면 추첨합니다.' },
      { label: '선정', text: '전용 85㎡ 이하는 가점제와 추첨제를 섞습니다. 가점은 무주택 기간 32점, 부양가족 35점, 통장 가입 기간 17점으로 84점 만점입니다.' },
      { label: '특별공급', text: '무주택세대구성원만 신청합니다. 신혼부부(혼인 7년 이내, 소득 140%·맞벌이 160% 이하), 생애최초(세대 전원이 집을 가진 적 없음, 소득세 5년 납부, 소득 160% 이하), 신생아(2세 미만 자녀, 소득 160% 이하), 다자녀(미성년 자녀 2명 이상), 노부모부양(65세 이상 직계존속 3년 부양, 세대주), 기관추천이 있습니다.' },
    ],
    notes: [
      '신혼부부·생애최초·신생아 특별공급은 소득이 기준을 넘어도 부동산 가액 기준을 채우면 신청할 수 있습니다.',
      '특별공급은 세대당 평생 1회입니다. 다만 2024년 6월 19일 이후 태어난 자녀가 있으면 한 번 더 신청할 수 있습니다.',
      '배우자가 혼인 전에 당첨됐거나 집을 가졌던 이력은 신혼부부·생애최초·신생아 특별공급에서 따지지 않습니다.',
    ],
    sources: [{ label: '주택공급에 관한 규칙 제28조·제35조의3·제40조·제41조·제43조·제46조·별표 1·별표 2', url: LAW_SUPPLY_URL }, APPLYHOME_QUALF],
    confidence: 'verified',
  },

  public_sale: {
    name: '공공분양(국민주택)',
    summary: '무주택세대구성원이고 청약통장이 있어야 합니다. 민영과 달리 납입 횟수와 저축 총액으로 순위를 가리고, 소득·자산 기준이 붙습니다.',
    rows: [
      { label: '대상', text: '해당 지역에 사는 성년자인 무주택세대구성원. 공고일부터 입주할 때까지 무주택을 유지해야 합니다.' },
      { label: '1순위', text: '수도권은 통장 가입 1년·12회 납입, 수도권 밖은 6개월·6회 납입. 투기과열지구·청약과열지역은 2년·24회 납입에 세대주여야 하고 최근 5년 안에 당첨된 세대원이 없어야 합니다.' },
      { label: '선정', text: '1순위끼리 경쟁하면 3년 이상 무주택인 사람 가운데 저축 총액이 많은 순(전용 40㎡ 이하는 납입 횟수가 많은 순). 저축 총액은 월 25만원까지만 인정합니다.' },
      { label: '소득', text: '일반공급은 전용 60㎡ 이하만 봅니다. 100% 이하(부부 모두 소득이 있으면 200%).' },
      { label: '자산', text: '부동산과 자동차 가액 기준이 있습니다. 금액은 해마다 바뀌니 공고문에서 확인하세요.' },
      { label: '2세 미만 자녀', text: '일반공급 물량의 절반을 2세 미만 자녀가 있는 가구에 먼저 공급합니다.' },
      { label: '특별공급', text: '신생아(2세 미만 자녀, 소득 140%·맞벌이 200% 이하), 신혼부부(혼인 7년 이내 또는 6세 이하 자녀, 소득 130%·맞벌이 200% 이하), 생애최초(집을 가진 적 없음, 저축액 600만원 이상, 소득 130%·맞벌이 200% 이하), 다자녀·노부모부양(소득 120%·맞벌이 200% 이하), 기관추천.' },
    ],
    notes: [
      '위 소득·자산·특별공급 기준은 LH 같은 공공주택사업자가 공급하는 공공분양 기준입니다.',
      '2023년 3월 28일 이후 태어난 자녀가 있으면 소득 비율을 10%p(2명 이상이면 20%p) 더 인정합니다.',
      '자산 요건은 최초 입주자 모집 때만 봅니다.',
    ],
    sources: [
      { label: '공공주택 특별법 시행규칙 별표 6', url: LAW_RULE_URL },
      { label: '주택공급에 관한 규칙 제27조·제10조', url: LAW_SUPPLY_URL },
      { label: '마이홈 공공분양 입주자격', url: 'https://www.myhome.go.kr/hws/portal/cont/selectNHTQualificationView.do' },
    ],
    confidence: 'verified',
  },

  lh_sale_leftover: {
    name: 'LH 잔여세대·선착순·일반매각',
    summary: '정식 입주자 모집이 아니라 남은 주택을 처분하는 공고입니다. 자격은 법령이 하나로 정하지 않고 공고마다 다릅니다.',
    rows: [
      { label: '자격', text: '공고가 정합니다. 무주택세대구성원만 받는 공고도 있고 유주택자도 받는 공고도 있습니다. 제목과 공고문에서 확인하세요.' },
      { label: '청약통장', text: '선착순 공급에는 법령상 통장 요건이 없습니다. 공고에서 따로 요구하는지 확인하세요.' },
      { label: '선착순 계약', text: '선착순으로 계약한 사람은 당첨자로 관리하지 않습니다. 재당첨 제한이 붙지 않고, 이후 청약에서 그 분양권을 주택 소유로 보지 않습니다.' },
      { label: '추첨·무순위 방식', text: '추첨으로 뽑는 잔여세대는 당첨자로 관리되고 재당첨 제한이 붙을 수 있습니다.' },
    ],
    notes: ['소득·자산 요건은 원래 최초 입주자 모집 때만 보고, 선착순 공급에서는 완화할 수 있습니다.'],
    sources: [
      { label: '주택공급에 관한 규칙 제2조 제7호·제27조 제5항·제53조', url: LAW_SUPPLY_URL },
      { label: '공공주택 특별법 시행규칙 별표 6', url: LAW_RULE_URL },
    ],
    confidence: 'verified',
  },

  newlywed_town_sale: {
    name: '신혼희망타운(분양)',
    summary: `무주택 신혼부부·예비신혼부부·6세 이하 자녀를 둔 한부모가 대상입니다. 소득 130% 이하(맞벌이 200%), 총자산 ${NT.asset} 이하여야 합니다.`,
    rows: [
      { label: '대상', text: '혼인 7년 이내이거나 6세 이하 자녀(태아 포함)를 둔 신혼부부, 예비신혼부부, 6세 이하 자녀를 둔 한부모가족. 무주택세대구성원이어야 합니다.' },
      { label: '청약통장', text: '가입 6개월이 지나고 6회 이상 납입.' },
      { label: '소득', text: `130% 이하(${NT.income130}). 부부 모두 소득이 있으면 200% 이하(${NT.income200}).` },
      { label: '자산', text: `총자산 ${NT.asset} 이하.` },
      { label: '선정', text: '물량의 30%는 혼인 2년 이내이거나 2세 이하 자녀가 있는 가구, 예비신혼부부에게 먼저 배점으로 공급하고, 60%는 나머지 대상에게 배점으로, 남은 물량은 추첨합니다.' },
      { label: '전용 대출', text: '분양가가 총자산 기준액을 넘는 주택은 입주 때까지 신혼희망타운 전용 주택담보대출(수익공유형)에 가입해야 합니다.' },
    ],
    notes: [
      '예비신혼부부는 혼인 사실을 증명해야 합니다. 시한은 공고문에서 확인하세요.',
      '당첨되면 공공분양 신혼부부 특별공급을 받은 것으로 봅니다.',
      '소득·자산 금액은 2026년 공급 지구에 적용되는 값입니다.',
    ],
    sources: [
      { label: '공공주택 특별법 시행규칙 제19조·별표 6의3', url: LAW_RULE_URL },
      { label: 'LH청약플러스 신혼희망타운 안내', url: 'https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?mi=1243&cntntsId=1132' },
    ],
    confidence: 'verified',
  },

  newlywed_town_rent: {
    name: '신혼희망타운(행복주택)',
    summary: '신혼희망타운 단지 안의 임대주택입니다. 행복주택의 신혼부부·한부모 계층 기준으로 뽑습니다.',
    rows: [
      { label: '대상', text: '무주택세대구성원. 혼인 7년 이내이거나 6세 이하 자녀가 있는 부부, 예비신혼부부, 6세 이하 자녀를 둔 한부모.' },
      { label: '소득', text: '100% 이하(맞벌이 120%). 2인 가구는 110%(맞벌이 130%).' },
      { label: '자산', text: `총자산 ${Y.assetNational} 이하, 자동차 ${Y.carLimit} 이하.` },
      { label: '청약통장', text: '본인이나 배우자가 입주 전까지 가입한 사실을 증명해야 합니다(납입 횟수는 무관).' },
      { label: '거주 기간', text: '자녀가 없으면 최대 10년, 있으면 14년.' },
    ],
    sources: [
      { label: '공공주택 특별법 시행규칙 제19조·별표 5', url: LAW_RULE_URL },
      { label: 'LH청약플러스 행복주택 입주자격', url: 'https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?mi=1201663&cntntsId=1201391' },
    ],
    confidence: 'verified',
  },

  remainder: {
    name: '무순위 청약',
    summary: '국내에 사는 성년자인 무주택세대구성원이면 청약통장 없이 신청할 수 있습니다. 집이 있는 세대는 신청할 수 없습니다.',
    rows: [
      { label: '대상', text: '국내에 사는 성년자인 무주택세대구성원. 세대원 가운데 주택 소유자가 있으면 신청할 수 없습니다.' },
      { label: '거주지', text: '원칙은 전국입니다. 시장·군수·구청장이 해당 지역이나 광역권 거주자로 제한할 수 있으니 공고문에서 확인하세요.' },
      { label: '청약통장', text: '쓰지 않습니다.' },
      { label: '선정', text: '청약홈에서 접수하고 추첨합니다.' },
      { label: '재당첨 제한', text: '투기과열지구·청약과열지역의 무순위 당첨자는 당첨자로 관리되고 재당첨 제한이 붙습니다. 그 밖의 지역은 붙지 않습니다.' },
    ],
    notes: [
      '재당첨 제한 기간 중인 사람은 규제지역 무순위에 신청할 수 없습니다.',
      '같은 주택에 이미 당첨된 사람, 부적격 당첨 제한 중인 사람은 신청할 수 없습니다.',
    ],
    sources: [{ label: '주택공급에 관한 규칙 제19조·제26조', url: LAW_SUPPLY_URL }, APPLYHOME_REMNDR],
    confidence: 'verified',
  },

  resupply: {
    name: '불법행위 재공급(계약취소주택)',
    summary: '불법 전매 등으로 계약이 취소된 주택을 다시 공급합니다. 해당 지역에 사는 무주택 세대주만 신청할 수 있습니다.',
    rows: [
      { label: '대상', text: '입주자 모집공고일 현재 해당 주택건설지역에 사는 세대주인 무주택세대구성원.' },
      { label: '제한', text: '재당첨 제한, 입주자 자격 제한, 부적격 당첨 제한 기간 중이면 신청할 수 없습니다.' },
      { label: '특별공급분', text: '원래 특별공급 물량이었던 주택은 그 특별공급 요건을 갖춘 해당 지역 거주자에게 먼저 추첨합니다.' },
      { label: '청약통장', text: '쓰지 않습니다.' },
      { label: '선정', text: '추첨으로 뽑습니다.' },
      { label: '재당첨 제한', text: '당첨자로 관리합니다. 규제지역이거나 분양가상한제 주택이면 재당첨 제한이 붙습니다.' },
    ],
    sources: [{ label: '주택공급에 관한 규칙 제47조의3', url: LAW_SUPPLY_URL }, APPLYHOME_REMNDR],
    confidence: 'verified',
  },

  officetel: {
    name: '오피스텔 청약',
    summary: '청약통장 없이 만 19세 이상이면 누구나 신청할 수 있습니다. 아파트 청약의 자격·재당첨 제한이 적용되지 않습니다.',
    rows: [
      { label: '대상', text: '만 19세 이상. 세부 자격은 공고가 정합니다.' },
      { label: '청약통장', text: '쓰지 않습니다. 청약신청금을 내고 신청하며, 금액은 공고마다 다릅니다.' },
      { label: '선정', text: '공고의 청약 조건에 따라 추첨합니다. 한 사람이 여러 건에 당첨될 수 있고 당첨자 관리를 하지 않습니다.' },
      { label: '거주자 우선', text: '투기과열지구·조정대상지역에서는 분양분 일부를 해당 지역 거주자에게 먼저 분양합니다.' },
      { label: '주택 수', text: '아파트 청약에서는 오피스텔을 가지고 있어도 주택 소유로 보지 않습니다.' },
    ],
    notes: ['세금에서 오피스텔을 주택 수에 넣는지는 청약 기준과 다릅니다. 여기서는 다루지 않습니다.'],
    sources: [APPLYHOME_ETC, { label: '건축물의 분양에 관한 법률 제6조의2', url: 'https://www.law.go.kr/법령/건축물의분양에관한법률' }],
    confidence: 'verified',
  },

  urban_house: {
    name: '도시형 생활주택 청약',
    summary: '청약통장 없이 만 19세 이상이면 신청할 수 있습니다. 아파트 청약의 순위·재당첨 제한이 적용되지 않습니다.',
    rows: [
      { label: '대상', text: '만 19세 이상. 세부 자격은 공고가 정합니다.' },
      { label: '청약통장', text: '쓰지 않습니다. 청약신청금을 내고 신청하며, 금액은 공고마다 다릅니다.' },
      { label: '선정', text: '추첨. 한 사람이 여러 건에 당첨될 수 있고 당첨자 관리를 하지 않습니다.' },
      { label: '주택 수', text: '오피스텔과 달리 주택입니다. 가지고 있으면 이후 아파트 청약에서 주택 소유로 봅니다. 다만 세대가 한 채만 가지고 있고 전용 85㎡ 이하이면서 가격이 3억원(수도권 5억원) 이하면 무주택으로 보는 예외가 있습니다.' },
    ],
    notes: ['공공임대 입주 자격을 따질 때는 위 무주택 예외를 적용하지 않습니다.'],
    sources: [APPLYHOME_ETC, { label: '주택공급에 관한 규칙 제3조·제53조', url: LAW_SUPPLY_URL }],
    confidence: 'verified',
  },

  private_rent: {
    name: '민간임대 청약',
    summary: '임차인 자격과 선정 방법을 임대사업자가 정합니다. 청약통장은 쓰지 않습니다.',
    rows: [
      { label: '대상', text: '만 19세 이상. 자격은 임대사업자가 정한 기준을 따르니 공고문에서 확인하세요.' },
      { label: '청약통장', text: '쓰지 않습니다.' },
      { label: '공공지원 민간임대', text: '공공지원 민간임대는 따로 정해진 자격 기준이 적용됩니다. 공고문에서 유형을 확인하세요.' },
    ],
    sources: [APPLYHOME_ETC, { label: '민간임대주택에 관한 특별법 제42조', url: 'https://www.law.go.kr/법령/민간임대주택에관한특별법' }],
    confidence: 'verified',
  },
}

export const ELIGIBILITY_GUIDES: Partial<Record<EligibilityKey, EligibilityGuide>> = { ...RENTAL, ...SALE }
