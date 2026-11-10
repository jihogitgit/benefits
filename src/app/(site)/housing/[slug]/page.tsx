import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listHousing, getHousingBySlug, countActiveHousingByRegion, HOUSING_LIST_LIMIT } from '@/lib/housing/queries'
import { housingRegionIndexable } from '@/lib/seo/index-policy'
import { KIND_LABEL, STATUS_LABEL } from '@/lib/housing/labels'
import { kstYear } from '@/lib/seo/hub-meta'
import { absoluteUrl } from '@/lib/seo/site'
import { breadcrumbs } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import HousingList from '@/components/housing/HousingList'
import HousingSchedule from '@/components/housing/HousingSchedule'
import UnitTypeTable from '@/components/housing/UnitTypeTable'
import DdayBadge from '@/components/benefits/DdayBadge'
import { regionName } from '@/components/benefits/BenefitCard'
import { REGIONS } from '../../../../../data/regions'

/**
 * /housing/[slug]는 두 종류를 받는다 — REGIONS의 영문 slug면 지역 목록, 아니면 공고 상세.
 * 공고 slug는 housingSlugBase가 지역 slug와 겹치지 않게 만든다(sync/housing-normalize.ts).
 *
 * ISR은 두 종류 중 짧은 쪽(지역 목록, 하루)으로 맞춘다. 상세의 조회 캐시는 일주일(housing:<slug>)이라
 * 페이지가 하루마다 다시 그려져도 DB는 건드리지 않는다.
 */
export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() {
  return REGIONS.map((r) => ({ slug: r.slug }))
}

const region = (slug: string) => REGIONS.find((r) => r.slug === slug) ?? null

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug)
  const reg = region(slug)
  if (reg) {
    const counts = await countActiveHousingByRegion()
    return {
      title: `${kstYear()} ${reg.name} 청약·임대 공고 · 접수중·접수 예정`,
      description: `${reg.name}에서 접수 중이거나 예정된 아파트 분양·무순위·LH 임대 공고를 접수 일정 순으로 모았습니다. 전국 공통 공고도 함께 보여줍니다.`,
      alternates: { canonical: absoluteUrl(`/housing/${reg.slug}`) },
      robots: { index: housingRegionIndexable({ activeCount: counts[reg.slug] ?? 0 }), follow: true },
    }
  }
  const d = await getHousingBySlug(slug)
  if (!d) return {}
  return {
    title: `${d.title} 청약 일정·공급 내역`,
    description: [KIND_LABEL[d.kind], (d.region_code !== 'UNKNOWN' && regionName(d.region_code)) || '지역 미상', d.total_units ? `${d.total_units}세대` : null, d.receipt_start ? `접수 ${d.receipt_start.replace(/-/g, '.')}부터` : null].filter(Boolean).join(' · '),
    alternates: { canonical: absoluteUrl(`/housing/${d.slug}`) },
    // 공고 상세는 원문을 옮긴 페이지라 색인하지 않는다(설계 5절). 해설이 붙으면 그때 연다.
    robots: { index: false, follow: true },
  }
}

