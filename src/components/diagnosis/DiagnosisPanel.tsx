'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AGE_OPTIONS, SITUATION_OPTIONS, REGION_OPTIONS } from '@/lib/diagnosis/options'
import { readDiagnosis, writeDiagnosis, toSearchParams, isEmpty, EMPTY, type Diagnosis } from '@/lib/diagnosis/storage'
import { cn } from '@/lib/utils'

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-3.5 text-sm transition',
        on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400',
      )}
    >
      {children}
    </button>
  )
}

export default function DiagnosisPanel() {
  const [d, setD] = useState<Diagnosis>(EMPTY)
  const [total, setTotal] = useState<number | null>(null)
  // 조회 실패를 따로 들고 있는다. 실패를 total=null로만 두면 CTA가 '찾는 중…'에 영구히 머물러
  // 사용자에게 거짓 상태를 보여준다. 실패해도 /my로는 갈 수 있으니 중립 문구로 바꾼다.
  const [countFailed, setCountFailed] = useState(false)
  const [restored, setRestored] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // 첫 렌더 후 localStorage 복원. 서버에서는 readDiagnosis()가 항상 빈 값을 주므로
  // 렌더 중에 읽으면 hydration 불일치가 난다. 반드시 useEffect에서 읽는다.
  useEffect(() => {
    const saved = readDiagnosis()
    if (!isEmpty(saved)) {
      setD(saved)
      setRestored(true)
    }
  }, [])

  // 조건이 바뀌면 저장하고 개수 조회
  useEffect(() => {
    if (isEmpty(d)) {
      setTotal(null)
      setCountFailed(false)
      return
    }
    writeDiagnosis(d)
    setCountFailed(false)
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const sp = toSearchParams(d)
    sp.set('count', '1')
    fetch(`/api/benefits/search?${sp.toString()}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`search ${r.status}`))))
      .then((j) => setTotal(j.total))
      .catch((e: unknown) => {
        // 조건이 바뀌어 취소된 요청은 실패가 아니다.
        if (!ac.signal.aborted) setCountFailed(true)
        void e
      })
    return () => ac.abort()
  }, [d])

  const toggleSituation = (v: string) => {
    setRestored(false)
    setD((p) => ({ ...p, situations: p.situations.includes(v) ? p.situations.filter((s) => s !== v) : [...p.situations, v] }))
  }
  const pickAge = (v: Diagnosis['ageBand']) => {
    setRestored(false)
    setD((p) => ({ ...p, ageBand: p.ageBand === v ? null : v }))
  }
  const pickRegion = (v: Diagnosis['region']) => {
    setRestored(false)
    setD((p) => ({ ...p, region: p.region === v ? null : v }))
  }

  return (
    <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 p-5 text-white shadow-md sm:p-7">
      <h1 className="text-2xl font-extrabold sm:text-3xl">내가 받을 수 있는 지원금은?</h1>
      <p className="mt-1 text-sm text-indigo-100">3가지만 고르면 바로 보여드립니다. 회원가입 없음, 정보는 내 브라우저에만 저장됩니다.</p>

      <div className="mt-5 space-y-4 rounded-xl bg-white p-4 text-gray-900">
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">나이</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="나이">
            {AGE_OPTIONS.map((o) => (
              <Chip key={o.value} on={d.ageBand === o.value} onClick={() => pickAge(o.value)}>{o.label}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">상황 (여러 개 가능)</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="상황 (여러 개 가능)">
            {SITUATION_OPTIONS.map((o) => (
              <Chip key={o.value} on={d.situations.includes(o.value)} onClick={() => toggleSituation(o.value)}>{o.label}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">지역</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="지역">
            {REGION_OPTIONS.map((o) => (
              <Chip key={o.value} on={d.region === o.value} onClick={() => pickRegion(o.value)}>{o.label}</Chip>
            ))}
          </div>
        </div>

        {/* 높이가 같은 컨테이너로 감싸 진단 복원 전후에 레이아웃이 튀지 않게 한다 */}
        <div className="grid min-h-[3.5rem] items-center pt-1">
          {isEmpty(d) ? (
            <p className="text-center text-sm text-gray-500">조건을 골라 주세요. 하나만 골라도 됩니다.</p>
          ) : (
            <Link
              href="/my"
              className="block rounded-xl bg-indigo-600 py-3.5 text-center text-base font-bold text-white hover:bg-indigo-700"
            >
              {restored ? '이어서 보기: ' : ''}
              {countFailed ? '내 지원금 보기 →' : total === null ? '내 지원금 찾는 중…' : `내 지원금 ${total.toLocaleString()}개 보기 →`}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
