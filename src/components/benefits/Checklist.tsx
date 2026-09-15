'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ConditionJoin } from '@/lib/benefits/queries'
import { evaluateChecklist, summarize, type CheckItem, type CheckState } from '@/lib/benefits/checklist'
import { readDiagnosis, isEmpty } from '@/lib/diagnosis/storage'
import { cn } from '@/lib/utils'

export default function Checklist({ items, cond }: { items: CheckItem[]; cond: ConditionJoin | null }) {
  const [states, setStates] = useState<CheckState[]>(() => items.map(() => 'unknown'))
  const [diagnosisEmpty, setDiagnosisEmpty] = useState(true)

  // items·cond는 서버 컴포넌트가 내려주는 새 객체 참조라, 그대로 deps에 넣으면 RSC 페이로드가
  // 갱신될 때마다(router.refresh, ISR 재검증 후 소프트 내비게이션, Fast Refresh) effect가 다시 돌아
  // 사용자가 손으로 켜고 끈 체크를 프리필 값으로 덮어쓴다. 항목 구성이 실제로 바뀔 때만 다시 프리필한다.
  const itemsKey = items.map((i) => i.key).join('|')
  useEffect(() => {
    const d = readDiagnosis()
    setDiagnosisEmpty(isEmpty(d))
    setStates(evaluateChecklist(items, cond, d).map((e) => e.state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey])

  if (!items.length) {
    return (
      <section id="check" className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-bold">내가 대상인지 30초 체크</h2>
        <p className="mt-2 text-sm text-gray-600">이 지원금은 대상 조건이 등록되지 않은 항목입니다. 아래 원문 &ldquo;지원대상&rdquo;과 공식 페이지에서 확인하세요.</p>
      </section>
    )
  }

  const evaluated = items.map((it, i) => ({ ...it, state: states[i] ?? 'unknown' }))
  const toggle = (i: number) => setStates((p) => p.map((s, j) => (j === i ? (s === 'pass' ? 'unknown' : 'pass') : s)))

  return (
    <section id="check" className="rounded-xl border bg-white p-4">
      <h2 className="text-base font-bold">내가 대상인지 30초 체크</h2>
      <ul className="mt-3 space-y-2">
        {evaluated.map((e, i) => (
          <li key={e.key} className="flex items-start gap-2">
            <input
              id={`chk-${i}`}
              type="checkbox"
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={e.state === 'pass'}
              onChange={() => toggle(i)}
            />
            <label htmlFor={`chk-${i}`} className={cn('text-sm', e.state === 'fail' && 'text-red-700 line-through decoration-red-300')}>
              {e.label}
              {e.state === 'fail' && <span className="ml-1 text-xs no-underline">내 조건과 다름</span>}
              {/* 부분 겹침은 체크하지 않고 확인을 요구한다. 오늘은 나이 항목만 partial이 될 수 있다. */}
              {e.state === 'partial' && (
                <span className="ml-1 text-xs text-amber-700">· {e.key === 'age' ? '나이 확인 필요' : '확인 필요'}</span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">{summarize(evaluated, diagnosisEmpty)}</p>
      <p className="mt-2 text-xs text-gray-500">
        <Link href="/" className="underline">홈에서 조건을 고르면</Link> 자동으로 채워집니다. 체크는 참고용이며 최종 자격은 공식 페이지에서 확인하세요.
      </p>
    </section>
  )
}
