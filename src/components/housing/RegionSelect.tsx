'use client'

import { useRouter } from 'next/navigation'

/** 모바일용 지역 드롭다운. 고르면 그 지역 목록으로 간다. 네이티브 select라 휴대폰의 기본 선택 화면이 뜬다. */
export default function RegionSelect({ current, options }: { current: string | null; options: { slug: string; label: string }[] }) {
  const router = useRouter()
  return (
    <label className="flex items-center gap-2 sm:hidden">
      <span className="shrink-0 text-sm font-semibold text-gray-700">지역</span>
      <select
        value={current ?? ''}
        onChange={(e) => router.push(e.target.value ? `/housing/${e.target.value}` : '/housing')}
        className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none"
      >
        <option value="">전체 지역</option>
        {options.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
      </select>
    </label>
  )
}
