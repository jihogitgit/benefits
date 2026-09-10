import Link from 'next/link'
import DiagnosisPanel from '@/components/diagnosis/DiagnosisPanel'
import BenefitCard from '@/components/benefits/BenefitCard'
import AdPlacement from '@/components/benefits/AdPlacement'
import { listDeadlineSoon, listRecentlyUpdated, getLastSyncAt } from '@/lib/benefits/queries'
import { formatKstDate } from '@/lib/benefits/format'
import { PUBLIC_SEGMENTS } from '../../../data/segments'

export const revalidate = 3600

export default async function HomePage() {
  // listDeadlineSoon/listRecentlyUpdated는 현재 시각을 인자로 받지 않는다(unstable_cache 키 오염 방지).
  // D-day 표시용 기준 시각만 여기서 한 번 만들어 카드에 내려준다.
  const now = new Date()
  const [soon, recent, lastSync] = await Promise.all([listDeadlineSoon(14, 8), listRecentlyUpdated(48, 8), getLastSyncAt()])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <DiagnosisPanel />

      <AdPlacement slot="home" />

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">마감 임박 (2주 이내)</h2>
          <Link href="/deadline" className="text-sm text-indigo-700 hover:underline">전체 보기</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {soon.map((r) => <BenefitCard key={r.slug} row={r} now={now} />)}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold">분야별로 보기</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PUBLIC_SEGMENTS.map((s) => (
            <Link key={s.slug} href={`/${s.path}`} className="rounded-xl border bg-white p-5 hover:border-indigo-300 hover:shadow-sm">
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
