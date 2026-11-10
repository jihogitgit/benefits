import type { Metadata } from 'next'
import { Suspense } from 'react'
import DiagnosisResults from '@/components/diagnosis/DiagnosisResults'
import MyHousingBlock from '@/components/housing/MyHousingBlock'
import { listHousing, HOUSING_LIST_LIMIT, type HousingCardRow } from '@/lib/housing/queries'

// 개인화 화면이라 서버가 만들 안정적인 본문이 없다. 색인 대상에서 제외한다.
export const metadata: Metadata = {
  title: '내 진단 결과',
  robots: { index: false, follow: true },
}

// 접수중·예정 공고 목록(housing:lists)만 서버에서 읽는다. 진단 값은 브라우저에 있어 거르기는 클라이언트가 한다.
export const revalidate = 86400

export default async function MyPage() {
  // 부가 섹션이라 조회 실패가 진단 결과를 가리면 안 된다 — 빈 배열이면 블록이 숨는다.
  const housing = await listHousing({ status: 'active', kind: null, region: null, limit: HOUSING_LIST_LIMIT }).catch((e) => {
    console.error('[my] housing list failed:', e)
    return [] as HousingCardRow[]
  })
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="mb-4 text-2xl font-extrabold">내 지원금</h1>
      {/* DiagnosisResults가 useSearchParams를 쓴다. 경계가 없으면 이 페이지 전체가
          정적 생성에서 빠진다. 폴백 높이는 컴포넌트의 첫 렌더와 맞춰 화면이 튀지 않게 한다. */}
      <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>}>
        <DiagnosisResults />
      </Suspense>
      <MyHousingBlock rows={housing} />
    </div>
  )
}
