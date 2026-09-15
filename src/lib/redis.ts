import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

/** 미설정이면 null — getOrSet은 캐시 없이 fetcher만 실행한다. */
export const redis = url && token ? new Redis({ url, token }) : null

export const CACHE_KEYS = {
  search: (hash: string) => `benefits:search:${hash}`,
} as const

export const CACHE_TTL = {
  search: 600, // 10분
  // 검색어가 붙은 요청은 짧게 잡는다. 검색어는 자유 입력이라 키 공간이 무한하고,
  // 10분씩 잡아두면 한 번 쓰이고 버려질 항목이 Redis를 채워 실제로 재사용되는
  // 필터 조합 캐시를 밀어낸다.
  searchKeyword: 60, // 1분
} as const

export async function getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  if (!redis) return fetcher()
  const cached = await redis.get<T>(key)
  if (cached !== null && cached !== undefined) return cached
  const fresh = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(fresh))
  return fresh
}
