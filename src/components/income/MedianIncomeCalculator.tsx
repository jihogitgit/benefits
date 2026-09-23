'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { medianIncomePercent, bandOf, isSupportedHousehold } from '@/lib/benefits/income'
import { MEDIAN_INCOME_2026, MAX_HOUSEHOLD_SIZE } from '../../../data/median-income'
import { readDiagnosis, writeDiagnosis, toSearchParams } from '@/lib/diagnosis/storage'
import { cn } from '@/lib/utils'

const BAND_LABEL: Record<string, string> = {
  '0-50': '중위소득 50% 이하',
  '51-75': '중위소득 51~75%',
  '76-100': '중위소득 76~100%',
  '101-200': '중위소득 101~200%',
  '200+': '중위소득 200% 초과',
}

/** 입력 문자열에서 숫자만. '3,200,000' · '320만' 같은 표기를 그대로 받기 위함이다. */
function parseAmount(raw: string): number | null {
  const man = /^\s*([\d,]+)\s*만\s*(원)?\s*$/.exec(raw)
  if (man) {
    const n = Number(man[1].replace(/,/g, ''))
    return Number.isFinite(n) ? n * 10_000 : null
  }
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

const won = (n: number) => n.toLocaleString('ko-KR')

export default function MedianIncomeCalculator() {
  const [size, setSize] = useState(1)
  const [raw, setRaw] = useState('')
  const [total, setTotal] = useState<number | null>(null)
  const [countFailed, setCountFailed] = useState(false)

  const income = useMemo(() => parseAmount(raw), [raw])
  const percent = income !== null ? medianIncomePercent(income, size) : null
  const band = percent !== null ? bandOf(percent) : null

  // 구간이 정해지면 그 구간에서 실제로 몇 건이 걸리는지 물어본다. 계산기만 두면
  // 사용자는 숫자 하나를 받고 갈 곳이 없다.
  useEffect(() => {
    if (!band) { setTotal(null); setCountFailed(false); return }
    const ac = new AbortController()
    setCountFailed(false)
    setTotal(null)
    fetch(`/api/benefits/search?income=${encodeURIComponent(band)}&count=1`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`search ${r.status}`))))
      .then((j) => setTotal(j.total))
      .catch(() => { if (!ac.signal.aborted) setCountFailed(true) })
    return () => ac.abort()
  }, [band])

  /** 진단에 소득만 얹어 /my로 보낸다. 이미 고른 나이·지역·상황은 지우지 않는다. */
  const goHref = () => {
    if (!band) return '/my'
    const d = { ...readDiagnosis(), incomeBand: band }
    writeDiagnosis(d)
    return `/my?${toSearchParams(d).toString()}`
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="household-size" className="mb-2 block text-sm font-semibold text-gray-700">
            가구원 수
          </label>
          <select
            id="household-size"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 transition hover:border-brand-400 sm:max-w-xs"
          >
            {Array.from({ length: MAX_HOUSEHOLD_SIZE }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}인 가구</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="monthly-income" className="mb-2 block text-sm font-semibold text-gray-700">
            가구 월 소득 (세전)
          </label>
          <input
            id="monthly-income"
            inputMode="numeric"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="예: 3,200,000 또는 320만"
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 transition hover:border-brand-400 sm:max-w-xs"
          />
          <p className="mt-1 text-xs text-gray-500">
            입력한 값은 이 브라우저 밖으로 나가지 않습니다. 저장도 하지 않습니다.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          {size}인 가구 기준 중위소득 100% ={' '}
          <b className="font-semibold tabular-nums text-gray-900">{won(MEDIAN_INCOME_2026[size])}원</b>
        </p>

        {percent === null ? (
          <p className="mt-2 text-sm text-gray-500">월 소득을 넣으면 중위소득 대비 몇 %인지 계산합니다.</p>
        ) : (
          <>
            <p className="mt-2 text-lg font-bold text-gray-900">
              중위소득의 <span className="tabular-nums text-brand-700">{percent}%</span>
            </p>
            <p className="mt-0.5 text-sm text-gray-600">
              지원금 자격 구분으로는 <b className="font-semibold text-gray-900">{BAND_LABEL[band!]}</b> 구간입니다.
            </p>
            <Link
              href={goHref()}
              className={cn(
                'mt-4 block rounded-xl bg-brand-600 py-3.5 text-center text-base font-bold text-white transition',
                'hover:bg-brand-700 active:scale-[0.99]',
              )}
            >
              {countFailed
                ? '이 소득으로 받을 수 있는 지원금 보기 →'
                : total === null
                  ? '찾는 중…'
                  : `이 소득으로 받을 수 있는 지원금 ${total.toLocaleString()}개 보기 →`}
            </Link>
            <p className="mt-2 text-xs text-gray-500">
              소득 조건이 걸린 사업과, 소득을 보지 않는 사업을 함께 셉니다. 나이·지역을 고르면 더 좁혀집니다.
            </p>
          </>
        )}

        {!isSupportedHousehold(size) && (
          <p className="mt-2 text-sm text-gray-600">7인 이상 가구는 고시 원문을 확인하세요.</p>
        )}
      </div>
    </section>
  )
}
