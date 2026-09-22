import { describe, it, expect } from 'vitest'
import { tagSegments } from '../rules'

const base = { title: '', target_text: '', summary: '' }
const noCond = { age_min: null, age_max: null, life_stages: [], occupations: [], household_types: [] }

describe('tagSegments', () => {
  it('청년: 나이 조건 19~39 범위 안', () => {
    expect(tagSegments(base, { ...noCond, age_min: 19, age_max: 34 })).toContain('youth')
  })
  it('청년: 키워드', () => {
    expect(tagSegments({ ...base, title: '청년 월세 특별지원' }, noCond)).toContain('youth')
  })
  it('나이 범위가 넓거나 미성년 시작이면 청년 아님', () => {
    expect(tagSegments(base, { ...noCond, age_min: 0, age_max: 100 })).not.toContain('youth')
    expect(tagSegments(base, { ...noCond, age_min: 3, age_max: 5 })).not.toContain('youth')
    expect(tagSegments(base, { ...noCond, age_min: 15, age_max: 24 })).not.toContain('youth')
  })
  it('출산·육아: 생애주기 코드, 아동 나이 범위, 또는 키워드', () => {
    expect(tagSegments(base, { ...noCond, life_stages: ['pregnancy'] })).toContain('parenting')
    expect(tagSegments(base, { ...noCond, age_min: 3, age_max: 5 })).toContain('parenting')
    expect(tagSegments({ ...base, target_text: '만 0~5세 영유아 양육 가정' }, noCond)).toContain('parenting')
  })
  it('한부모·다자녀 가구 유형만으로는 출산·육아로 보지 않는다', () => {
    expect(tagSegments({ ...base, title: '무인민원발급기 수수료 면제' }, { ...noCond, household_types: ['single_parent', 'multi_child', 'disabled'] })).toEqual(['other'])
  })
  it('소상공인: 직업 코드 또는 키워드', () => {
    expect(tagSegments(base, { ...noCond, occupations: ['small_biz'] })).toContain('small_biz')
    expect(tagSegments({ ...base, title: '소상공인 냉난방기 교체 지원' }, noCond)).toContain('small_biz')
    expect(tagSegments({ ...base, summary: '자영업자 경영안정자금' }, noCond)).toContain('small_biz')
  })
  it('복수 세그먼트 가능, 없으면 other', () => {
    expect(tagSegments({ ...base, title: '청년 창업 소상공인 지원' }, noCond)).toEqual(['youth', 'small_biz'])
    expect(tagSegments({ ...base, title: '노인 기초연금' }, noCond)).toEqual(['other'])
  })
})

/*
 * 한글에는 낱말 경계가 없다. 키워드 하나가 다른 낱말 안에 파묻혀 걸리면 세그먼트가 통째로
 * 오염되는데, 화면에는 목록 한 줄로만 보여 눈으로는 알기 어렵다. 실제로 발견된 두 건은
 * 전수 재계산에서 open 368건을 움직였다. 아래 문장은 전부 DB에 있던 실제 안내문이다.
 */
