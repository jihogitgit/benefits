import { describe, it, expect } from 'vitest'
import { peerKey, isPeerGroup, groupPeers, sigunguOf, type PeerItem } from '../peer-group'

const item = (slug: string, title: string, region_code: string): PeerItem => ({ slug, title, region_code, agency: null })

/*
 * 아래 제목은 전부 DB의 실제 안내문이다. 지어낸 예로는 이 함수가 무엇을 틀리는지 알 수 없다 —
 * 실제로 두 번 다 오합체는 만들어 본 규칙이 아니라 10,483건을 통과시켜 봐서 드러났다.
 */
describe('peerKey - 지역 괄호', () => {
  it.each([
    ['(경남 김해시)둘째아 축하상품권 지원', '둘째아축하상품권', '줄여 쓴 시도 + 시'],
    ['(강원 원주시)장애인 평생교육이용권(바우처) 지원', '장애인평생교육이용권(바우처)', '줄여 쓴 시도'],
    ['경기도 광주시 기초생활수급자 감면', '경기도광주시기초생활수급자감면', '괄호 밖 지역은 두는 것'],
    ['(경기도 광주시) 기초생활수급자 감면', '기초생활수급자감면', '정식 시도 + 시'],
    ['결혼이주여성 산모도우미 운영(완도군)', '결혼이주여성산모도우미운영', '뒤에 붙은 군'],
    ['[가평군] 청년 면접수당', '청년면접수당', '대괄호'],
    ['(수원시 영통구) 출산장려금', '출산장려금', '시 + 일반구'],
    ['(송파구)어린이 급식 지원', '어린이급식', '구 하나'],
  ])('%s → %s (%s)', (title, key) => {
    expect(peerKey(title)).toBe(key)
  })

  /*
   * 여기가 이 파일의 핵심이다. `[가-힣]{2,5}(?:시|군|구)` 패턴으로 지역을 잡으면 아래 넷이
   * 전부 지역으로 잡혀 사라진다. 그러면 대상이 다른 두 사업이 한 열쇠를 갖고, 상세 페이지는
   * "같은 사업을 하는 다른 곳"이라며 다른 사업을 내놓는다. 그래서 목록으로 대조한다.
   */
  it.each([
    ['수도요금 감면(다자녀가구)', '가구'],
    ['수도요금 감면(저소득가구)', '가구'],
    ['난임시술비 지원(사후청구)', '청구'],
    ['공영자전거 이용요금 감면(청소년증 발급시)', '발급시'],
    ['기초생활수급자 가구 감면(상·하수도)', '하수도'],
    ['난임부부 지원(시술 후 원외약제비 청구)', '긴 설명'],
    ['장애인 활동지원(추가)', '짧은 보통명사'],
    ['자동차세 감면(경차)', '경차'],
  ])('%s의 괄호는 남는다 (%s)', (title) => {
    const paren = title.slice(title.indexOf('('))
    expect(peerKey(title)).toContain(paren.replace(/\s+/g, '').replace(/[·]/g, ''))
  })
})

describe('peerKey - 표기 차이 흡수', () => {
  it('띄어쓰기가 달라도 한 열쇠다', () => {
    const keys = ['출산 장려금 지원', '출산장려금 지원', '출산장려금지원'].map(peerKey)
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toBe('출산장려금')
  })

  // 40건과 4건이 가운뎃점 하나로 갈라져 있었다. 통일이 아니라 삭제여야 둘이 만난다.
  it('가운뎃점은 있으나 없으나 한 열쇠다', () => {
    expect(peerKey('산모·신생아 건강관리 지원')).toBe(peerKey('산모신생아 건강관리'))
  })

  // 꼬리를 한 번만 벗기면 "…위로금지급"이 "…위로금"과 끝내 갈라진다(17건 대 12건이었다).
  it.each([
    ['참전유공자 사망위로금 지급', '참전유공자사망위로금'],
    ['효행장려금 지급사업', '효행장려금'],
    ['출산지원금 지원 사업', '출산지원금'],
  ])('%s → %s (꼬리를 끝까지)', (title, key) => {
    expect(peerKey(title)).toBe(key)
  })

  // 꼬리를 다 떼면 "생활"만 남는다. 두 글자로 묶으면 서로 다른 사업이 한 덩이가 된다.
  it('너무 짧아진 열쇠는 버린다', () => {
    expect(peerKey('생활 지원')).toBe('')
    expect(peerKey('지원사업')).toBe('')
    expect(peerKey('벼육묘 지원')).toBe('벼육묘') // 실제 묶음 중 가장 짧은 것
  })
})

