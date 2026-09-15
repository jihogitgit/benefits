import { describe, it, expect, beforeEach, vi } from 'vitest'

// Redis 미설정 상태(현재 운영 현황과 동일)를 고정해 메모리 폴백 경로를 검증한다.
vi.mock('../redis', () => ({ redis: null }))
import { rateLimit, __resetLocalBuckets } from '../rate-limit'

describe('rateLimit — 메모리 폴백', () => {
  beforeEach(() => __resetLocalBuckets())

  it('한도까지는 통과시키고 넘으면 막는다', async () => {
    const results: boolean[] = []
    for (let i = 0; i < 5; i++) results.push(await rateLimit('k', 3, 60))
    expect(results).toEqual([true, true, true, false, false])
  })

  it('키가 다르면 카운터도 따로 센다', async () => {
    for (let i = 0; i < 3; i++) await rateLimit('a', 3, 60)
    expect(await rateLimit('a', 3, 60)).toBe(false)
    expect(await rateLimit('b', 3, 60)).toBe(true)
  })

  it('윈도가 지나면 다시 열린다', async () => {
    vi.useFakeTimers()
    try {
      for (let i = 0; i < 3; i++) await rateLimit('k', 3, 60)
      expect(await rateLimit('k', 3, 60)).toBe(false)
      vi.advanceTimersByTime(61_000)
      expect(await rateLimit('k', 3, 60)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
