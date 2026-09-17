import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEGMENT_BY_PATH, PUBLIC_SEGMENTS } from '../../../../data/segments'
import { REGIONS } from '../../../../data/regions'
import { SEGMENT_FAQ } from '../../../../data/segment-faq'
import { listBySegment, countByRegion, listWithArticles } from '@/lib/benefits/queries'
import { hubTitle, hubDescription, kstYear } from '@/lib/seo/hub-meta'
import { breadcrumbs, itemList, faqPage } from '@/lib/seo/jsonld'
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
  const [rows, counts, explained] = await Promise.all([
    listBySegment(seg.slug, { limit: 40 }),
    countByRegion(seg.slug),
    listWithArticles(seg.slug, 8),
  ])
  const total = totalOf(counts)
  // 해설 목록에 이미 올린 건은 아래 마감 임박 목록에서 뺀다. 해설이 붙은 제도는 '대부분' 상시라
  // 평소엔 겹치지 않지만, deadline_type은 동기화마다 바뀔 수 있어 한 페이지에 같은 카드가
  // 두 번 나올 수 있다.
  const explainedSlugs = new Set(explained.map((e) => e.slug))
  const deadlineRows = rows.filter((r) => !explainedSlugs.has(r.slug))
  // 소관기관명이 통합 표기된 지역(예: 광주)은 실데이터 건수가 0에 가깝다. 0건인 지역 칩은
  // 빈 페이지로 가는 죽은 링크가 되므로 렌더하지 않는다(색인 여부는 regionHubIndexable이 따로 판단).
  const regions = REGIONS.filter((r) => (counts[r.slug] ?? 0) > 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbs([{ name: '홈', path: '/' }, { name: seg.name, path: `/${seg.path}` }]),
          // 해설 있는 건을 앞에 둔다. 이 페이지가 링크하는 목록과 구조화 데이터가 어긋나면
          // 정작 색인시키려는 페이지가 ItemList에서 빠진다.
          itemList([...explained, ...deadlineRows].slice(0, 20).map((r) => ({ name: r.title, path: `/benefit/${r.slug}` }))),
          faqPage(SEGMENT_FAQ[seg.slug] ?? []),
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
              <Link key={r.slug} href={`/${seg.path}/${r.slug}`} className="rounded-full border bg-white px-3 py-1.5 text-sm hover:border-brand-400">
                {r.name} <span className="text-gray-400">{((counts[r.slug] ?? 0) + (counts.ALL ?? 0)).toLocaleString()}</span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      {/* 마감 임박 목록보다 먼저 놓는다. 해설이 붙은 제도는 대부분 상시 접수라 마감 정렬에서는
          맨 끝으로 밀려 40개 안에 들어오지 못한다(listWithArticles 주석 참고). 사이트에서 본문이
          가장 충실한 페이지들이므로 허브에서 여기로 내부 링크가 이어져야 한다. */}
      {explained.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-bold">자세히 정리한 지원금</h2>
          <p className="mb-3 text-sm text-gray-500">신청 방법과 자격 요건을 직접 확인해 정리한 제도입니다.</p>
          <BenefitList rows={explained} now={now} showAd={false} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">마감 임박 순</h2>
        <BenefitList rows={deadlineRows} now={now} />
      </section>
      {/* 목록은 limit으로 잘린다. 제목의 전체 건수와 카드 수가 다르면 사용자가 누락을 의심하므로
          잘렸다는 사실과 정렬 기준을 밝히고, 나머지를 찾는 경로(조건 진단)로 이어준다. */}
      {total > deadlineRows.length && (
        <p className="mt-4 text-sm text-gray-500">
          마감이 가까운 {deadlineRows.length.toLocaleString()}개를 먼저 보여줍니다. 나머지는{' '}
          <Link href="/" className="font-semibold text-brand-700 hover:underline">조건 진단</Link>
          으로 좁혀서 찾아보세요.
        </p>
      )}

      {(SEGMENT_FAQ[seg.slug] ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">{seg.name} 지원금 자주 묻는 질문</h2>
          <dl className="divide-y rounded-xl border bg-white">
            {(SEGMENT_FAQ[seg.slug] ?? []).map((f) => (
              <div key={f.q} className="p-4">
                <dt className="font-semibold">Q. {f.q}</dt>
                <dd className="mt-1 text-[15px] leading-7 text-gray-700">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  )
}
