import Link from 'next/link'
import AdPlacement from './AdPlacement'

export default function StickyRail({ applyUrl, sections }: { applyUrl: string | null; sections: { id: string; label: string }[] }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 space-y-4">
        <nav aria-label="목차" className="rounded-xl border bg-white p-4 text-sm">
          <p className="mb-2 text-xs font-semibold text-gray-500">목차</p>
          <ul className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="text-gray-700 hover:text-indigo-700">{s.label}</a></li>
            ))}
          </ul>
        </nav>
        {applyUrl && (
          <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-indigo-600 py-3 text-center font-bold text-white hover:bg-indigo-700">
            공식 사이트에서 신청 →
          </a>
        )}
        <AdPlacement slot="rail" />
        <Link href="/my" className="block rounded-xl border bg-white py-2.5 text-center text-sm font-semibold hover:bg-gray-50">내 진단 결과 보기</Link>
      </div>
    </aside>
  )
}
