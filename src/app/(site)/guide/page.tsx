import type { Metadata } from 'next'
import Link from 'next/link'
import { listGuides } from '@/lib/benefits/queries'
import { absoluteUrl } from '@/lib/seo/site'
import { breadcrumbs, itemList } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import AdPlacement from '@/components/benefits/AdPlacement'
import { PUBLIC_SEGMENTS } from '../../../../data/segments'

export const revalidate = 86400

export const metadata: Metadata = {
  title: '지원금 가이드',
  description:
    '지원금 하나를 제대로 받는 데 필요한 것만 정리했습니다. 국토부에서 떨어져도 지자체에서 되는 경우, 기한을 놓쳐 줄어드는 금액처럼 공고문만 봐서는 안 보이는 것들입니다.',
  alternates: { canonical: absoluteUrl('/guide') },
}

/** 가이드의 segment 값(youth 등)을 사람이 읽는 이름으로. 매핑이 없으면 칩을 숨긴다. */
function segmentName(segment: string | null): string | null {
  return PUBLIC_SEGMENTS.find((s) => s.slug === segment)?.name ?? null
}

export default async function GuideIndexPage() {
  const guides = await listGuides()

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbs([
            { name: '홈', path: '/' },
            { name: '가이드', path: '/guide' },
          ]),
          itemList(guides.map((g) => ({ name: g.title, path: `/guide/${g.slug}` }))),
        ]}
      />
      <nav className="text-xs text-gray-500" aria-label="현재 위치">
        홈 › 가이드
      </nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">지원금 가이드</h1>
      <p className="mt-2 text-gray-600">
        공고문을 읽어도 알 수 없는 것들을 정리했습니다. 한 기관에서 떨어져도 다른 기관에서는 자격이 되는 경우, 신청
        순서를 잘못 잡아 금액이 깎이는 경우처럼 실제로 돈이 걸린 부분입니다.
      </p>

      {guides.length === 0 ? (
        <p className="mt-8 rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
          준비 중인 가이드가 곧 올라옵니다.
        </p>
      ) : (
        <ul className="mt-6 divide-y border-y">
          {guides.map((g) => {
            const name = segmentName(g.segment)
            return (
              <li key={g.slug}>
                <Link href={`/guide/${g.slug}`} className="group block py-4">
                  <h2 className="font-bold text-gray-900 group-hover:text-brand-700">{g.title}</h2>
                  <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    {name && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{name}</span>
                    )}
                    <time dateTime={g.published_at}>{g.published_at.slice(0, 10).replace(/-/g, '. ')}</time>
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <AdPlacement slot="list" />
    </div>
  )
}
