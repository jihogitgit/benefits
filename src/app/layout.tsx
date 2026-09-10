import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { siteName, siteUrl, SITE_DESCRIPTION } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: { default: `${siteName()} — 나에게 맞는 정부 지원금 찾기`, template: `%s | ${siteName()}` },
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
