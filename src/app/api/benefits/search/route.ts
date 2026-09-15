import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSearchParams, searchBenefits, cacheKeyFor } from '@/lib/benefits/search'
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * 1분당 허용 요청 수. CDN이 같은 URL의 반복은 흡수하므로 여기까지 오는 것은 서로 다른
 * 조합뿐이다. 회사·학교처럼 여러 사람이 한 IP를 쓰는 경우를 감안해 넉넉히 잡되,
 * 자동 반복(초당 수 건 이상)은 걸리는 선이다.
 */
const RATE_LIMIT = 100
const RATE_WINDOW_SEC = 60

/**
 * 레이트 리밋 기준 클라이언트. Vercel이 앞단이라 x-forwarded-for 첫 항목이 실제 IP다.
 * 헤더가 없으면 null을 주고 제한을 걸지 않는다. 식별할 수 없는 요청을 'unknown' 한 바구니에
 * 몰아넣으면 서로 무관한 사용자들이 한 카운터를 공유해, 공격이 아니라 평범한 트래픽만으로도
 * 전원이 429를 맞는다. 스스로 만든 장애가 막으려던 남용보다 나쁘다.
 */
function clientKey(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}

export async function GET(request: Request) {
  try {
    const client = clientKey(request)
    if (client && !(await rateLimit(`search:${client}`, RATE_LIMIT, RATE_WINDOW_SEC))) {
      return NextResponse.json({ error: 'too many requests' }, { status: 429, headers: { 'retry-after': String(RATE_WINDOW_SEC) } })
    }
    const input = parseSearchParams(new URL(request.url).searchParams)
    const ttl = input.q ? CACHE_TTL.searchKeyword : CACHE_TTL.search
    const result = await getOrSet(CACHE_KEYS.search(cacheKeyFor(input)), ttl, () =>
      searchBenefits(createAdminClient(), input),
    )
    return NextResponse.json(result, {
      headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (err) {
    console.error('[api/benefits/search] failed:', err)
    return NextResponse.json({ error: 'search failed' }, { status: 500 })
  }
}
