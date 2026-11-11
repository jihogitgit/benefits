import { CONDITION_SOURCES, type HousingCondition } from '@/lib/housing/conditions'

/** 청약홈이 표시한 규제 지역·제도와 그 영향. 켜진 표시가 없으면 그리지 않는다. */
export default function ConditionFlags({ conditions }: { conditions: HousingCondition[] }) {
  if (!conditions.length) return null
  const withEffects = conditions.filter((c) => c.effects.length > 0)
  return (
    <section className="mt-8" aria-labelledby="conditions-heading">
      <h2 id="conditions-heading" className="mb-2 text-lg font-bold">이 단지에 적용되는 규제</h2>
      <ul className="flex flex-wrap gap-1.5" aria-label="규제 표시">
        {conditions.map((c) => (
          <li key={c.key} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">{c.label}</li>
        ))}
      </ul>
      {withEffects.length > 0 && (
        <dl className="mt-3 divide-y rounded-xl border bg-white text-sm">
          {withEffects.map((c) => (
            <div key={c.key} className="p-3">
              <dt className="font-semibold text-gray-900">{c.label}</dt>
              <dd className="mt-1 text-gray-700">
                <ul className="list-disc space-y-1 pl-5">
                  {c.effects.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-xs text-gray-500">
        청약홈 분양정보의 표시를 현행 법령에 대응시킨 일반적인 내용입니다. 여러 규제가 겹치면 재당첨 제한은 가장 긴 기간이 적용됩니다. 이 단지의 정확한 기간과 조건은 모집공고문을 확인하세요. 근거:{' '}
        {CONDITION_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ' · '}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.label}<span className="sr-only">(새 창)</span></a>
          </span>
        ))}
      </p>
    </section>
  )
}
