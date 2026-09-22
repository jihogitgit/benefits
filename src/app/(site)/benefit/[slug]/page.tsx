import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBenefitBySlug, getGuidesForBenefit, listRelated, listPeers } from '@/lib/benefits/queries'
import { buildChecklist } from '@/lib/benefits/checklist'
import { firstLine, deadlineLabel } from '@/lib/benefits/format'
import { daysUntil } from '@/lib/benefits/status'
import { benefitIndexable } from '@/lib/seo/index-policy'
import { governmentService, breadcrumbs, faqPage } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import { kstYear } from '@/lib/seo/hub-meta'
import { SEGMENT_BY_SLUG, SEGMENT_OTHER } from '../../../../../data/segments'
import { regionName } from '@/components/benefits/BenefitCard'
import DdayBadge from '@/components/benefits/DdayBadge'
import SummaryGrid from '@/components/benefits/SummaryGrid'
import Checklist from '@/components/benefits/Checklist'
import Markdown from '@/components/benefits/Markdown'
import StickyRail from '@/components/benefits/StickyRail'
import SectionNav from '@/components/benefits/SectionNav'
import SourceFooter from '@/components/benefits/SourceFooter'
import AdPlacement from '@/components/benefits/AdPlacement'
import BenefitCard from '@/components/benefits/BenefitCard'
import PeerList from '@/components/benefits/PeerList'
import JsonLd from '@/components/JsonLd'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return [] // 요청 시 생성 (1만 건 전체 빌드는 하지 않음)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const b = await getBenefitBySlug(decodeURIComponent(slug))
  if (!b) return {}
  const indexable = benefitIndexable({ status: b.status, article: b.benefit_articles })
  const desc = [firstLine(b.amount_text, 50), firstLine(b.target_text, 40), deadlineLabel(b)].filter(Boolean).join(' · ').slice(0, 120)
  return {
    title: `${b.title} 자격조건·신청방법 (${kstYear()})`,
    description: desc,
    alternates: { canonical: absoluteUrl(`/benefit/${b.slug}`) },
    robots: { index: indexable, follow: true },
    openGraph: { title: b.title, description: desc, type: 'article' },
  }
}

