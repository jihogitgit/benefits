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
    // /sitemap.xml 인덱스는 존재하지 않는다(generateSitemaps는 분할 파일만 낸다). 분할 파일을 전부 적는다.
    sitemap: sitemapPaths().map(absoluteUrl),
  }
}
