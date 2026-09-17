import { sitemapPaths } from '@/lib/seo/sitemap-entries'
import { absoluteUrl } from '@/lib/seo/site'

/**
 * 루트 사이트맵 인덱스.
 *
 * app/sitemap.ts가 generateSitemaps를 쓰면 Next는 /sitemap/{id}.xml만 내고 /sitemap.xml은
 * 만들지 않는다(404). 검색엔진 등록 도구는 대부분 /sitemap.xml을 기본값으로 가정하고,
 * 네이버 서치어드바이저는 하위 경로 사이트맵을 거부하는 사례가 있어 표준 경로를 직접 연다.
 * 이 인덱스가 있으면 제출은 파일 수와 무관하게 한 번으로 끝난다.
 *
 * 내용은 SITEMAP_IDS 상수에서만 나오므로 DB 접근이 없다 — 정적으로 생성된다.
 *
 * lastmod는 싣지 않는다. 분할 파일의 실제 갱신 시각을 알 수 없어 now()를 쓰면 매번
 * "방금 바뀜"으로 신고하게 되고, 그러면 상세 항목에 정확히 계산해 둔 lastmod 신호까지
 * 함께 신뢰를 잃는다(sitemap-entries.ts의 같은 이유 참고).
 */
export function GET(): Response {
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapPaths().map((p) => `<sitemap><loc>${absoluteUrl(p)}</loc></sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n')

  return new Response(body, {
    headers: {
      // Next의 사이트맵 응답과 같은 타입을 쓴다. 등록 도구가 content-type으로 형식을 판정한다.
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
