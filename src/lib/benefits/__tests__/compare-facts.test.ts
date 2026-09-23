import { describe, it, expect } from 'vitest'
import { isOnline, toFact, splitsOf, type CompareFact } from '../compare-facts'

const fact = (o: Partial<CompareFact>): CompareFact => ({
  slug: 's',
  online: false,
  alwaysOpen: false,
  incomeLimited: false,
  ...o,
})

describe('isOnline', () => {
  // 원천은 '||'로 값을 이어 붙인다. 실측 상위 값을 그대로 넣는다.
  it('이어 붙은 값에서도 온라인을 찾는다', () => {
    expect(isOnline('정부24온라인신청||방문신청')).toBe(true)
    expect(isOnline('기타 온라인신청||방문신청')).toBe(true)
    expect(isOnline('기타 온라인신청')).toBe(true)
  })

  it('방문·직접입력·신청불필요는 온라인이 아니다', () => {
    expect(isOnline('방문신청')).toBe(false)
    expect(isOnline('방문신청||직접입력')).toBe(false)
    expect(isOnline('신청불필요')).toBe(false)
  })

  it('값이 없으면 온라인이 아니다', () => {
    expect(isOnline(null)).toBe(false)
    expect(isOnline(undefined)).toBe(false)
    expect(isOnline('')).toBe(false)
  })
})

describe('toFact', () => {
  it('원문이 아니라 판정 결과만 담는다', () => {
    expect(
      toFact({ slug: 'a', apply_method: '정부24온라인신청||방문신청', deadline_type: 'always', income_bands: ['0-50'] }),
    ).toEqual({ slug: 'a', online: true, alwaysOpen: true, incomeLimited: true })
  })

  it('period·unknown은 상시가 아니다', () => {
    expect(toFact({ slug: 'a', apply_method: null, deadline_type: 'period', income_bands: [] }).alwaysOpen).toBe(false)
    expect(toFact({ slug: 'a', apply_method: null, deadline_type: 'unknown', income_bands: [] }).alwaysOpen).toBe(false)
  })
})

describe('splitsOf', () => {
  // 이 함수의 전부는 "전건·0건을 버린다"이다. 남기면 66장에 같은 문장이 깔린다.
  it('전건인 축은 버린다', () => {
    const facts = [fact({ online: true }), fact({ online: true })]
    expect(splitsOf(facts)).toEqual([])
  })

  it('0건인 축은 버린다', () => {
    expect(splitsOf([fact({}), fact({})])).toEqual([])
  })

  it('일부만 해당하는 축만 남긴다', () => {
    const facts = [
      fact({ online: true, alwaysOpen: true }),
      fact({ online: false, alwaysOpen: true }),
      fact({ online: false, alwaysOpen: true }),
    ]
    // 온라인은 3건 중 1건이라 갈린다. 상시는 전건이라 버린다.
    expect(splitsOf(facts)).toEqual([
      { key: 'online', label: '온라인 신청 가능', count: 1, total: 3, markTrue: true, markLabel: '온라인' },
    ])
  })

  it('여러 축이 동시에 갈리면 정해진 순서로 낸다', () => {
    const facts = [
      fact({ online: true, alwaysOpen: true, incomeLimited: true }),
      fact({ online: false, alwaysOpen: false, incomeLimited: false }),
    ]
    expect(splitsOf(facts).map((s) => s.key)).toEqual(['online', 'alwaysOpen', 'incomeLimited'])
    expect(splitsOf(facts).map((s) => s.label)).toEqual(['온라인 신청 가능', '상시 접수', '소득 기준 있음'])
  })

  // 딱지는 언제나 적은 쪽에 붙는다. 26줄 중 25줄에 같은 딱지가 붙으면 줄을 가르지 못한다.
  it('다수가 참이면 딱지를 거짓 쪽에 붙인다', () => {
    const facts = [...Array(25)].map(() => fact({ alwaysOpen: true })).concat(fact({ alwaysOpen: false }))
    const [s] = splitsOf(facts)
    expect(s).toMatchObject({ key: 'alwaysOpen', count: 25, total: 26, markTrue: false, markLabel: '기한 있음' })
  })

  it('다수가 거짓이면 딱지를 참 쪽에 붙인다', () => {
    const facts = [...Array(4)].map(() => fact({ online: true })).concat([...Array(22)].map(() => fact({ online: false })))
    expect(splitsOf(facts)[0]).toMatchObject({ count: 4, markTrue: true, markLabel: '온라인' })
  })

  it('딱지가 붙는 줄은 언제나 절반 이하다', () => {
    for (const yes of [1, 5, 13, 14, 25]) {
      const facts = [...Array(yes)].map(() => fact({ online: true })).concat([...Array(26 - yes)].map(() => fact({ online: false })))
      const [s] = splitsOf(facts)
      const marked = facts.filter((f) => f.online === s.markTrue).length
      expect(marked * 2).toBeLessThanOrEqual(26)
    }
  })

  it('빈 묶음에서 터지지 않는다', () => {
    expect(splitsOf([])).toEqual([])
  })
})
