import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/site'
import { sitemapPaths } from '@/lib/seo/sitemap-entries'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/my', '/api/', '/admin/'] },
    // /sitemap.xml 인덱스는 존재하지 않는다(generateSitemaps는 분할 파일만 낸다). 분할 파일을 전부 적는다.
    sitemap: sitemapPaths().map(absoluteUrl),
  }
}
