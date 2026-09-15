import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGuide } from '@/lib/benefits/queries'
import { absoluteUrl } from '@/lib/seo/site'
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
  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{g.title}</h1>
      <div className="mt-6"><Markdown text={g.body_md} /></div>
      <AdPlacement slot="detail-2" />
    </article>
  )
}
