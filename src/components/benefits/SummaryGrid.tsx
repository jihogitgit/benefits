import { deadlineLabel, firstLine } from '@/lib/benefits/format'
import type { BenefitDetail } from '@/lib/benefits/queries'

export default function SummaryGrid({ b }: { b: BenefitDetail }) {
  const cells = [
    { k: '지원 내용', v: firstLine(b.amount_text, 60) ?? '공식 페이지 확인' },
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
