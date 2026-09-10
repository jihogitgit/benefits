'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { SearchResultItem } from '@/lib/benefits/search'
import type { BenefitListRow } from '@/lib/benefits/queries'
import type { DeadlineType, Segment } from '@/types/database'
import { readDiagnosis, toSearchParams, isEmpty, type Diagnosis } from '@/lib/diagnosis/storage'
import { AGE_OPTIONS, SITUATION_OPTIONS, REGION_OPTIONS } from '@/lib/diagnosis/options'
import BenefitCard from '@/components/benefits/BenefitCard'
import BenefitList from '@/components/benefits/BenefitList'

const PAGE = 50

function label(d: Diagnosis): string {
  return [
    AGE_OPTIONS.find((o) => o.value === d.ageBand)?.label,
    ...d.situations.map((s) => SITUATION_OPTIONS.find((o) => o.value === s)?.label),
    REGION_OPTIONS.find((o) => o.value === d.region)?.label,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** 검색 API 응답을 카드가 요구하는 목록 행으로. 목록에 안 쓰는 필드는 비운다. */
function toRow(i: SearchResultItem): BenefitListRow {
  return {
    slug: i.slug,
    title: i.title,
    summary: i.summary,
    amount_text: i.amount_text,
    deadline_type: i.deadline_type as DeadlineType,
    apply_start: null,
    apply_end: i.apply_end,
    region_code: i.region_code,
    segments: i.segments as Segment[],
    agency: null,
    synced_at: '',
  }
}

export default function DiagnosisResults() {
  const [d, setD] = useState<Diagnosis | null>(null)
  const [items, setItems] = useState<SearchResultItem[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // 서버에서는 readDiagnosis()가 항상 빈 값을 주므로 렌더 중에 읽으면 hydration 불일치가 난다.
  useEffect(() => {
    setD(readDiagnosis())
  }, [])

  // 언마운트 시 진행 중인 요청 취소. 취소된 응답으로는 상태를 갱신하지 않는다.
  useEffect(() => () => abortRef.current?.abort(), [])

  const load = useCallback(async (diag: Diagnosis, offset: number) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError(false)
    try {
      const sp = toSearchParams(diag)
      sp.set('limit', String(PAGE))
      sp.set('offset', String(offset))
      const r = await fetch(`/api/benefits/search?${sp.toString()}`, { signal: ac.signal })
      if (!r.ok) throw new Error(String(r.status))
      const j = (await r.json()) as { total: number; items: SearchResultItem[] }
      setTotal(j.total)
      setItems((prev) => (offset === 0 ? j.items : [...prev, ...j.items]))
      setLoaded(true)
    } catch {
      // 취소는 오류가 아니고, 로딩 상태는 뒤이은 요청이 관리한다.
      if (!ac.signal.aborted) setError(true)
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (d && !isEmpty(d)) void load(d, 0)
  }, [d, load])

  // 첫 렌더와 빈 진단 안내의 높이를 맞춰 복원 직후 화면이 튀지 않게 한다.
  if (d === null) return <div className="py-16 text-center text-sm text-gray-500">불러오는 중…</div>

  if (isEmpty(d)) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">아직 고른 조건이 없습니다.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700"
        >
          조건 고르러 가기
        </Link>
      </div>
    )
  }

  const matched = items.filter((i) => i.hasConditions)
  const unsure = items.filter((i) => !i.hasConditions)
  const firstLoad = loading && !loaded
  const countText = loaded ? `총 ${total.toLocaleString()}개` : error ? '불러오지 못함' : '검색 중…'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{label(d)}</span> 조건 · {countText}
        </p>
        <Link href="/" className="text-sm text-indigo-700 hover:underline">
          조건 바꾸기
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          불러오지 못했습니다. 잠시 후 다시 시도해 주세요.{' '}
          {items.length === 0 && (
            <button type="button" onClick={() => void load(d, 0)} className="font-semibold underline">
              다시 시도
            </button>
          )}
        </p>
      )}

      {/* 첫 조회 중에는 결과 영역 높이를 예약해 카드가 들어올 때 화면이 밀리지 않게 한다. */}
      {firstLoad && (
        <div className="grid min-h-[24rem] place-items-center rounded-xl border border-dashed text-sm text-gray-500">
          지원금을 찾는 중…
        </div>
      )}

      {loaded && items.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
          조건에 맞는 지원금이 없습니다. 조건을 줄여서 다시 찾아보세요.
        </p>
      )}

      {matched.length > 0 && <BenefitList rows={matched.map(toRow)} />}

      {unsure.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-bold text-gray-700">
            조건 확인 필요{' '}
            <span className="text-sm font-normal text-gray-500">
              — 대상 조건이 등록되지 않아 직접 확인이 필요한 지원금
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {unsure.map((i) => (
              <BenefitCard key={i.slug} row={toRow(i)} />
            ))}
          </div>
        </section>
      )}

      {items.length < total && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(d, items.length)}
            className="rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '불러오는 중…' : `더 보기 (${items.length}/${total})`}
          </button>
        </div>
      )}
    </div>
  )
}
