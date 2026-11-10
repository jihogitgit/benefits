import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NotFound from '@/components/layout/NotFound'

/**
 * 어떤 레이아웃에도 걸리지 않은 주소(/없는경로)의 404. 루트 레이아웃 안에서만 렌더되므로
 * (site) 레이아웃의 헤더·푸터를 여기서 직접 감싼다. (site) 안의 notFound() 호출은
 * src/app/(site)/not-found.tsx가 받는다 — 둘이 같은 NotFound 본문을 낸다.
 */
export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: true },
}

export default function RootNotFound() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">
        <NotFound />
      </main>
      <Footer />
    </>
  )
}
