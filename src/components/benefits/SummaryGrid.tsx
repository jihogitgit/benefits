import { deadlineLabel, firstLine } from '@/lib/benefits/format'
import type { BenefitDetail } from '@/lib/benefits/queries'

export default function SummaryGrid({ b }: { b: BenefitDetail }) {
  const cells = [
    // amount_text 첫 줄은 내용이 아니라 머리말인 행이 많다 — '< … 개요 >'가 제목을 되풀이하거나
    // '? 지원대상 및 기준' 같은 빈 라벨이 실린다. summary는 같은 행에 이미 실려 오고 표본
    // 500건 전부 채워져 있다. BenefitCard와 같은 출처를 쓴다.
    { k: '지원 내용', v: firstLine(b.summary, 60) ?? firstLine(b.amount_text, 60) ?? '공식 페이지 확인' },
    { k: '대상', v: firstLine(b.target_text, 60) ?? '공식 페이지 확인' },
    { k: '신청 기간', v: deadlineLabel(b) },
    { k: '신청처', v: b.apply_method ? b.apply_method.replace(/\|\|/g, ' · ') : (b.agency ?? '공식 페이지 확인') },
  ]
  return (
    <section aria-label="한눈에 보기" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.k} className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-semibold text-gray-500">{c.k}</p>
          <p className="mt-0.5 line-clamp-3 text-sm font-semibold text-gray-900">{c.v}</p>
        </div>
      ))}
    </section>
  )
}
