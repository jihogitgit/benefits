import type { ConditionRow, Segment } from '../src/types/database'

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
export const CURATED_SOURCE = 'curated'

/** 확인일이 이만큼 지나면 상세 페이지가 스스로 "직접 확인해라"라고 말한다. */
export const CURATED_STALE_DAYS = 180

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
    title: '부모급여',
    summary: '0~23개월 아동에게 0세 월 100만원, 1세 월 50만원 현금 지원',
    amount_text: [
      '○ 0세(0~11개월) 월 100만원, 1세(12~23개월) 월 50만원',
      '',
      '○ 어린이집을 이용하면 보육료 바우처를 먼저 받고 남는 금액만 현금으로 받는다(2026년 기준)',
      ' - 0세: 부모급여 100만원 − 영유아 기본보육료 58만 4천원 = 현금 41만 6천원',
      ' - 1세: 부모급여 50만원 − 영유아 기본보육료 51만 5천원 = 현금 없음',
      '',
      '○ 종일제 아이돌봄 서비스를 이용하는 경우 정부지원금이 부모급여보다 적으면 그 차액을 현금으로 지원',
    ].join('\n'),
    target_text: '○ 2세 미만(0~23개월)의 아동',
    criteria_text: [
      '○ 2세 미만(0~23개월)의 아동',
      '',
      '○ 아동의 출생일을 포함해 60일 이내에 신청하면 출생월부터 소급해 지급한다.',
      '  60일이 지나 신청하면 신청월분부터 지급되고, 지나간 달은 받을 수 없다.',
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
      // 아동 나이다. 같은 제도를 올린 보은군 레코드(0~2)와 맞춘다 — 23개월 아동이
      // 만 나이 반올림 때문에 진단에서 빠지는 쪽이 더 나쁘다.
      age_min: 0,
      age_max: 2,
      gender: 'any',
      income_bands: [],
      life_stages: [],
      household_types: [],
      occupations: [],
      region_codes: [],
    },
  },
]