describe('낱말 안에 파묻힌 매치', () => {
  // '이상인'에 '상인'이 들어 있다. 이 하나로 소상공인 세그먼트에 287건이 잘못 들어와 있었고,
  // 제주 소상공인 목록 맨 앞이 "4.3생존희생자·유족·며느리 진료비 지원"이었다.
  it.each([
    ['본인부담금액 20,000원 이상인 경우 30% 지원', '금액 이상인'],
    ['만 65세 이상인 자', '나이 이상인'],
    ['지원 대상인 경우에 한함', '대상인'],
    ['사업평가등급 BB등급 이상인 기업', '등급 이상인'],
  ])('%s → 소상공인이 아니다 (%s)', (target) => {
    expect(tagSegments({ ...base, title: '진료비 지원', target_text: target }, noCond)).not.toContain('small_biz')
  })

  it('낱말 안에 있어도 실제 상인은 남는다', () => {
    for (const t of ['소상인 특례보증', '청년상인 육성 지원', '가축거래상인 등록자', '상인단체 지원']) {
      expect(tagSegments({ ...base, title: t }, noCond)).toContain('small_biz')
    }
  })

  // 안내문은 나이 상한을 생년으로, 출신지 요건을 출생지로 쓴다. '출생'을 키워드로 두면
  // 노인·보훈·귀향·다문화 지원이 전부 출산·육아로 들어온다(그렇게 109건이 들어와 있었다).
  it.each([
    ['1954년 12월 31일 이전 출생', '보훈 진료비'],
    ['1926년 12월 31일 이전 출생자로서', '노인 장수수당'],
    ['고흥군에서 출생한 자 또는 고흥군에서 5년 이상 거주', '귀향 정착장려금'],
    ['남원시에 출생 등록한 자가 타 시군에서', '귀향 이사비'],
    ['18세 ~ 45세(출생년월일 : 1981. 1. 1. 이후)', '청년 면접수당'],
    ['다문화가족 -한국인(출생·인지·귀화 등 불문)', '다문화가족'],
  ])('%s → 출산·육아가 아니다 (%s)', (target) => {
    expect(tagSegments({ ...base, title: '지원', target_text: target }, noCond)).not.toContain('parenting')
  })

  // '출생'을 빼면서 잃을 뻔한 것들. 진짜 신호는 더 좁은 낱말이고, 전부 목록에 없었다.
  it.each([
    ['신생아 건강관리비 지원', '신생아'],
    ['셋째아 이후 출생아 건강보험료 지원', '출생아'],
    ['미숙아 및 선천성이상아 의료비 지원', '미숙아'],
    ['서울시 다태아 안심보험 지원', '다태아'],
    ['(경남 김해시)둘째아 축하상품권 지원', '둘째아'],
    ['세자녀 이상 가정 가족사진 지원(셋째아 이상 가정)', '셋째아'],
    ['영주시를 주소지로 출생신고한 아기', '출생신고'],
  ])('%s → 출산·육아다 (%s)', (title) => {
    expect(tagSegments({ ...base, title }, noCond)).toContain('parenting')
  })

  // '보육'은 창업 인큐베이션을 뜻할 때가 있다. 앞말(창업보육)과 뒷말(보육센터·보육 프로그램)
  // 둘을 다 막아야 한다 — 공백이 들어간 '창업 보육센터'는 앞말 가드만으로는 걸리지 않는다.
  it.each([
    ['스포츠산업 예비초기 및 창업도약 프로그램(창업보육지원)', '창업보육 붙여쓰기'],
    ['스마트팜 청년창업 보육센터', '창업 보육센터 공백'],
    ['장애인기업 창업보육센터 운영', '창업보육센터'],
    ['창업존 운영', '보육프로그램'],
    ['청년창업센터 지원', '보육 프로그램 공백'],
  ])('%s → 출산·육아가 아니다 (%s)', (title) => {
    expect(tagSegments({ ...base, title, target_text: '창업 7년 이내 기업에 입주공간 제공, 보육프로그램 및 보육 프로그램 지원' }, noCond)).not.toContain('parenting')
  })

  it('가드를 달아도 진짜 보육은 남는다', () => {
    for (const t of ['보육교직원 여름휴가비 지원', '초등학교 방과후 보육교실 지원', '보육료 지원', '보육교사 처우개선']) {
      expect(tagSegments({ ...base, title: t }, noCond)).toContain('parenting')
    }
  })

  // '업소'는 넣지 않았다. 창업소·직업소·사업소에 파묻혀 고치려는 것과 같은 버그를 만든다.
  it('직업소유자는 업소가 아니다', () => {
    expect(tagSegments({ ...base, title: '장학금', target_text: '공무원, 회사원 등 직업소유자' }, noCond)).not.toContain('small_biz')
  })

  // '자녀'는 넣지 않았다. 단독 443건에 장학금·보훈수당·손자녀 돌봄이 섞여 오탐이 크다.
  it('6·25자녀수당은 보훈이지 육아가 아니다', () => {
    expect(tagSegments({ ...base, title: '6·25자녀수당', target_text: '6･25전몰군경 자녀 중 1명' }, noCond)).not.toContain('parenting')
  })

  // 넣지 않기로 한 후보들. 다시 넣으려는 사람이 같은 자리를 밟지 않게 고정해 둔다.
  it('아기유니콘은 창업 보증이지 육아가 아니다', () => {
    expect(tagSegments({ ...base, title: 'VC투자매칭 특별보증', target_text: '‘아기유니콘 200 육성' }, noCond)).not.toContain('parenting')
  })
  it('비슬산전기차는 산전검사가 아니다', () => {
    expect(tagSegments({ ...base, title: '문화시설 이용요금 감면(비슬산전기차)' }, noCond)).not.toContain('parenting')
  })
})

