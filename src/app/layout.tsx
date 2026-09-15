import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { siteName, siteUrl, SITE_DESCRIPTION } from '@/lib/seo/site'

export const metadata: Metadata = {
  // 제목은 키워드가 앞, 브랜드가 뒤다. 검색엔진과 사용자 모두 앞쪽 단어에 더 비중을 두는데
  // 신생 사이트는 브랜드 인지도가 0이라 맨 앞을 브랜드에 쓰면 가장 비싼 자리를 버리는 셈이다.
  title: { default: `내가 받을 수 있는 정부 지원금 조회 | ${siteName()}`, template: `%s | ${siteName()}` },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(siteUrl()),
  openGraph: { type: 'website', locale: 'ko_KR', siteName: siteName() },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  const adsense = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {adsense && (
          <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`} crossOrigin="anonymous" strategy="afterInteractive" />
        )}
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
        {children}
      </body>
    </html>
  )
}
