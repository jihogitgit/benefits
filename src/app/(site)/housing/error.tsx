'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/** Supabase 조회 실패 등. 공고 데이터는 원문이 따로 있으니 그리로 보낸다. (저장소에 다른 error.tsx는 없다) */
export default function HousingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-extrabold">공고를 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-gray-600">잠시 후 다시 시도해 주세요. 급하면 청약홈과 LH 청약플러스에서 직접 확인할 수 있습니다.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">다시 시도</button>
        <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm hover:border-brand-400">청약홈</a>
        <a href="https://apply.lh.or.kr" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm hover:border-brand-400">LH 청약플러스</a>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm hover:border-brand-400">홈</Link>
      </div>
    </div>
  )
}
