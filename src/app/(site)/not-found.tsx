import type { Metadata } from 'next'
import NotFound from '@/components/layout/NotFound'

/** (site) 안의 notFound() — 없는 슬러그·마감 후 소멸한 지원금 등. 헤더·푸터는 (site) 레이아웃이 준다. */
export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: true },
}

export default function SiteNotFound() {
  return <NotFound />
}
