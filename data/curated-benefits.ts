import type { ConditionRow, Segment } from '../src/types/database'

export { CURATED_SOURCE, CURATED_STALE_DAYS } from '../src/lib/benefits/curated'

/**
 * 보조금24 API에 없어서 손으로 채운 제도.
 *
 * 왜 필요한가: 부모급여는 0~23개월 아동을 키우는 모든 가구가 받는 최대 월 100만원짜리
 * 현금급여인데, 정부24 서비스(135200000143)가 "삭제 상태"라 보조금24 오픈API
 * serviceList에 나오지 않는다(서비스ID로 직접 조회해도 0건, 같은 방식으로 아동수당
 * 135200000120은 1건). 그 결과 DB에는 충북 보은군이 올린 지자체 레코드 한 건만 있었고,
 * 전국 이용자의 검색·진단에서는 이 제도가 통째로 빠져 있었다.
 *
 * 왜 source를 따로 두는가: 동기화의 markRemoved는 `.eq('source', source)`로 gov24만
 * 훑으므로 CURATED_SOURCE 행은 다음 동기화에서 removed로 뒤집히지 않는다. 출처 표기도
 * 갈라진다 — SourceFooter가 gov24 행에만 "행정안전부 보조금24"를 쓰고, 이 행에는
 * 아래 evidence를 근거로 내건다. 출처가 다른데 같은 문구를 쓰면 그게 거짓말이 된다.
 *
 * 유지보수 부담: 자동 갱신이 안 된다. 금액이 바뀌어도 아무도 손대지 않으면 조용히 낡는다.
 * 그래서 checked_at을 레코드가 직접 들고, 상세 페이지 하단이 오래된 확인일을 스스로
 * 드러내게 했다. 늘리지 마라 — 원천에 생기면 여기서 지우는 것이 정상 경로다.
 */
export interface CuratedBenefit {
  source_id: string
  slug: string
  title: string
  summary: string
  amount_text: string
  target_text: string
  criteria_text: string
  apply_method: string
  apply_url: string
  agency: string
  contact: string
  region_code: string
  segments: Segment[]
  /** 근거 문서의 최종 수정일(원문 표기). ISO 8601 UTC. */
  source_updated_at: string
  /** 사람이 근거 문서를 마지막으로 읽고 대조한 날. YYYY-MM-DD. */
  checked_at: string
  /** 상세 페이지 하단에 내거는 근거. 첫 항목을 대표 링크로 쓴다. */
  evidence: { label: string; url: string }[]
  conditions: Omit<ConditionRow, 'benefit_id'>
}

export const CURATED_BENEFITS: CuratedBenefit[] = [
  {
    source_id: 'mohw-parental-allowance',
    // 슬러그 '부모급여-지원'은 보은군 레코드가 이미 쓴다. 같은 이름을 뺏으면 그쪽 링크가 죽는다.
    slug: '부모급여',
    // 보건복지부 표기가 '부모급여(영아수당) 지급'이다. 괄호를 떼면 '영아수당'으로 검색한
    // 사람이 이 페이지에 닿지 못한다 — 실제로 검색 결과 0건이었다.
    title: '부모급여(영아수당)',
    summary: '0~23개월 아동에게 0세 월 100만원, 1세 월 50만원 현금 지원',
    amount_text: [
      '○ 0세(0~11개월) 월 100만원, 1세(12~23개월) 월 50만원',
      '',
      '○ 어린이집을 이용하면 보육료 바우처를 먼저 받고 남는 금액만 현금으로 받는다(2026년 기준)',
      ' - 0세: 부모급여 100만원 − 영유아 기본보육료 58만 4천원 = 현금 41만 6천원',
      ' - 1세: 부모급여 50만원 − 영유아 기본보육료 51만 5천원 = 현금 없음',
      '',
      '○ 현금 또는 바우처(보육료 또는 종일제 돌봄)로 받는다. 어린이집·종일제 아이돌봄을 이용하면 해당 서비스를 별도로 신청해야 한다.',
    ].join('\n'),
    target_text: '○ 2세 미만(0~23개월)의 아동',
    criteria_text: [
      '○ 2세 미만(0~23개월)의 아동',
      '',
      '○ 출생일로부터 60일 이내에 신청하면 출생월부터 소급해 지급한다.',
    ].join('\n'),
    apply_method: '온라인신청||방문신청',
    // 정부24 서비스 페이지(135200000143)는 삭제 상태라 링크할 곳이 없다. 실제로 신청이 되는 곳을 건다.
    apply_url: 'https://www.bokjiro.go.kr/ssis-tbu/index.do',
    agency: '보건복지부',
    contact: '보건복지상담센터/129',
    region_code: 'ALL',
    segments: ['parenting'],
    source_updated_at: '2026-03-25T00:00:00+00:00',
    checked_at: '2026-09-18',
    evidence: [
      { label: '보건복지부 부모급여(영아수당) 지급', url: 'https://www.mohw.go.kr/menu.es?mid=a10711030600' },
      { label: '정책브리핑 「2026년 부모급여, 이렇게 지원합니다」', url: 'https://www.korea.kr/multi/visualNewsView.do?newsId=148957936' },
    ],
    conditions: {
      // 이 사이트의 나이 축은 '신청자 나이'다(진단 선택지가 10대~50대 이상).
      // 처음에 아동 나이 0~2를 넣었더니 모든 나이대에서 탈락해 진단 전 구간에서 사라졌다.
      // 부모급여는 부모 나이를 보지 않으므로 null이 맞다. 아동의 월령은 life_stages가 진다 —
      // 같은 인구를 다루는 첫만남이용권도 life_stages ['pregnancy','birth']로 모델링돼 있다.
      age_min: null,
      age_max: null,
      gender: 'any',
      income_bands: [],
      life_stages: ['birth'],
      household_types: [],
      occupations: [],
      region_codes: [],
    },
  },
]
