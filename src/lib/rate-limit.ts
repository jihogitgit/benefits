import { redis } from './redis'

/**
 * 고정 윈도 레이트 리밋. true면 통과.
 *
 * 검색어가 생기면서 인증 없는 /api/benefits/search의 키 공간이 무한해졌다. q를 바꿔가며
 * 반복 호출하면 캐시를 매번 빗나가 전건 스캔을 무한히 유발할 수 있고, URL이 매번 달라져
 * CDN의 s-maxage도 막아주지 못한다.
 *
 * Redis가 있으면 Redis로(모든 인스턴스가 한 카운터를 공유), 없으면 인스턴스 메모리로 센다.
 * @upstash/ratelimit을 새로 들이지 않는 이유는 공개 저장소에 의존성을 덜 늘리기 위해서고,
 * 이 용도에는 고정 윈도로 충분하다.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (redis) {
    try {
      const k = `rl:${key}`
      const n = await redis.incr(k)
      // 윈도 첫 요청에만 TTL을 건다. 매번 걸면 창이 계속 밀려 영원히 만료되지 않는다.
      if (n === 1) await redis.expire(k, windowSec)
      return n <= limit
    } catch {
      // 레이트 리밋 저장소 장애로 검색 자체를 막지는 않는다. 아래 메모리 카운터로 넘어간다.
    }
  }
  return localLimit(key, limit, windowSec)
}

/**
 * 인스턴스 로컬 카운터. Redis가 없을 때의 차선책이다.
 *
 * 서버리스라 인스턴스가 여러 개면 실제 허용치는 limit × 인스턴스 수가 되고, 인스턴스가
 * 재활용되면 카운터도 사라진다. 즉 정확한 제어가 아니라 '한 인스턴스를 붙잡고 도는 폭주'를
 * 막는 최소한의 장치다. 제대로 하려면 Redis를 붙여야 한다.
 */
const buckets = new Map<string, { n: number; resetAt: number }>()
/** 메모리 상한. 넘으면 만료된 항목부터 비운다 — 키가 무한히 쌓여 메모리를 먹는 것을 막는다. */
const MAX_BUCKETS = 10_000

function localLimit(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now()
  const cur = buckets.get(key)

  if (!cur || now >= cur.resetAt) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
      // 전부 살아있는 창이면 비울 게 없다. 이 경우 더 늘리지 않고 통과시킨다.
      if (buckets.size >= MAX_BUCKETS) return true
    }
    buckets.set(key, { n: 1, resetAt: now + windowSec * 1000 })
    return true
  }

  cur.n += 1
  return cur.n <= limit
}

/** 테스트 전용. 모듈 수준 카운터가 테스트 사이에 새지 않게 한다. */
export function __resetLocalBuckets(): void {
  buckets.clear()
}
