import { listFeedSources } from '@/lib/benefits/queries'
import { buildRss, feedItems, FEED_LIMIT } from '@/lib/seo/rss'

/**
 * RSS 2.0 피드. 네이버 서치어드바이저 → 요청 → RSS 제출에 이 주소를 넣는다.
 *
 * 해설 발행 직후에는 revalidate 스크립트가 이 경로도 함께 비운다(revalidate-targets.ts).
 * 그러지 않으면 새 글이 최대 1시간 늦게 피드에 오른다.
 */
export const revalidate = 3600

export async function GET(): Promise<Response> {
  const { articles, guides } = await listFeedSources(FEED_LIMIT)
  return new Response(buildRss(feedItems(articles, guides)), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
