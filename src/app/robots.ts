import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/site'
import { sitemapPaths } from '@/lib/seo/sitemap-entries'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /my는 여기서 막지 않는다. Disallow와 noindex를 같이 걸면 크롤러가 페이지를 가져가지 못해
      // noindex를 읽을 수 없고, 헤더·상세 레일에서 내부 링크가 걸려 있으므로 URL만 색인될 수 있다.
      // 색인에서 확실히 빼려면 크롤을 허용해 noindex를 읽히는 쪽이 맞다(/my 페이지가 noindex를 낸다).
      disallow: ['/api/', '/admin/'],
    },
    // 인덱스(/sitemap.xml, app/sitemap.xml/route.ts가 낸다)를 먼저 적고 분할 파일도 그대로 남긴다.
    // 인덱스만 적으면 사이트맵 인덱스를 따라가지 않는 크롤러가 한 건도 못 받는다. 중복 신고는
    // 사이트맵 규격상 문제가 없다(같은 URL이 여러 사이트맵에 있어도 된다).
    sitemap: [absoluteUrl('/sitemap.xml'), ...sitemapPaths().map(absoluteUrl)],
  }
}
