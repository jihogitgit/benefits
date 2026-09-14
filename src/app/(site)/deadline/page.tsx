import type { Metadata } from 'next'
import { listDeadlineSoon } from '@/lib/benefits/queries'
import { groupByWeek } from '@/lib/benefits/calendar'
import { kstYear } from '@/lib/seo/hub-meta'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitList from '@/components/benefits/BenefitList'

export const revalidate = 3600

export const metadata: Metadata = {
  title: `${kstYear()} 마감 임박 지원금 캘린더`,
  description: '이번 주·다음 주·이달 안에 신청이 끝나는 정부·지자체 지원금을 마감일 순으로 모았습니다.',
  alternates: { canonical: absoluteUrl('/deadline') },
}

export default async function DeadlinePage() {
  const now = new Date()
  const rows = await listDeadlineSoon(45, 200)
  const groups = groupByWeek(rows, now)
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">마감 임박 지원금</h1>
      <p className="mt-2 text-gray-600">앞으로 45일 안에 신청이 끝나는 지원금입니다. 상시 신청 지원금은 분야별 페이지에서 확인하세요.</p>
      {groups.length === 0 && <p className="mt-8 text-gray-500">현재 마감 예정인 지원금이 없습니다.</p>}
      {groups.map((g) => (
        <section key={g.label} className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{g.label} <span className="text-sm font-normal text-gray-500">{g.rows.length}개</span></h2>
          <BenefitList rows={g.rows} now={now} />
        </section>
      ))}
    </div>
  )
}
