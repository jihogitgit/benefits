import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGuide } from '@/lib/benefits/queries'
import { absoluteUrl, siteName } from '@/lib/seo/site'
import { breadcrumbs } from '@/lib/seo/jsonld'
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
  return { title: g.title, description: g.body_md.slice(0, 120).replace(/\s+/g, ' '), alternates: { canonical: absoluteUrl(`/guide/${g.slug}`) } }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const g = await getGuide(decodeURIComponent(slug))
  if (!g || !g.published_at) notFound()
  const url = absoluteUrl(`/guide/${g.slug}`)
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
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: g.title,
            mainEntityOfPage: { '@type': 'WebPage', '@id': url },
            url,
            ...(g.published_at ? { datePublished: g.published_at, dateModified: g.published_at } : {}),
            author: { '@type': 'Organization', name: siteName() },
            publisher: { '@type': 'Organization', name: siteName() },
            inLanguage: 'ko',
          },
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
