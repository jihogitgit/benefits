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
} as const

export async function getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  if (!redis) return fetcher()
  const cached = await redis.get<T>(key)
  if (cached !== null && cached !== undefined) return cached
  const fresh = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(fresh))
  return fresh
}