describe('isPeerGroup', () => {
  it('건수가 모자라면 묶음이 아니다', () => {
    expect(isPeerGroup([item('a', 'x', 'seoul'), item('b', 'x', 'busan')])).toBe(false)
  })

  // 한 지자체가 대상별로 쪼개 등록한 사업 여러 건은 "여러 곳이 하는 같은 사업"이 아니다.
  it('한 지역에 몰려 있으면 묶음이 아니다', () => {
    const same = ['a', 'b', 'c', 'd'].map((s) => item(s, '출산장려금 지원', 'seoul'))
    expect(isPeerGroup(same)).toBe(false)
  })

  it('세 지역 이상이면 묶음이다', () => {
    const items = [
      item('a', '출산장려금 지원', 'seoul'),
      item('b', '출산장려금 지원', 'busan'),
      item('c', '출산장려금 지원', 'jeonnam'),
    ]
    expect(isPeerGroup(items)).toBe(true)
  })
})

describe('groupPeers', () => {
  it('조건을 채운 묶음만 남기고 열쇠로 모은다', () => {
    const groups = groupPeers([
      item('a', '출산 장려금 지원', 'seoul'),
      item('b', '(송파구) 출산장려금', 'busan'),
      item('c', '출산장려금 지원사업', 'jeonnam'),
      item('d', '벼육묘 지원', 'chungnam'), // 혼자라 버려진다
      item('e', '수도요금 감면(다자녀가구)', 'seoul'),
      item('f', '수도요금 감면(저소득가구)', 'busan'),
      item('g', '수도요금 감면(한부모가구)', 'jeju'), // 괄호가 남아 셋이 서로 다른 열쇠다
    ])
    expect([...groups.keys()]).toEqual(['출산장려금'])
    expect(groups.get('출산장려금')?.map((i) => i.slug)).toEqual(['a', 'b', 'c'])
  })
})

/*
 * 시·도만으로는 목록이 못 쓰게 된다 — 강원 다섯 건이 「강원 · 출산장려금 지원」으로 똑같이
 * 다섯 줄 나오고, 독자는 자기 동네 줄을 고를 수 없다.
 */
describe('sigunguOf', () => {
  const cases: [title: string, agency: string | null, expected: string, why: string][] = [
    ['(경남 김해시)둘째아 축하상품권', null, '김해시', '제목 괄호'],
    ['출산장려금', '강원특별자치도 영월군 복지정책과', '영월군', '소관기관'],
    ['(수원시 영통구) 출산장려금', null, '영통구', '일반구를 고른다'],
    ['결혼이주여성 산모도우미(완도군)', '전라남도', '완도군', '기관보다 제목이 구체적'],
  ]
  it.each(cases)('%s + %s → %s (%s)', (title, agency, expected) => {
    expect(sigunguOf(title, agency)).toBe(expected)
  })

  // 기관명은 띄어쓰기가 없을 때가 있다. 이 경로로 50건을 되찾았다.
  it.each([
    ['서울특별시관악구시설관리공단', '관악구'],
    ['울산광역시남구도시관리공단', '남구'],
    ['인천광역시연수구시설안전관리공단', '연수구'],
    ['공주시상수도', '공주시'],
  ])('붙여 쓴 기관명 %s → %s', (agency, expected) => {
    expect(sigunguOf('체육시설 이용요금 감면', agency)).toBe(expected)
  })

  // 짧은 이름부터 훑으면 "강남구"가 "남구"로, "부산진구"가 "진구"로 잡힌다.
  it('긴 이름이 이긴다', () => {
    expect(sigunguOf('감면', '서울특별시강남구도시관리공단')).toBe('강남구')
    expect(sigunguOf('감면', '부산광역시부산진구시설관리공단')).toBe('부산진구')
    expect(sigunguOf('감면', '경기도남양주시도시공사')).toBe('남양주시')
  })

  it('시·도만 있으면 null이다', () => {
    expect(sigunguOf('출산장려금 지원', '경기도')).toBe(null)
    expect(sigunguOf('(경기도) 출산장려금', null)).toBe(null)
  })

  // 지역이 아닌 괄호에서 시·군·구를 주워 오면 엉뚱한 동네 이름이 붙는다.
  it('지역이 아닌 괄호에서는 가져오지 않는다', () => {
    expect(sigunguOf('수도요금 감면(다자녀가구)', null)).toBe(null)
    expect(sigunguOf('난임시술비(사후청구)', null)).toBe(null)
  })
})
