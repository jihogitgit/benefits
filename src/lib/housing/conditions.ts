/**
 * 청약홈 APT 분양정보의 규제 표시(raw의 *_AT 필드)를 신청자에게 뜻이 있는 말로 바꾼다.
 * 근거 조사: docs/research/2026-11-11-housing-eligibility-sale.md Part B.
 *
 * 무엇을 말하고 무엇을 말하지 않나
 * - 투기과열지구·청약과열지역·분양가상한제·대규모 택지는 법령 조문과 이름이 그대로 대응해 효과를 적는다.
 * - 정비사업·공공주택지구는 그 표시만으로 일반분양 신청자에게 달라지는 조문이 없어 이름만 보여준다.
 * - 수도권 민영 공공주택지구·공공주택 특별법 적용은 표시가 정확히 어떤 조문 요건을 뜻하는지 API 명세에 없다.
 *   단정하지 않고 "해당할 수 있다"고만 적는다.
 * - 전매제한 기간은 수도권 여부·택지 종류에 따라 갈려 표시만으로 한 숫자를 말할 수 없다. 범위로 적는다.
 */
export interface HousingCondition {
  key: string
  label: string
  /** 신청자에게 미치는 영향. 없으면 이름만 보여준다. */
  effects: string[]
}

const yes = (v: unknown) => typeof v === 'string' && v.trim().toUpperCase() === 'Y'

const RANK1_STRICT = '1순위 요건이 까다롭습니다. 청약통장 가입 2년, 세대주, 최근 5년 안에 당첨된 세대원이 없을 것. 민영주택은 2주택 이상 세대가 1순위에서 빠집니다.'

const DEFS: { field: string; key: string; label: string; effects: string[] }[] = [
  {
    field: 'SPECLT_RDN_EARTH_AT',
    key: 'speculation',
    label: '투기과열지구',
    effects: [RANK1_STRICT, '당첨되면 10년 동안 다른 분양주택에 당첨될 수 없습니다.', '전매제한은 수도권 3년, 수도권 밖 1년입니다.'],
  },
  {
    field: 'MDAT_TRGET_AREA_SECD',
    key: 'overheated',
    label: '청약과열지역(조정대상지역)',
    effects: [RANK1_STRICT, '당첨되면 7년 동안 다른 분양주택에 당첨될 수 없습니다.', '전매제한은 수도권 3년, 수도권 밖 1년입니다.'],
  },
  {
    field: 'PARCPRC_ULS_AT',
    key: 'price_cap',
    label: '분양가상한제',
    effects: [
      '당첨되면 10년 동안 다른 분양주택에 당첨될 수 없습니다.',
      '수도권 주택은 거주의무가 있습니다. 입주 가능일부터 3년 안에 들어가 2~5년(분양가가 주변 시세에 견줘 얼마나 싼지, 공공택지인지에 따라 다름)을 살아야 합니다.',
      '전매제한이 있습니다. 공공택지는 수도권 3년, 수도권 밖 1년입니다.',
    ],
  },
  {
    field: 'LRSCL_BLDLND_AT',
    key: 'large_site',
    label: '대규모 택지개발지구',
    effects: ['수도권의 대규모 택지는 지역 우선공급 비율이 정해져 있습니다. 서울·인천은 해당 지역 거주자에게 50%, 경기도는 해당 시·군 거주자 30%와 경기도 거주자 20%를 먼저 공급하고, 나머지를 그 밖의 공급 대상 지역 거주자에게 공급합니다.'],
  },
  { field: 'PUBLIC_HOUSE_SPCLW_APPLC_AT', key: 'public_law', label: '공공주택 특별법 적용', effects: ['소득·자산 기준이 붙는 공공분양 기준이 적용될 수 있습니다.'] },
  { field: 'NPLN_PRVOPR_PUBLIC_HOUSE_AT', key: 'metro_public_private', label: '수도권 민영 공공주택지구', effects: ['2주택 이상 세대가 1순위에서 빠지는 규정에 해당할 수 있습니다.'] },
  { field: 'PUBLIC_HOUSE_EARTH_AT', key: 'public_site', label: '공공주택지구', effects: [] },
  { field: 'IMPRMN_BSNS_AT', key: 'redevelopment', label: '정비사업(재개발·재건축)', effects: [] },
]

/** raw에서 켜진 규제 표시만. 청약홈 APT가 아닌 공고(필드 자체가 없다)는 빈 배열. */
export function extractConditions(raw: unknown): HousingCondition[] {
  if (!raw || typeof raw !== 'object') return []
  const r = raw as Record<string, unknown>
  // 투기과열지구와 청약과열지역이 함께 켜지면 1순위·전매 문장이 똑같이 두 번 나온다. 먼저 나온 것만 남긴다.
  const seen = new Set<string>()
  return DEFS.filter((d) => yes(r[d.field])).map(({ key, label, effects }) => ({
    key,
    label,
    effects: effects.filter((e) => (seen.has(e) ? false : (seen.add(e), true))),
  }))
}

export const CONDITION_SOURCES = [
  { label: '주택공급에 관한 규칙 제27조·제28조·제34조·제54조', url: 'https://www.law.go.kr/법령/주택공급에관한규칙' },
  { label: '주택법 제57조의2·제64조', url: 'https://www.law.go.kr/법령/주택법' },
] as const