export default async function HousingSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug)
  const reg = region(slug)
  if (reg) return <RegionPage slug={reg.slug} name={reg.name} />
  const d = await getHousingBySlug(slug)
  if (!d) notFound()
  const now = new Date()
  const closed = d.status === 'closed' || d.status === 'removed'

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '청약·임대 공고', path: '/housing' }, { name: d.title, path: `/housing/${d.slug}` }])} />
      <nav className="text-xs text-gray-500" aria-label="현재 위치">
        <Link href="/" className="hover:underline">홈</Link> › <Link href="/housing" className="hover:underline">청약·임대 공고</Link>
        {d.region_code !== 'ALL' && d.region_code !== 'UNKNOWN' && <> › <Link href={`/housing/${d.region_code}`} className="hover:underline">{regionName(d.region_code)}</Link></>}
      </nav>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{d.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
        {d.status === 'open' && d.receipt_end ? <DdayBadge deadline_type="period" apply_end={d.receipt_end} now={now} /> : <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">{STATUS_LABEL[d.status]}</span>}
        <span>{(d.region_code !== 'UNKNOWN' && regionName(d.region_code)) || '지역 미상'}</span>
        <span>· {KIND_LABEL[d.kind]}</span>
        {d.kind_detail && <span>· {d.kind_detail}</span>}
      </div>

      {closed && (
        <div className="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
          이 공고는 접수가 끝났거나 원천에서 내려갔습니다. <Link href="/housing" className="font-semibold text-brand-700 hover:underline">접수 중인 공고 보기 →</Link>
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-bold">한눈에 보기</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {d.total_units != null && <div className="rounded-xl border bg-white p-3"><dt className="text-gray-500">공급 세대</dt><dd className="mt-0.5 font-semibold">{d.total_units.toLocaleString()}세대</dd></div>}
          {d.address && <div className="col-span-2 rounded-xl border bg-white p-3"><dt className="text-gray-500">위치</dt><dd className="mt-0.5 font-semibold">{d.address}</dd></div>}
          {d.supplier && <div className="rounded-xl border bg-white p-3"><dt className="text-gray-500">사업주체</dt><dd className="mt-0.5 font-semibold">{d.supplier}</dd></div>}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-bold">일정</h2>
        <HousingSchedule d={d} />
        <p className="mt-2 text-xs text-gray-500">1·2순위는 해당지역·기타지역 접수일 중 가장 이른 날부터 가장 늦은 날까지로 표시합니다. 정확한 일정은 모집공고문을 확인하세요.</p>
      </section>

      {d.housing_unit_types.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-bold">주택형별 공급 내역</h2>
          <UnitTypeTable rows={d.housing_unit_types} />
        </section>
      )}

      <footer className="mt-8 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
        <p>출처: 한국부동산원 청약홈 분양정보(공공데이터포털) · 최종 확인 {d.synced_at.slice(0, 10).replace(/-/g, '.')}</p>
        {d.detail_url && (
          <p className="mt-1"><a href={d.detail_url} target="_blank" rel="noopener noreferrer" className="underline">공고 원문·사업주체 홈페이지 보기<span className="sr-only">(새 창)</span></a></p>
        )}
        <p className="mt-1">청약 신청은 <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener noreferrer" className="underline">청약홈<span className="sr-only">(새 창)</span></a>에서 합니다. 이 페이지는 일정과 공급 내역만 정리하며 자격을 판정하지 않습니다.</p>
      </footer>
    </div>
  )
}

async function RegionPage({ slug, name }: { slug: string; name: string }) {
  const now = new Date()
  const [rows, counts] = await Promise.all([listHousing({ status: 'active', kind: null, region: slug, limit: HOUSING_LIST_LIMIT }), countActiveHousingByRegion()])
  const local = rows.filter((r) => r.region_code === slug)
  const national = rows.filter((r) => r.region_code === 'ALL')
  const siblings = REGIONS.filter((r) => (counts[r.slug] ?? 0) > 0)
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '청약·임대 공고', path: '/housing' }, { name, path: `/housing/${slug}` }])} />
      <nav className="text-xs text-gray-500" aria-label="현재 위치"><Link href="/" className="hover:underline">홈</Link> › <Link href="/housing" className="hover:underline">청약·임대 공고</Link> › {name}</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{name} 청약·임대 공고 <span className="text-lg font-semibold text-gray-500">{local.length}건</span></h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">{name}에서 접수 중이거나 예정된 공고입니다. 전국 어디서나 신청할 수 있는 공고는 아래에 따로 보여줍니다.</p>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">{name} 공고</h2>
        <HousingList rows={local} now={now} emptyText={national.length > 0 ? `지금 접수 중인 ${name} 공고가 없습니다. 아래 전국 공통 공고를 확인하세요.` : `지금 접수 중인 ${name} 공고가 없습니다.`} />
      </section>

      {national.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">전국 공통 공고 <span className="text-sm font-normal text-gray-500">{national.length}건</span></h2>
          <HousingList rows={national} now={now} />
        </section>
      )}

      {siblings.length > 1 && (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">다른 지역</h2>
          <nav className="flex flex-wrap gap-2" aria-label="다른 지역 공고">
            {siblings.map((r) =>
              r.slug === slug ? (
                <span key={r.slug} aria-current="page" className="rounded-full border border-brand-600 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800">{r.name}</span>
              ) : (
                <Link key={r.slug} href={`/housing/${r.slug}`} className="rounded-full border bg-white px-3 py-1.5 text-sm hover:border-brand-400">{r.name} <span className="text-gray-400">{counts[r.slug]}</span></Link>
              ),
            )}
          </nav>
        </section>
      )}
    </div>
  )
}
