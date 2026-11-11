import { ELIGIBILITY_AS_OF, ELIGIBILITY_GUIDES, ELIGIBILITY_YEAR, MEDIAN_INCOME_100, RELAXED_NOTICE, URBAN_INCOME_100, incomeLimit, type EligibilityGuide } from '@/lib/housing/eligibility-guides'
import type { EligibilityMatch } from '@/lib/housing/eligibility-type'

/**
 * 유형별 공통 자격 안내. 이 공고의 자격이 아니라 **이 유형의 공통 기준**이다 — 제목과 머리말이 그것부터 밝힌다.
 * 공고마다 다른 조건(지역 제한, 우선공급, 완화)은 공고문에만 있다.
 *
 * 안내가 없는 유형이면 아무것도 그리지 않는다(틀린 유형의 기준을 보여주느니 비운다).
 */
export default function EligibilityPanel({ match, sourceUrl }: { match: EligibilityMatch | null; sourceUrl?: string | null }) {
  const guide = match ? ELIGIBILITY_GUIDES[match.key] : undefined
  if (!match || !guide) return null
  return (
    <section className="mt-8" aria-labelledby="eligibility-heading">
      <h2 id="eligibility-heading" className="mb-2 text-lg font-bold">{guide.name} 공통 신청 자격</h2>
      <p className="text-sm text-gray-700">{guide.summary}</p>

      {match.relaxed && (
        <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{RELAXED_NOTICE}</p>
      )}

      <dl className="mt-3 divide-y rounded-xl border bg-white text-sm">
        {guide.rows.map((r) => (
          <div key={r.label} className="grid gap-1 p-3 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
            <dt className="font-semibold text-gray-900">{r.label}</dt>
            <dd className="text-gray-700">{r.text}</dd>
          </div>
        ))}
      </dl>

      {guide.notes && guide.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
          {guide.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {guide.income && <IncomeTable income={guide.income} />}

      <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        <p>
          {guide.confidence === 'partial' ? '이 유형은 공식 자료로 확인한 범위가 좁습니다. ' : ''}
          위 내용은 {guide.name} 유형의 공통 기준이며 이 공고만의 조건은 담지 않았습니다. 금액은 {ELIGIBILITY_YEAR}년 적용 기준이고 {ELIGIBILITY_AS_OF.replace(/-/g, '.')}에 확인했습니다. 지역 제한, 우선공급, 자격 완화 여부는{' '}
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">공고문<span className="sr-only">(새 창)</span></a>
          ) : (
            '공고문'
          )}
          이 기준입니다.
        </p>
        <p className="mt-1">
          근거:{' '}
          {guide.sources.map((s, i) => (
            <span key={s.url + s.label}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.label}<span className="sr-only">(새 창)</span></a>
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}

const won = (n: number) => `${Math.floor(n / 10_000).toLocaleString()}만원`

function IncomeTable({ income }: { income: NonNullable<EligibilityGuide['income']> }) {
  const base = income.scale === 'urban' ? URBAN_INCOME_100 : MEDIAN_INCOME_100
  const scaleName = income.scale === 'urban' ? '전년도 도시근로자 가구당 월평균소득' : '기준 중위소득'
  return (
    <details className="mt-3 rounded-xl border bg-white p-3 text-sm">
      <summary className="cursor-pointer font-semibold">가구원 수별 월 소득 한도 ({ELIGIBILITY_YEAR}년 적용)</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-right tabular-nums">
          <caption className="mb-1 text-left text-xs text-gray-500">{scaleName} 기준, 세전 월 소득. 1인 가구는 20%p, 2인 가구는 10%p를 더한 비율로 계산했습니다. 만원 미만은 버렸습니다.</caption>
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th scope="col" className="py-1 text-left font-medium">가구원</th>
              {income.pcts.map((p) => (
                <th key={p} scope="col" className="py-1 font-medium">{p}% 기준</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {base.map((_, i) => (
              <tr key={i} className="border-b last:border-0">
                <th scope="row" className="py-1 text-left font-normal">{i + 1}인</th>
                {income.pcts.map((p) => (
                  <td key={p} className="py-1">{won(incomeLimit(base, p, i + 1))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