export default async function BenefitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const b = await getBenefitBySlug(decodeURIComponent(slug))
  if (!b) notFound()

  const now = new Date()
  const seg = SEGMENT_BY_SLUG[b.segments[0] ?? 'other'] ?? SEGMENT_OTHER
  const [related, guides, peers] = await Promise.all([
    listRelated(seg.slug, b.region_code, b.slug, 6),
    getGuidesForBenefit(b.slug),
    listPeers(b.slug),
  ])
  const article = b.benefit_articles
  const published = benefitIndexable({ status: b.status, article })
  const checklist = buildChecklist(b.benefit_conditions, article?.checklist_json ?? null)
  const faq = article?.faq_json ?? []
  const closed = b.status !== 'open'
  const dday = daysUntil(b.apply_end, now)

  const sections = [
    { id: 'summary', label: '한눈에 보기' },
    { id: 'check', label: '대상 체크' },
    ...(article?.explainer_md ? [{ id: 'explainer', label: '해설' }] : [{ id: 'original', label: '원문 안내' }]),
    ...(article?.steps_md ? [{ id: 'steps', label: '신청 순서' }] : []),
    ...(faq.length ? [{ id: 'faq', label: '자주 묻는 질문' }] : []),
    ...(peers ? [{ id: 'peers', label: '다른 지역' }] : []),
    ...(guides.length ? [{ id: 'guides', label: '관련 가이드' }] : []),
    // related가 비면 섹션은 제목만 남는다. 목차 칩이 빈 자리를 가리키지 않게 같은 조건으로 건다.
    ...(related.length ? [{ id: 'related', label: '함께 받는 지원금' }] : []),
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={[
        governmentService({ title: b.title, summary: b.summary, agency: b.agency, region_name: b.region_code === 'ALL' ? null : regionName(b.region_code), apply_url: b.apply_url, slug: b.slug }),
        breadcrumbs([{ name: '홈', path: '/' }, ...(seg.slug !== 'other' ? [{ name: seg.name, path: `/${seg.path}` }] : []), { name: b.title, path: `/benefit/${b.slug}` }]),
        published ? faqPage(faq) : null,
      ]} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0">
          <nav className="text-xs text-gray-500">
            <Link href="/">홈</Link>{seg.slug !== 'other' && <> › <Link href={`/${seg.path}`}>{seg.name}</Link></>}
            {b.region_code !== 'ALL' && seg.slug !== 'other' && <> › <Link href={`/${seg.path}/${b.region_code}`}>{regionName(b.region_code)}</Link></>}
          </nav>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{b.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
            <DdayBadge deadline_type={b.deadline_type} apply_end={b.apply_end} now={now} />
            <span>{regionName(b.region_code)}</span>
            {seg.slug !== 'other' && <span>· {seg.name}</span>}
            {article?.review_status === 'stale' && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">내용 확인 중</span>}
          </div>

          {/* 첫 화면에서 이 글에 무엇이 들어있는지 보이게 한다. PC는 우측 StickyRail이 같은 역할을 한다. */}
          <SectionNav sections={sections} />

          {closed && (
            <div className="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
              이 지원금은 마감되었거나 원천에서 내려갔습니다. 다음 공고가 올라오면 이 페이지에서 갱신됩니다. 아래 &ldquo;함께 받을 수 있는 지원금&rdquo;을 확인해 보세요.
            </div>
          )}

          <div id="summary" className="mt-5"><SummaryGrid b={b} /></div>

          <div className="mt-5"><Checklist items={checklist} cond={b.benefit_conditions} /></div>

          <AdPlacement slot="detail-1" />

          {article?.explainer_md ? (
            <section id="explainer" className="mt-2">
              <h2 className="mb-2 text-lg font-bold">쉽게 풀어쓴 해설</h2>
              <Markdown text={article.explainer_md} />
            </section>
          ) : (
            <section id="original" className="mt-2 space-y-4">
              <h2 className="text-lg font-bold">원문 안내</h2>
              {b.target_text && <div><h3 className="text-sm font-semibold text-gray-500">지원 대상</h3><p className="whitespace-pre-line text-[15px] leading-7">{b.target_text}</p></div>}
              {b.criteria_text && <div><h3 className="text-sm font-semibold text-gray-500">선정 기준</h3><p className="whitespace-pre-line text-[15px] leading-7">{b.criteria_text}</p></div>}
              {b.amount_text && <div><h3 className="text-sm font-semibold text-gray-500">지원 내용</h3><p className="whitespace-pre-line text-[15px] leading-7">{b.amount_text}</p></div>}
            </section>
          )}

          {article?.steps_md && (
            <section id="steps" className="mt-8">
              <h2 className="mb-2 text-lg font-bold">신청 순서</h2>
              <Markdown text={article.steps_md} />
            </section>
          )}

          {b.apply_method && !article?.steps_md && (
            <p className="mt-6 text-sm text-gray-700"><span className="font-semibold">신청 방법:</span> {b.apply_method.replace(/\|\|/g, ', ')}{b.contact ? ` · 문의 ${b.contact.replace(/\|\|/g, ', ')}` : ''}</p>
          )}

          {faq.length > 0 && (
            <section id="faq" className="mt-8">
              <h2 className="mb-2 text-lg font-bold">자주 묻는 질문</h2>
              <dl className="divide-y rounded-xl border bg-white">
                {faq.map((f, i) => (
                  <div key={i} className="p-4">
                    <dt className="font-semibold">Q. {f.q}</dt>
                    <dd className="mt-1 text-[15px] leading-7 text-gray-700">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/*
            같은 이름의 사업을 다른 지자체도 한다. 독자가 이 페이지에서 실제로 알고 싶은 것은
            "우리 동네는 얼마인가"인데, 지금까지는 같은 사업 수십 건이 서로를 모른 채 흩어져
            있었다. 묶는 규칙과 그 한계는 lib/benefits/peer-group.ts에 있다.
          */}
          {peers && peers.items.length > 0 && (
          <section id="peers" className="mt-8">
            <h2 className="mb-1 text-lg font-bold">같은 사업을 하는 다른 지역</h2>
            <p className="mb-3 text-sm text-gray-600">
              이름은 같아도 지자체마다 금액과 조건이 다릅니다. 해당 지역 페이지에서 확인하세요.
            </p>
            <PeerList items={peers.items} />
            <Link href={`/compare/${encodeURIComponent(peers.key)}`} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
              이 사업을 하는 지자체 한눈에 보기 →
            </Link>
          </section>
          )}

          {guides.length > 0 && (
          <section id="guides" className="mt-8">
            <h2 className="mb-3 text-lg font-bold">이 지원금을 다룬 가이드</h2>
            <ul className="space-y-2">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/guide/${g.slug}`}
                    className="block rounded-xl border border-gray-200 px-4 py-3 text-[15px] font-semibold text-gray-900 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          )}

          <AdPlacement slot="detail-2" />

          {related.length > 0 && (
          <section id="related" className="mt-2">
            <h2 className="mb-3 text-lg font-bold">함께 받을 수 있는 지원금</h2>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {related.map((r) => <div key={r.slug} className="w-[78%] shrink-0 snap-start sm:w-auto"><BenefitCard row={r} now={now} /></div>)}
            </div>
          </section>
          )}

          <SourceFooter source={b.source} agency={b.agency} syncedAt={b.synced_at} sourceUpdatedAt={b.source_updated_at} applyUrl={b.apply_url} evidence={b.alt_sources} />
        </article>

        {/* 모바일 하단 바와 같은 기준으로 숨긴다. 한쪽만 숨기면 뷰포트에 따라 안내가 모순된다. */}
        <StickyRail applyUrl={closed ? null : b.apply_url} sections={sections} />
      </div>

      {b.apply_url && !closed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 backdrop-blur lg:hidden">
          <a href={b.apply_url} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-brand-600 py-3 text-center font-bold text-white">
            공식 사이트에서 신청 →{dday !== null && dday >= 0 ? ` (D-${dday})` : ''}
          </a>
        </div>
      )}
      <div className="h-20 lg:hidden" />
    </div>
  )
}
