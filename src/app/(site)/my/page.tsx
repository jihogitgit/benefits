import type { Metadata } from 'next'
import DiagnosisResults from '@/components/diagnosis/DiagnosisResults'

// 개인화 화면이라 서버가 만들 안정적인 본문이 없다. 색인 대상에서 제외한다.
export const metadata: Metadata = {
  title: '내 진단 결과',
  robots: { index: false, follow: true },
}

export default function MyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="mb-4 text-2xl font-extrabold">내 지원금</h1>
      <DiagnosisResults />
    </div>
  )
}
