import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEGMENT_BY_PATH, PUBLIC_SEGMENTS } from '../../../../../data/segments'
import { REGIONS } from '../../../../../data/regions'
import { listBySegment, countByRegion, getRegionMeta } from '@/lib/benefits/queries'
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

const LOCAL_LIMIT = 40
const NATIONAL_LIMIT = 20

async function load(segmentPath: string, regionSlug: string) {
  const seg = SEGMENT_BY_PATH[segmentPath]
  const reg = REGIONS.find((r) => r.slug === regionSlug)
  if (!seg || seg.slug === 'other' || !reg) return null
  // benefits.region_code는 코드가 아니라 slug를 담는다. slug로 조회해야 한다.
  // 지역 전용과 전국 공통을 따로 가져온다. 하나로 섞어 limit을 걸면 마감일 순 정렬 때문에
  // 지역 전용이 통째로 밀려날 수 있고, 그러면 페이지가 다른 지역과 구별되지 않는다.
  const [localRows, nationalRows, counts, meta] = await Promise.all([
    listBySegment(seg.slug, { region: reg.slug, limit: LOCAL_LIMIT, regionOnly: true }),
    listBySegment(seg.slug, { region: 'ALL', limit: NATIONAL_LIMIT, regionOnly: true }),
    countByRegion(seg.slug),
    getRegionMeta(reg.slug),
  ])
  // 제목에 rows.length를 쓰면 limit이 그대로 건수로 나가 사실과 다른 숫자를 보여준다.
  // countByRegion은 이미 페이징·캐시되어 있으므로 그것으로 실제 건수를 만든다.
  const localTotal = counts[reg.slug] ?? 0
  const nationalTotal = counts.ALL ?? 0
  return { seg, reg, localRows, nationalRows, localTotal, nationalTotal, total: localTotal + nationalTotal, meta }
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string; region: string }> }): Promise<Metadata> {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) return {}
  const { seg, reg, localTotal, total, meta } = data
  // 색인 임계값을 여기서 새로 만들지 않는다. 판정 대상은 '그 지역에만 있는' 건수다(전국분 제외).
  const indexable = regionHubIndexable({ localCount: localTotal, description_md: meta?.description_md ?? null })
  return {
    title: regionHubTitle(reg.name, seg.name, kstYear()),
    description: regionHubDescription(reg.name, seg.name, total),
    alternates: { canonical: absoluteUrl(`/${seg.path}/${reg.slug}`) },
    robots: { index: indexable, follow: true },
  }
}

export default async function RegionHubPage({ params }: { params: Promise<{ segment: string; region: string }> }) {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) notFound()
  const { seg, reg, localRows, nationalRows, localTotal, nationalTotal, total, meta } = data
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
          // 이 페이지를 대표하는 건 지역 전용 항목이다. 전국 공통은 모든 지역 페이지에 같이 실린다.
          itemList(localRows.slice(0, 20).map((r) => ({ name: r.title, path: `/benefit/${r.slug}` }))),
        ]}
      />
      <nav className="text-xs text-gray-500" aria-label="현재 위치">홈 › {seg.name} › {reg.name}</nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{reg.name} {seg.name} 지원금 {total.toLocaleString()}개</h1>
      {meta?.description_md ? (
        <p className="mt-2 max-w-2xl whitespace-pre-line text-gray-600">{meta.description_md}</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{reg.name} 지자체 지원금과 전국 공통 지원금을 함께 보여줍니다.</p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">
          {reg.name}에만 있는 지원금 <span className="text-sm font-normal text-gray-500">{localTotal.toLocaleString()}개</span>
        </h2>
        <BenefitList
          rows={localRows}
          now={now}
          emptyText={`${reg.name} 지자체가 따로 운영하는 ${seg.name} 지원금은 아직 없습니다. 아래 전국 공통 지원금을 확인하세요.`}
        />
        {/* 목록은 limit으로 잘린다. 제목의 전체 건수와 카드 수가 다르면 사용자가 누락을 의심하므로
            잘렸다는 사실과 정렬 기준을 밝히고, 나머지를 찾는 경로(조건 진단)로 이어준다. */}
        {localTotal > localRows.length && (
          <p className="mt-4 text-sm text-gray-500">
            마감이 가까운 {localRows.length.toLocaleString()}개를 먼저 보여줍니다. 나머지는{' '}
            <Link href="/" className="font-semibold text-brand-700 hover:underline">조건 진단</Link>
            으로 좁혀서 찾아보세요.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold">
          전국 어디서나 받을 수 있는 지원금 <span className="text-sm font-normal text-gray-500">{nationalTotal.toLocaleString()}개</span>
        </h2>
        <BenefitList rows={nationalRows} now={now} emptyText={`전국 공통 ${seg.name} 지원금이 없습니다.`} />
        {nationalTotal > nationalRows.length && (
          <p className="mt-4 text-sm text-gray-500">
            마감이 가까운 {nationalRows.length.toLocaleString()}개만 보여줍니다. 전체는{' '}
            <Link href={`/${seg.path}`} className="font-semibold text-brand-700 hover:underline">{seg.name} 페이지</Link>
            에서 확인하세요.
          </p>
        )}
      </section>
    </div>
  )
}
