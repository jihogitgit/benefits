import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { searchBenefits } from '@/lib/benefits/search'
import { LIFE_EVENTS, LIFE_EVENT_BY_SLUG } from '../../../../../data/life-events'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitCard from '@/components/benefits/BenefitCard'
import type { BenefitListRow } from '@/lib/benefits/queries'
import { breadcrumbs } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'

export const revalidate = 3600

export function generateStaticParams() {
  return LIFE_EVENTS.map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const e = LIFE_EVENT_BY_SLUG[slug]
  if (!e) return {}
  return {
    title: e.title,
    description: e.description,
    alternates: { canonical: absoluteUrl(`/life/${e.slug}`) },
  }
}

const LIST_LIMIT = 8

export default async function LifeEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const e = LIFE_EVENT_BY_SLUG[slug]
  if (!e) notFound()

  // 진단과 같은 어휘(situations)로 찾는다. 낱말 맞히기가 아니라 조건 매칭이라,
  // 여기서 넘어간 사용자가 홈에서 조건을 다시 고를 필요가 없다.
  const { total, items } = await searchBenefits(createAdminClient(), {
    q: '',
    ageBand: null,
    situations: e.situations,
    region: null,
    incomeBand: null,
    countOnly: false,
    limit: LIST_LIMIT,
    offset: 0,
  })

  const params$ = new URLSearchParams()
  if (e.situations.length) params$.set('situations', e.situations.join(','))
  const myHref = `/my${params$.toString() ? `?${params$.toString()}` : ''}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '생애 이벤트', path: '/life' }, { name: e.title, path: `/life/${e.slug}` }])} />

      <p className="text-sm text-gray-600">
        <Link href="/life" className="hover:underline">생애 이벤트</Link>
      </p>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{e.title}</h1>
      <p className="mt-2 max-w-2xl text-gray-600">{e.description}</p>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold">순서대로 할 것</h2>
        <ol className="mt-3 space-y-3">
          {e.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold tabular-nums text-white">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-gray-800">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-gray-500">
          금액과 기한은 공고마다 다릅니다. 각 지원금 페이지에서 확인하세요.
        </p>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">해당하는 지원금</h2>
          <Link href={myHref} className="text-sm text-brand-700 hover:underline">
            {total.toLocaleString()}개 전체 보기
          </Link>
        </div>
        {items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((r) => (
              <BenefitCard key={r.slug} row={r as unknown as BenefitListRow} now={new Date()} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">지금 조회되는 항목이 없습니다.</p>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-700">
          나이·지역까지 넣으면 더 좁혀집니다. 소득 기준이 걸리는 사업이 많아{' '}
          <Link href="/median-income" className="font-medium text-brand-700 hover:underline">
            중위소득 계산기
          </Link>
          를 먼저 보는 것도 방법입니다.
        </p>
      </section>
    </div>
  )
}
