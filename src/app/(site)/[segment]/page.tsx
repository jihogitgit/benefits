import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEGMENT_BY_PATH, PUBLIC_SEGMENTS } from '../../../../data/segments'
import { REGIONS } from '../../../../data/regions'
import { listBySegment, countByRegion } from '@/lib/benefits/queries'
import { hubTitle, hubDescription, kstYear } from '@/lib/seo/hub-meta'
import { breadcrumbs, itemList } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitList from '@/components/benefits/BenefitList'
import JsonLd from '@/components/JsonLd'

export const revalidate = 3600

export function generateStaticParams() {
  return PUBLIC_SEGMENTS.map((s) => ({ segment: s.path }))
}

function totalOf(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }): Promise<Metadata> {
  const { segment } = await params
  const seg = SEGMENT_BY_PATH[segment]
  if (!seg || seg.slug === 'other') return {}
  const counts = await countByRegion(seg.slug)
  return {
    title: hubTitle(seg.name, kstYear()),
    description: hubDescription(seg.name, totalOf(counts)),
    alternates: { canonical: absoluteUrl(`/${seg.path}`) },
  }
}

export default async function SegmentHubPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params
  const seg = SEGMENT_BY_PATH[segment]
  if (!seg || seg.slug === 'other') notFound()

  const now = new Date()
  const [rows, counts] = await Promise.all([listBySegment(seg.slug, { limit: 40 }), countByRegion(seg.slug)])
  const total = totalOf(counts)
  // 소관기관명이 통합 표기된 지역(예: 광주)은 실데이터 건수가 0에 가깝다. 0건인 지역 칩은
  // 빈 페이지로 가는 죽은 링크가 되므로 렌더하지 않는다(색인 여부는 regionHubIndexable이 따로 판단).
  const regions = REGIONS.filter((r) => (counts[r.slug] ?? 0) > 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbs([{ name: '홈', path: '/' }, { name: seg.name, path: `/${seg.path}` }]),
          itemList(rows.slice(0, 20).map((r) => ({ name: r.title, path: `/benefit/${r.slug}` }))),
        ]}
      />
      <nav className="text-xs text-gray-500" aria-label="현재 위치">홈 › {seg.name}</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{seg.name} 지원금 {total.toLocaleString()}개</h1>
      <p className="mt-2 max-w-2xl text-gray-600">{seg.description_md}</p>

      {regions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">지역별로 보기</h2>
          <nav className="flex flex-wrap gap-2" aria-label="지역별로 보기">
            {regions.map((r) => (
              <Link key={r.slug} href={`/${seg.path}/${r.slug}`} className="rounded-full border bg-white px-3 py-1.5 text-sm hover:border-indigo-400">
                {r.name} <span className="text-gray-400">{((counts[r.slug] ?? 0) + (counts.ALL ?? 0)).toLocaleString()}</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">마감 임박 순</h2>
        <BenefitList rows={rows} now={now} />
      </section>
    </div>
  )
}
