import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SEGMENT_BY_PATH, PUBLIC_SEGMENTS } from '../../../../../data/segments'
import { REGIONS } from '../../../../../data/regions'
import { listBySegment, getRegionMeta } from '@/lib/benefits/queries'
import { regionHubTitle, regionHubDescription, kstYear } from '@/lib/seo/hub-meta'
import { regionHubIndexable } from '@/lib/seo/index-policy'
import { breadcrumbs, itemList } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitList from '@/components/benefits/BenefitList'
import JsonLd from '@/components/JsonLd'

export const revalidate = 21600

export function generateStaticParams() {
  return PUBLIC_SEGMENTS.flatMap((s) => REGIONS.map((r) => ({ segment: s.path, region: r.slug })))
}

async function load(segmentPath: string, regionSlug: string) {
  const seg = SEGMENT_BY_PATH[segmentPath]
  const reg = REGIONS.find((r) => r.slug === regionSlug)
  if (!seg || seg.slug === 'other' || !reg) return null
  // benefits.region_code는 코드가 아니라 slug를 담는다. slug로 조회해야 한다.
  const [rows, meta] = await Promise.all([listBySegment(seg.slug, { region: reg.slug, limit: 60 }), getRegionMeta(reg.slug)])
  return { seg, reg, rows, meta }
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string; region: string }> }): Promise<Metadata> {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) return {}
  const { seg, reg, rows, meta } = data
  // 색인 임계값을 여기서 새로 만들지 않는다. 지역 안내문이 없으면(현재 전 지역) noindex다.
  const indexable = regionHubIndexable({ count: rows.length, description_md: meta?.description_md ?? null })
  return {
    title: regionHubTitle(reg.name, seg.name, kstYear()),
    description: regionHubDescription(reg.name, seg.name, rows.length),
    alternates: { canonical: absoluteUrl(`/${seg.path}/${reg.slug}`) },
    robots: { index: indexable, follow: true },
  }
}

export default async function RegionHubPage({ params }: { params: Promise<{ segment: string; region: string }> }) {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) notFound()
  const { seg, reg, rows, meta } = data
  const now = new Date()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbs([
            { name: '홈', path: '/' },
            { name: seg.name, path: `/${seg.path}` },
            { name: reg.name, path: `/${seg.path}/${reg.slug}` },
          ]),
          itemList(rows.slice(0, 20).map((r) => ({ name: r.title, path: `/benefit/${r.slug}` }))),
        ]}
      />
      <nav className="text-xs text-gray-500" aria-label="현재 위치">홈 › {seg.name} › {reg.name}</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{reg.name} {seg.name} 지원금 {rows.length.toLocaleString()}개</h1>
      {meta?.description_md ? (
        <p className="mt-2 max-w-2xl whitespace-pre-line text-gray-600">{meta.description_md}</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{reg.name} 지자체 지원금과 전국 공통 지원금을 함께 보여줍니다.</p>
      )}
      <section className="mt-6">
        <BenefitList rows={rows} now={now} emptyText={`${reg.name}의 ${seg.name} 지원금이 아직 없습니다. 전국 공통 지원금은 ${seg.name} 페이지에서 확인하세요.`} />
      </section>
    </div>
  )
}
