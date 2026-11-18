import Link from 'next/link'
import { REGIONS } from '../../../data/regions'
import RegionSelect from './RegionSelect'

const chip = (active: boolean) =>
  `inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-sm ${active ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'}`

/**
 * 지역 고르기. 목록 위에 둔다(/housing과 지역 페이지 공통). 휴대폰은 드롭다운, 넓은 화면은 칩 —
 * 17개 시도를 칩으로 늘어놓으면 휴대폰에서 네댓 줄을 먹어 목록이 밀린다.
 * 칩은 좁은 화면에서 숨기기만 하므로 HTML에는 링크가 남는다(지역 페이지로 가는 내부 링크).
 * counts는 그 지역 전용 접수중·예정 건수. 못 구했으면 숫자 없이 낸다.
 */
export default function RegionNav({ current, counts = {} }: { current: string | null; counts?: Record<string, number> }) {
  const n = (slug: string) => counts[slug] ?? 0
  return (
    <div data-testid="region-nav">
      <RegionSelect current={current} options={REGIONS.map((r) => ({ slug: r.slug, label: n(r.slug) > 0 ? `${r.name} (${n(r.slug)})` : r.name }))} />
      <nav aria-label="지역" className="hidden sm:block">
        <ul className="flex flex-wrap gap-1.5">
          <li><Link href="/housing" aria-current={current === null ? 'page' : undefined} className={chip(current === null)}>전체 지역</Link></li>
          {REGIONS.map((r) => (
            <li key={r.slug}>
              <Link href={`/housing/${r.slug}`} aria-current={current === r.slug ? 'page' : undefined} className={chip(current === r.slug)}>
                {r.name}
                {n(r.slug) > 0 && <span className={current === r.slug ? 'text-white/80' : 'text-gray-400'}>{n(r.slug)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
