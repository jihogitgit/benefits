'use client'

import { useState } from 'react'
import { currentPlan, isReformBirthMonth, reformPlan, welcomePayMonths } from '@/lib/benefits/child-welcome'
import type { Area, BirthOrder, Care } from '../../../data/child-welcome'

/** 만 원 단위 금액 표기. 합계가 가장 큰 경우(우대지역 셋째 7,400만)도 1억을 넘지 않는다. */
const man = (n: number) => `${n.toLocaleString('ko-KR')}만 원`
const ymLabel = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`

// 2027년 1월 ~ 2028년 12월. 개편 전후(6월/7월)를 직접 비교해 볼 수 있게 상반기도 넣는다.
const MONTHS = Array.from({ length: 24 }, (_, i) => `${2027 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`)

const seg = (active: boolean) =>
  `min-h-11 flex-1 rounded-lg border px-3 text-sm ${active ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'}`

function Choice<T extends string | number>({ legend, value, options, onChange }: { legend: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-gray-800">{legend}</legend>
      <div className="flex gap-2">
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={seg(value === o.value)}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  )
}

export default function ChildWelcomeCalculator() {
  const [ym, setYm] = useState('2027-07')
  const [order, setOrder] = useState<BirthOrder>(1)
  const [area, setArea] = useState<Area>('basic')
  const [care, setCare] = useState<Care>('home')

  const input = { order, area, care }
  const reform = reformPlan(input)
  const current = currentPlan(input)
  const applies = isReformBirthMonth(ym)
  const shown = applies ? reform : current

  return (
    <div className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-800">출생(예정) 월</span>
          <select value={ym} onChange={(e) => setYm(e.target.value)} className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base">
            {MONTHS.map((m) => <option key={m} value={m}>{ymLabel(m)}</option>)}
          </select>
        </label>
        <Choice legend="몇째 아이인가요" value={order} onChange={setOrder} options={[{ value: 1, label: '첫째' }, { value: 2, label: '둘째' }, { value: 3, label: '셋째 이상' }]} />
        <Choice legend="사는 곳" value={area} onChange={setArea} options={[{ value: 'basic', label: '기본 지역' }, { value: 'priority', label: '우대지역' }]} />
        <p className="-mt-2 text-xs text-gray-500">우대지역은 인구감소지역 등이 포함되며, 적용 지역은 정부가 조정 중입니다. 아직 목록이 없습니다.</p>
        <Choice legend="0~1세 때 보육" value={care} onChange={setCare} options={[{ value: 'home', label: '가정 보육' }, { value: 'daycare', label: '어린이집 이용' }]} />
      </div>

      <div aria-live="polite" data-testid="result">
        {applies ? (
          <p className="inline-block rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">개편안 적용 (2027년 7월 1일 이후 출생)</p>
        ) : (
          <p className="inline-block rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">현행 제도 적용 (2027년 6월 30일까지 출생)</p>
        )}

        {shown ? (
          <>
            <p className="mt-2 text-sm text-gray-600">0세부터 12세까지 받는 금액</p>
            <p className="text-3xl font-extrabold tabular-nums text-gray-900" data-testid="total">{man(shown.total)}</p>
            <table className="mt-3 w-full border-collapse text-sm">
              <caption className="sr-only">연령 구간별 금액</caption>
              <tbody>
                <tr className="border-t border-gray-100"><th scope="row" className="py-2 text-left font-medium text-gray-700">0세 (첫 1년)</th><td className="py-2 text-right tabular-nums">{man(shown.year0)}</td></tr>
                <tr className="border-t border-gray-100"><th scope="row" className="py-2 text-left font-medium text-gray-700">1세</th><td className="py-2 text-right tabular-nums">{man(shown.year1)}</td></tr>
                <tr className="border-y border-gray-100"><th scope="row" className="py-2 text-left font-medium text-gray-700">2~12세 (11년)</th><td className="py-2 text-right tabular-nums">{man(shown.later)}</td></tr>
              </tbody>
            </table>
          </>
        ) : (
          <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            정부 자료가 현행 제도에서 어린이집을 이용하는 경우의 합계를 싣지 않아 계산하지 않습니다. 가정 보육을 고르면 현행 금액을 볼 수 있습니다.
          </p>
        )}

        {applies ? (
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="font-semibold text-gray-900">아이맞이지원금 {man(reform.welcome)} · 현금</p>
              <p className="mt-1">{welcomePayMonths(ym).map(ymLabel).join(', ')}에 {man(reform.quarterly)}씩 네 번 받습니다.</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="font-semibold text-gray-900">아동기본수당 · 매월</p>
              <p className="mt-1">
                0~1세 월 {man(reform.monthly0to1)}{care === 'home' ? ` (수당 ${reform.monthlyLater}만 + 가정 보육 가산금 30만)` : ''}, 2~12세 월 {man(reform.monthlyLater)}.
                수당 {reform.monthlyLater}만 원 가운데 절반({reform.monthlyLater / 2}만 원)은 지역사랑상품권으로 받아, 13년 동안 {man(reform.voucherTotal)}입니다. 가산금을 현금으로 주는지 상품권으로 주는지는 발표 자료에 없습니다.
              </p>
            </div>
            {current && (
              <p data-testid="diff">
                같은 조건에서 현행 제도는 {man(current.total)}입니다. 개편안이 <b className="font-semibold text-brand-700">{man(reform.total - current.total)}</b> 더 많습니다. 현행 금액은 {area === 'basic' ? '수도권(아동수당 월 10만 원)' : '인구감소지역 특별(월 12만 원)'} 기준이라 다른 지역은 조금 다릅니다.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>첫만남이용권, 부모급여, 아동수당이 그대로 적용될 예정입니다.{current && <> 같은 조건으로 2027년 7월 이후에 태어나면 {man(reform.total)}으로, <b className="font-semibold">{man(reform.total - current.total)}</b> 차이가 납니다.</>}</p>
            <p className="rounded-lg bg-amber-50 p-3 text-amber-900">2027년 1~6월 출생아에게도 새 제도를 적용하는 방안을 정부가 검토 중이라는 보도가 있었지만(2026년 10월), 확정되지 않았습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
