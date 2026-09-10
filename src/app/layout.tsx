import type { Metadata } from 'next'
import './globals.css'

const siteName = process.env.SITE_NAME ?? '지원금 포털'

export const metadata: Metadata = {
  title: { default: siteName, template: `%s | ${siteName}` },
  description: '나이·상황·지역 조건으로 받을 수 있는 정부 지원금을 한눈에 확인하세요.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  // 페이지가 갖춰지기 전까지 색인 차단. Plan 2에서 true로 전환.
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
