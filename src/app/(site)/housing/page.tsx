import type { Metadata } from 'next'
import Link from 'next/link'
import { listHousing, HOUSING_LIST_LIMIT, type HousingListStatus } from '@/lib/housing/queries'
import { KIND_FILTERS, isHousingKind } from '@/lib/housing/labels'
import { kstYear } from '@/lib/seo/hub-meta'
import { absoluteUrl } from '@/lib/seo/site'
import { breadcrumbs } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import HousingList from '@/components/housing/HousingList'
import { REGIONS } from '../../../../data/regions'

export const revalidate = 86400 // 하루. 변경은 cron이 housing:lists로 매일 비운다

type SP = Promise<Record<string, string | string[] | undefined>>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function parse(sp: Record<string, string | string[] | undefined>) {
  const status: HousingListStatus = first(sp.status) === 'closed' ? 'closed' : 'active'
  const k = first(sp.kind)
  return { status, kind: isHousingKind(k) ? k : null }
}

/** 필터를 건 주소는 색인하지 않는다(/benefits와 같은 이유). 기본 목록 하나만 색인. */
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { status, kind } = parse(await searchParams)
  const isDefault = status === 'active' && !kind
  return {
    title: status === 'active' ? `${kstYear()} 청약·임대 공고 모음 · 접수중·접수 예정` : `${kstYear()} 청약·임대 공고 · 최근 마감`,
    description: '청약홈 아파트·무순위·오피스텔 분양 공고와 LH 임대·분양 공고를 접수 일정 순으로 모았습니다. 지역별로 보고 특별공급 유형을 확인하세요.',
    ...(isDefault
      ? { alternates: { canonical: absoluteUrl('/housing') } }
      : {
          // 루트 레이아웃이 모든 페이지에 canonical './'을 단다(/benefits와 같은 처리). 쿼리는 빠져 /housing을 가리키므로 null로 끈다.
          alternates: { canonical: null },
          robots: { index: false, follow: true },
        }),
  }
}

const href = (q: { status?: string; kind?: string | null }) => {
  const p = new URLSearchParams()
  if (q.status === 'closed') p.set('status', 'closed')
  if (q.kind) p.set('kind', q.kind)
  const s = p.toString()
  return s ? `/housing?${s}` : '/housing'
}

const chip = (active: boolean) =>
  `inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-sm ${active ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'}`

export default async function HousingPage({ searchParams }: { searchParams: SP }) {
  const { status, kind } = parse(await searchParams)
  const now = new Date()
  const rows = await listHousing({ status, kind, region: null, limit: HOUSING_LIST_LIMIT })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '청약·임대 공고', path: '/housing' }])} />
      <nav className="text-xs text-gray-500" aria-label="현재 위치"><Link href="/" className="hover:underline">홈</Link> › 청약·임대 공고</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">청약·임대 공고</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        청약홈(한국부동산원)과 LH의 분양·임대 공고를 접수 일정 순으로 모았습니다. 자격·금액은 각 공고문이 기준이며, 여기서는 일정과 공급 내역만 정리합니다.
      </p>

      <nav aria-label="접수 상태" className="mt-5 flex gap-2">
        <Link href={href({ kind })} aria-current={status === 'active' ? 'page' : undefined} className={chip(status === 'active')}>접수중·예정</Link>
        <Link href={href({ status: 'closed', kind })} aria-current={status === 'closed' ? 'page' : undefined} className={chip(status === 'closed')}>마감</Link>
      </nav>

      <nav aria-label="종류" className="-mx-4 mt-3 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li><Link href={href({ status })} aria-current={!kind ? 'page' : undefined} className={chip(!kind)}>전체</Link></li>
          {KIND_FILTERS.map((f) => (
            <li key={f.kind}><Link href={href({ status, kind: f.kind })} aria-current={kind === f.kind ? 'page' : undefined} className={chip(kind === f.kind)}>{f.label}</Link></li>
          ))}
        </ul>
      </nav>

      <p className="mt-5 mb-3 text-sm text-gray-600"><b className="font-semibold text-gray-900">{rows.length.toLocaleString()}건</b></p>
      <HousingList rows={rows} now={now} emptyText={status === 'active' ? '지금 접수 중이거나 예정된 공고가 없습니다.' : '최근 마감된 공고가 없습니다.'} />

      <section className="mt-10 border-t pt-6" aria-label="지역별로 보기">
        <h2 className="text-base font-bold">지역별로 보기</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {REGIONS.map((r) => (
            <li key={r.slug}><Link href={`/housing/${r.slug}`} className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 hover:border-brand-400">{r.name}</Link></li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-gray-500">데이터 출처: 한국부동산원 청약홈 분양정보, 한국토지주택공사 분양임대공고 (공공데이터포털). 매일 두 번 동기화합니다.</p>
    </div>
  )
}
