import type { Metadata } from 'next'
import Link from 'next/link'
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

      {/* 홈에서 해설·가이드로 가는 유일한 경로. 이 링크가 없으면 두 곳 다 사이트맵에만
          존재하는 고아 페이지가 된다(listWithArticles 주석 참고).

          예전에는 한 줄짜리 문장으로 두어 진단 CTA를 밀지 않으려 했는데, 모바일에서는
          그 한 줄이 여덟 줄짜리 문단이 됐다. 제목 사이 구분이 가운뎃점뿐이라 어디서
          끊기는지 읽히지 않았고, 링크가 행간에 붙어 탭 대상이 서로 겹쳤다. 자리는 그대로
          두되 목록으로 바꿔 항목마다 제 높이를 준다. 본문과 구별되게 카드에 담아
          아래 지원금 섹션들보다 한 단 낮은 무게로 놓는다. */}
      {(explained.length > 0 || guides.length > 0) && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4" aria-label="읽을거리">
          {explained.length > 0 && (
            <div>
              <h2 className="px-2 text-sm font-bold text-gray-900">자세히 정리한 지원금</h2>
              <ul className="mt-1 flex flex-wrap">
                {explained.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/benefit/${r.slug}`}
                      className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-brand-700 transition hover:bg-brand-50"
                    >
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guides.length > 0 && (
            <div className={explained.length > 0 ? 'mt-3 border-t border-gray-100 pt-3' : undefined}>
              <h2 className="px-2 text-sm font-bold text-gray-900">가이드</h2>
              <ul className="mt-1">
                {guides.slice(0, 4).map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/guide/${g.slug}`}
                      className="flex min-h-11 items-center rounded-lg px-2 py-1.5 text-sm leading-snug text-brand-700 transition hover:bg-brand-50"
                    >
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {guides.length > 4 && (
                <Link
                  href="/guide"
                  className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  가이드 전체 보기 →
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {/* 기간형 공고는 614건뿐이라 2주 이내가 0건인 시기가 실제로 생긴다. 제목만 남은 빈 섹션은
          내용 없는 페이지로 보이므로 항목이 있을 때만 렌더한다. */}
      {soon.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">마감 임박 (2주 이내)</h2>
            <Link href="/deadline" className="text-sm text-brand-700 hover:underline">전체 보기</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {soon.map((r) => <BenefitCard key={r.slug} row={r} now={now} />)}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">분야별로 보기</h2>
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
          <h2 className="mb-3 text-xl font-bold">최근 갱신된 지원금</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((r) => <BenefitCard key={r.slug} row={r} now={now} />)}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-gray-500">
        데이터 출처: 행정안전부 보조금24 · 최종 동기화 {lastSync ? formatKstDate(lastSync) : '확인 중'}
      </p>
    </div>
  )
}
