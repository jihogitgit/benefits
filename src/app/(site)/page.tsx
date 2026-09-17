import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'
import DiagnosisPanel from '@/components/diagnosis/DiagnosisPanel'
import BenefitCard from '@/components/benefits/BenefitCard'
import AdPlacement from '@/components/benefits/AdPlacement'
import { listDeadlineSoon, listRecentlyUpdated, getLastSyncAt, listWithArticles, listGuides } from '@/lib/benefits/queries'
import { formatKstDate } from '@/lib/benefits/format'
import { absoluteUrl } from '@/lib/seo/site'
import { PUBLIC_SEGMENTS } from '../../../data/segments'

export const revalidate = 3600

// 루트 레이아웃의 './' 기본값을 홈에서만 명시값으로 덮는다. 홈은 revalidate로 서버에서 다시
// 렌더되는데, 그때 Next가 받는 경로가 '/'가 아니라 '/index'라서 './'가 naemok.com/index로
// 풀린다. 존재하지 않는 URL을 정본으로 선언하게 되고, 빌드 시점 HTML에는 나타나지 않아
// 로컬·프리뷰에서는 보이지 않는다(프로덕션 도메인에서 실측으로 발견).
export const metadata: Metadata = { alternates: { canonical: absoluteUrl('/') } }

export default async function HomePage() {
  // listDeadlineSoon/listRecentlyUpdated는 현재 시각을 인자로 받지 않는다(unstable_cache 키 오염 방지).
  // D-day 표시용 기준 시각만 여기서 한 번 만들어 카드에 내려준다.
  const now = new Date()
  const [soon, recent, lastSync, explained, guides] = await Promise.all([
    listDeadlineSoon(14, 8),
    listRecentlyUpdated(48, 8),
    getLastSyncAt(),
    listWithArticles(null, 6),
    listGuides(),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <DiagnosisPanel />

      <AdPlacement slot="home" />

      {/* 홈에서 해설 페이지로 가는 유일한 경로. 카드 대신 한 줄로 두어 진단 CTA를 밀지 않으면서,
          사이트에서 가장 권위가 높은 홈에서 상세로 직접 링크가 가게 한다. 이 링크가 없으면
          해설 페이지는 사이트맵에만 존재하는 고아 페이지가 된다(listWithArticles 주석 참고). */}
      {explained.length > 0 && (
        <p className="mt-6 text-sm leading-7 text-gray-600">
          <span className="font-semibold text-gray-900">자세히 정리한 지원금</span>{' '}
          {explained.map((r, i) => (
            <Fragment key={r.slug}>
              {i > 0 && <span className="px-1 text-gray-300">·</span>}
              <Link href={`/benefit/${r.slug}`} className="text-brand-700 hover:underline">{r.title}</Link>
            </Fragment>
          ))}
        </p>
      )}

      {/* 가이드도 같은 고아 문제를 겪고 있었다. 목록 페이지가 아예 없어 404였고, 홈·허브
          어디에도 링크가 없어 사이트맵에만 존재했다. 해설 링크와 같은 방식으로 한 줄 둔다. */}
      {guides.length > 0 && (
        <p className="mt-3 text-sm leading-7 text-gray-600">
          <span className="font-semibold text-gray-900">가이드</span>{' '}
          {guides.slice(0, 4).map((g, i) => (
            <Fragment key={g.slug}>
              {i > 0 && <span className="px-1 text-gray-300">·</span>}
              <Link href={`/guide/${g.slug}`} className="text-brand-700 hover:underline">{g.title}</Link>
            </Fragment>
          ))}
          {guides.length > 4 && (
            <>
              <span className="px-1 text-gray-300">·</span>
              <Link href="/guide" className="text-brand-700 hover:underline">전체 보기</Link>
            </>
          )}
        </p>
      )}

      {/* 기간형 공고는 614건뿐이라 2주 이내가 0건인 시기가 실제로 생긴다. 제목만 남은 빈 섹션은
          내용 없는 페이지로 보이므로 항목이 있을 때만 렌더한다. */}
      {soon.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">마감 임박 (2주 이내)</h2>
            <Link href="/deadline" className="text-sm text-brand-700 hover:underline">전체 보기</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {soon.map((r) => <BenefitCard key={r.slug} row={r} now={now} />)}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold">분야별로 보기</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PUBLIC_SEGMENTS.map((s) => (
            <Link key={s.slug} href={`/${s.path}`} className="rounded-xl border bg-white p-5 hover:border-brand-300 hover:shadow-sm">
              <h3 className="text-lg font-bold">{s.name} 지원금</h3>
              <p className="mt-1 text-sm text-gray-600">{s.description_md}</p>
            </Link>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">최근 갱신된 지원금</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((r) => <BenefitCard key={r.slug} row={r} now={now} />)}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-gray-400">
        데이터 출처: 행정안전부 보조금24 · 최종 동기화 {lastSync ? formatKstDate(lastSync) : '확인 중'}
      </p>
    </div>
  )
}
