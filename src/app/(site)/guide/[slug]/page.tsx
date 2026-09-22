import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGuide } from '@/lib/benefits/queries'
import { absoluteUrl, siteName } from '@/lib/seo/site'
import { article, breadcrumbs } from '@/lib/seo/jsonld'
import { metaDescription } from '@/lib/seo/meta-description'
import JsonLd from '@/components/JsonLd'
import Markdown from '@/components/benefits/Markdown'
import AdPlacement from '@/components/benefits/AdPlacement'

export const revalidate = 86400
export const dynamicParams = true
export function generateStaticParams() { return [] }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const g = await getGuide(decodeURIComponent(slug))
  if (!g || !g.published_at) return {}
  return {
    /*
      검색용 제목이 있으면 그것을 쓰고, 브랜드 접미사도 떼기 위해 absolute로 둔다.
      루트 레이아웃의 template이 ' | 내몫'을 붙이는데, 한글 검색결과가 잘리는 30자 안에서
      브랜드에 5자를 쓰면 정작 클릭 이유인 숫자가 절단선 뒤로 간다. 구글은 사이트명을 제목
      위 줄에 따로 보여주므로 제목 안의 브랜드는 같은 말을 두 번 하는 셈이다.

      화면의 h1은 g.title 그대로다(아래 <h1>). 두 곳을 한 문장으로 겸하던 것을 나눈 것이
      seo_title의 목적이다 — queries.ts의 GuideRow.seo_title 주석 참고.
    */
    title: g.seo_title?.trim() ? { absolute: g.seo_title.trim() } : g.title,
    description: metaDescription(g.body_md),
    alternates: { canonical: absoluteUrl(`/guide/${g.slug}`) },
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const g = await getGuide(decodeURIComponent(slug))
  if (!g || !g.published_at) notFound()
  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {/*
        가이드에는 JSON-LD가 하나도 없었다. 상세(GovernmentService)와 지역 허브(ItemList)에는
        넣었는데, 정작 검색에서 이기려는 페이지가 비어 있었다. Article은 datePublished가 있어야
        구글이 발행 시점을 신뢰한다 — 없으면 크롤 시각을 임의로 쓴다.
      */}
      <JsonLd
        data={[
          breadcrumbs([
            { name: '홈', path: '/' },
            { name: '가이드', path: '/guide' },
            { name: g.title, path: `/guide/${g.slug}` },
          ]),
          article({ title: g.title, slug: g.slug, published_at: g.published_at, updated_at: g.updated_at, publisher: siteName() }),
        ]}
      />
      <nav className="text-xs text-gray-500" aria-label="현재 위치">
        홈 › <Link href="/guide" className="hover:text-brand-700 hover:underline">가이드</Link>
      </nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{g.title}</h1>
      <div className="mt-6"><Markdown text={g.body_md} /></div>
      <AdPlacement slot="detail-2" />
      <p className="mt-10 border-t pt-6">
        <Link href="/guide" className="text-sm font-medium text-brand-700 hover:underline">
          ← 다른 가이드 보기
        </Link>
      </p>
    </article>
  )
}
