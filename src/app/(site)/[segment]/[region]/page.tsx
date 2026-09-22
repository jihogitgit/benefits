import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEGMENT_BY_PATH, PUBLIC_SEGMENTS } from '../../../../../data/segments'
import { REGIONS } from '../../../../../data/regions'
import { listBySegment, countByRegion, getRegionMeta, listGuides } from '@/lib/benefits/queries'
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
  const [localRows, nationalRows, counts, meta, allGuides] = await Promise.all([
    listBySegment(seg.slug, { region: reg.slug, limit: LOCAL_LIMIT, regionOnly: true }),
    listBySegment(seg.slug, { region: 'ALL', limit: NATIONAL_LIMIT, regionOnly: true }),
    countByRegion(seg.slug),
    getRegionMeta(reg.slug),
    listGuides(),
  ])
  // 제목에 rows.length를 쓰면 limit이 그대로 건수로 나가 사실과 다른 숫자를 보여준다.
  // countByRegion은 이미 페이징·캐시되어 있으므로 그것으로 실제 건수를 만든다.
  const localTotal = counts[reg.slug] ?? 0
  const nationalTotal = counts.ALL ?? 0
  const guides = allGuides.filter((g) => g.segment === seg.slug)
  return { seg, reg, localRows, nationalRows, localTotal, nationalTotal, total: localTotal + nationalTotal, meta, counts, guides }
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string; region: string }> }): Promise<Metadata> {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) return {}
  const { seg, reg, localTotal, nationalTotal, meta } = data
  // 색인 임계값을 여기서 새로 만들지 않는다. 판정 대상은 '그 지역에만 있는' 건수다(전국분 제외).
  const indexable = regionHubIndexable({ localCount: localTotal, description_md: meta?.description_md ?? null })
  return {
    title: regionHubTitle(reg.name, seg.name, kstYear()),
    // 스니펫도 색인 판정과 같은 것을 앞세운다 — 그 지역에만 있는 건수.
    // 전국 공통을 앞에 두면 46장이 서로 구별되지 않는다(hub-meta.ts 주석 참고).
    description: regionHubDescription({
      regionName: reg.name,
      segmentName: seg.name,
      localCount: localTotal,
      nationalCount: nationalTotal,
    }),
    alternates: { canonical: absoluteUrl(`/${seg.path}/${reg.slug}`) },
    robots: { index: indexable, follow: true },
  }
}

export default async function RegionHubPage({ params }: { params: Promise<{ segment: string; region: string }> }) {
  const { segment, region } = await params
  const data = await load(segment, region)
  if (!data) notFound()
  const { seg, reg, localRows, nationalRows, localTotal, nationalTotal, total, meta, counts, guides } = data
  const now = new Date()
  // 색인되는 지역 허브 46개가 서로 연결되지 않으면 크롤러도 사용자도 매번 분야 허브를 거쳐야 한다.
  // 건수 0인 지역은 빈 페이지로 가는 죽은 링크라 제외한다(분야 허브의 지역 칩과 같은 규칙).
  const siblings = REGIONS.filter((r) => (counts[r.slug] ?? 0) > 0)

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

      {/*
        가이드로 가는 링크. 지역 허브 46장은 색인 대상인데 가이드를 한 곳도 걸지 않아,
        /benefit 링크 60개(대부분 색인되지 않는 상세)만 내보내고 있었다. 정작 검색에서
        순위를 다투는 페이지로는 크롤러도 독자도 넘어갈 길이 없었다 — 분야 허브와 홈에만
        있었다. 상세 → 가이드 방향은 guide-backlinks가 이미 잇고 있다.

        지역이 달라도 목록은 같다. 가이드는 제도를 설명하는 글이라 지역별로 갈리지 않는데,
        여기서 지역에 맞춰 골라내려면 가이드 본문이 어느 지역을 다루는지 따로 적어야 하고
        그러면 어긋남을 관리할 표가 하나 더 생긴다(guide-backlinks.ts 주석과 같은 이유).
      */}
      {guides.length > 0 && (
        <section id="guides" className="mt-10">
          <h2 className="mb-1 text-lg font-bold">{seg.name} 지원금 가이드</h2>
          <p className="mb-3 text-sm text-gray-500">한 제도만 봐서는 알 수 없는 것들을 정리했습니다.</p>
          <ul className="divide-y border-y">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/guide/${g.slug}`} className="block py-3 text-sm font-medium text-gray-900 hover:text-brand-700">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            <Link href="/guide" className="text-sm font-medium text-brand-700 hover:underline">가이드 전체 보기 →</Link>
          </p>
        </section>
      )}

      {siblings.length > 1 && (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">다른 지역 {seg.name} 지원금</h2>
          <nav className="flex flex-wrap gap-2" aria-label={`다른 지역 ${seg.name} 지원금`}>
            {siblings.map((r) =>
              r.slug === reg.slug ? (
                <span key={r.slug} aria-current="page" className="rounded-full border border-brand-600 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800">
                  {r.name}
                </span>
              ) : (
                <Link key={r.slug} href={`/${seg.path}/${r.slug}`} className="rounded-full border bg-white px-3 py-1.5 text-sm hover:border-brand-400">
                  {r.name} <span className="text-gray-400">{(counts[r.slug] ?? 0).toLocaleString()}</span>
                </Link>
              ),
            )}
          </nav>
        </section>
      )}

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
