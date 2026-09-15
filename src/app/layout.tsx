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
  // './'는 metadataBase + 현재 경로로 해석되어 전 페이지가 자기 자신을 canonical로 가리킨다.
  // 홈·정책 페이지처럼 canonical을 두지 않은 곳에 utm 파라미터가 붙은 링크가 유입되면 별도 URL로
  // 색인될 수 있어 기본값으로 막는다.
  // 주의: 하위 페이지가 alternates를 지정하면 이 객체가 병합되지 않고 통째로 교체된다. languages나
  // types만 추가하는 페이지는 canonical도 같이 적어야 하며, 빠뜨리면 그 페이지만 조용히 canonical을
  // 잃는다. './' 해석 자체의 회귀는 __tests__/canonical.test.ts가 지킨다.
  alternates: { canonical: './' },
  openGraph: { type: 'website', locale: 'ko_KR', siteName: siteName() },
  // 네이버 서치어드바이저 소유확인. 네이버는 DNS 방식을 지원하지 않아 메타 태그로만 가능하다.
  // 공개값이라 env로 숨길 이유가 없고, 태그가 사라지면 소유확인이 풀리므로 코드에 고정한다.
  verification: { other: { 'naver-site-verification': 'cb12820b99e82998654bf1693726ced03349fb33' } },
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
