import type { Metadata } from 'next'
import { ADSENSE_CLIENT } from '@/lib/adsense'
import { GTM_ID, gtmSnippet, analyticsPath } from '@/lib/gtm'
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
  const adsense = ADSENSE_CLIENT
  const gtm = GTM_ID
  // 계측은 한 경로만 쓴다. 판정과 근거는 lib/gtm.ts의 analyticsPath에 있다.
  const analytics = analyticsPath({ gtm, gaId })
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/*
          GTM. 구글이 준 스니펫은 <head>에 넣으라고 하지만 body 첫 자식으로 둔다.
          앱 라우터에서 인라인 스크립트를 head에 넣을 방법이 둘인데 둘 다 나쁘다.

          하나는 React 19의 호이스팅인데, 올려주는 것은 async가 붙은 src 스크립트뿐이고
          인라인은 렌더 위치에 그대로 남는다. 하나는 next/script의 beforeInteractive인데,
          앱 라우터에서 인라인을 받으면 스니펫을 실행하는 태그를 내보내지 않고
          `(self.__next_s=self.__next_s||[]).push([0,{...}])`로 감싸 Next 런타임에 맡긴다
          (node_modules/next/dist/client/script.js). 그러면 ① 실행이 Next 번들 로드 뒤로
          밀리고 ② HTML에 스니펫이 JSON 이스케이프된 형태로만 남아 태그 어시스턴트와
          GTM 설치 확인이 못 찾는다. 애드센스가 afterInteractive로 실패한 것과 같은 모양이다.

          body 첫 자식의 평범한 script는 HTML 파싱 중에 그 자리에서 실행된다 — 하이드레이션도
          Next 런타임도 기다리지 않으므로, 앱 라우터에서 실제로 얻을 수 있는 가장 빠른 시점이다.
          스니펫도 구글이 준 글자 그대로 HTML에 박힌다.
        */}
        {analytics === 'gtm' && gtm && (
          <>
            <script dangerouslySetInnerHTML={{ __html: gtmSnippet(gtm) }} />
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
                height="0"
                width="0"
                style={{ display: 'none', visibility: 'hidden' }}
              />
            </noscript>
          </>
        )}
        {/*
          next/script가 아니라 평범한 script 태그를 쓴다. strategy="afterInteractive"는 HTML에
          preload 링크만 남기고 실제 태그는 하이드레이션 이후 JS로 주입하는데, 그러면 HTML만 읽는
          크롤러에는 스니펫이 아예 없는 것으로 보인다(애드센스 코드 스니펫 방식 사이트 확인이 이래서
          실패했다). React 19는 async가 붙은 script를 head로 올리고 중복도 제거하므로, 구글이 준
          스니펫과 같은 모양이 서버 렌더 HTML에 그대로 박힌다. 광고 로드도 하이드레이션을 기다리지
          않는다.
        */}
        {adsense && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`}
            crossOrigin="anonymous"
          />
        )}
        {/*
          gtag 직접 연결. GTM이 켜져 있으면 analyticsPath가 'gtm'을 내므로 이 분기는 죽는다.
          둘을 같이 켜면 페이지뷰가 두 번 잡히고, 그 이중 계측은 GA4 화면에서 '트래픽이 늘었다'로
          보여 사고로 인지되지 않는다. 정말 둘을 같이 써야 하면 컨테이너에서 GA4 태그를 빼는 쪽이다.
        */}
        {analytics === 'gtag' && gaId && (
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