/*
 * 검수에서 "출생을 빼면 실제 육아 열 건 중 일곱이 사라진다"는 지적을 받고 회수한 낱말들.
 * 잃은 107건을 전수로 읽고 골랐다. 아래 문장은 전부 DB에 있던 실제 안내문이다.
 */
describe('회수 낱말', () => {
  // '다둥이'는 회수 낱말이 아니라 새 결정이다 — '출생' 단독 109건을 하나도 되찾지 않고,
  // 지자체 요금감면 48건을 새로 넣는다. 수혜자가 다자녀 가정의 부모와 자녀 본인이라
  // 넣기로 했고, 그 판단을 여기 고정한다(rules.ts의 '회수가 아닌 결정' 문단 참고).
  it.each([
    ['성주군 두 자녀 이상 가정 인플루엔자 무료 예방접종 지원', '두 자녀'],
    ['공영주차장 이용요금 감면', '다둥이행복카드 소지자(두자녀)'],
    ['강북문화예술회관 스포츠프로그램 수강료 감면', '다둥이 행복카드를 소지한 가정의 보호자와 자녀'],
    ['어린이 국가예방접종 지원', '만12세 이하 어린이'],
    ['구미시 아토피피부염 환아 보습제 지원', '만 18세 이하 아토피피부염 환아'],
    ['꿈나래통장', '자녀교육비 마련을 위해 매월 저축'],
    ['부산광역시 신혼부부 럭키7하우스 지원사업', '자녀가 있는 (예비)신혼부부(태아포함)'],
  ])('%s → 출산·육아다', (title, target) => {
    expect(tagSegments({ ...base, title, target_text: target }, noCond)).toContain('parenting')
  })

  // '모두 자녀'("부모가 모두 자녀의 출생일 기준")에 '두 자녀'가 파묻힌다. 지금은 네 행 모두
  // 양육·출산으로 독립 근거가 있어 오분류가 없지만, 다른 낱말이 바뀌면 드러난다.
  it('모두 자녀는 두 자녀가 아니다', () => {
    expect(tagSegments({ ...base, title: '교통비 지원', target_text: '어머니와 아버지가 모두 자녀를 돌보지 못하는 경우' }, noCond)).not.toContain('parenting')
  })

  // '태아'가 '다태아'·'쌍태아'를 포함하므로 '다태아'를 따로 두지 않는다.
  it('태아 하나로 다태아·쌍태아까지 덮는다', () => {
    for (const t of ['서울시 다태아 안심보험 지원', '쌍태아 임산부 지원']) {
      expect(tagSegments({ ...base, title: t }, noCond)).toContain('parenting')
    }
  })

  // '어린이'가 '어린이집'을 포함하므로 '어린이집'을 따로 두지 않는다.
  it('어린이 하나로 어린이집까지 덮는다', () => {
    expect(tagSegments({ ...base, title: '직장어린이집 설치 지원' }, noCond)).toContain('parenting')
  })

  // 음식점 시설개선·모범음식점 지원이 소상공인인데 다른 낱말이 없어 빠져 있었다(단독 15건).
  it.each(['김포금쌀밥집 육성 지원', '모범음식점 인센티브 지원', '외식업소 시설개선 지원사업'])(
    '%s → 소상공인이다',
    (title) => {
      expect(tagSegments({ ...base, title, target_text: '관내 일반음식점 중 선정된 업소' }, noCond)).toContain('small_biz')
    },
  )
})
