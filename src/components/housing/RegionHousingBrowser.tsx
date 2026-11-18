'use client'

import { useState } from 'react'
import type { HousingCardRow } from '@/lib/housing/queries'
import type { HousingKind } from '@/types/housing'
import { KIND_FILTERS } from '@/lib/housing/labels'
import HousingList from './HousingList'

type StatusFilter = 'all' | 'open' | 'upcoming'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'open', label: '접수중' },
  { value: 'upcoming', label: '접수 예정' },
]

const chip = (active: boolean) =>
  `inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm ${active ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'}`

/**
 * 지역 공고 목록 + 필터(접수 상태·종류). 주소를 바꾸지 않고 브라우저에서 거른다 — 지역 페이지는 ISR이라
 * searchParams를 읽으면 같은 경로의 공고 상세까지 동적 렌더가 되고, 필터 주소마다 색인 판정도 따로 해야 한다.
 * 지역의 접수중·예정 공고는 많아야 수십 건이라 전부 내려받아도 가볍다. 종류 칩은 이 지역에 있는 것만 낸다.
 */
export default function RegionHousingBrowser({ name, local, national, now }: { name: string; local: HousingCardRow[]; national: HousingCardRow[]; now?: Date }) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [kind, setKind] = useState<HousingKind | null>(null)

  const all = [...local, ...national]
  const kinds = KIND_FILTERS.filter((f) => all.some((r) => r.kind === f.kind))
  const pass = (r: HousingCardRow) => (status === 'all' || r.status === status) && (!kind || r.kind === kind)
  const count = (p: (r: HousingCardRow) => boolean) => all.filter(p).length
  const localShown = local.filter(pass)
  const nationalShown = national.filter(pass)
  const filtered = status !== 'all' || kind !== null

  return (
    <>
      {all.length > 0 && (
        <div className="mt-5" data-testid="region-filters">
          <div role="group" aria-label="접수 상태" className="flex gap-2">
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={status === f.value} onClick={() => setStatus(f.value)} className={chip(status === f.value)}>
                {f.label}
                <span className={status === f.value ? 'text-white/80' : 'text-gray-400'}>{count((r) => (f.value === 'all' || r.status === f.value) && (!kind || r.kind === kind))}</span>
              </button>
            ))}
          </div>
          {kinds.length > 1 && (
            <div role="group" aria-label="종류" className="-mx-4 mt-3 overflow-x-auto px-4">
              <div className="flex gap-2 pb-1">
                <button type="button" aria-pressed={kind === null} onClick={() => setKind(null)} className={chip(kind === null)}>전체</button>
                {kinds.map((f) => (
                  <button key={f.kind} type="button" aria-pressed={kind === f.kind} onClick={() => setKind(f.kind)} className={chip(kind === f.kind)}>{f.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">{name} 공고 {filtered && <span className="text-sm font-normal text-gray-500">{localShown.length}건</span>}</h2>
        <HousingList
          rows={localShown}
          now={now}
          emptyText={filtered && local.length > 0 ? '조건에 맞는 공고가 없습니다. 필터를 바꿔 보세요.' : national.length > 0 ? `지금 접수 중인 ${name} 공고가 없습니다. 아래 전국 공통 공고를 확인하세요.` : `지금 접수 중인 ${name} 공고가 없습니다.`}
        />
      </section>

      {national.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">전국 공통 공고 <span className="text-sm font-normal text-gray-500">{nationalShown.length}건</span></h2>
          <HousingList rows={nationalShown} now={now} emptyText="조건에 맞는 전국 공통 공고가 없습니다." />
        </section>
      )}
    </>
  )
}
