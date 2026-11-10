'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { HousingCardRow } from '@/lib/housing/queries'
import { readDiagnosis } from '@/lib/diagnosis/storage'
import { REGION_OPTIONS } from '@/lib/diagnosis/options'
import HousingCard from './HousingCard'

const SHOW = 4

/**
 * 진단 결과(/my)의 "내 지역 공고". 진단 조건은 localStorage에만 있어 서버가 모른다. 서버가 접수중·예정
 * 공고 전체(수백 건, housing:lists 캐시)를 내려주면 여기서 지역으로 거른다 — API를 한 번 더 부르지 않는다.
 * 상황 값(신혼·자녀)은 쓰지 않는다. 자격 판정이 아니라 배지(HousingCard)로만 보인다(설계 1절).
 *
 * 첫 렌더는 null이다(서버와 같은 HTML). 마운트 뒤 localStorage를 읽어 그린다.
 */
export default function MyHousingBlock({ rows }: { rows: HousingCardRow[] }) {
  const [region, setRegion] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    setRegion(readDiagnosis().region)
  }, [])
  if (region === undefined) return null

  // 목록에 없는 옛 값은 지역 없음으로 다룬다.
  const name = region ? REGION_OPTIONS.find((o) => o.value === region)?.label ?? null : null
  const valid = name ? region : null
  const picked = (valid ? rows.filter((r) => r.region_code === valid || r.region_code === 'ALL') : rows.filter((r) => r.status === 'open')).slice(0, SHOW)
  if (!picked.length) return null

  return (
    <section className="mt-10" aria-labelledby="my-housing-heading">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="my-housing-heading" className="text-xl font-bold">{name ? `${name} 청약·임대 공고` : '접수 중인 청약·임대 공고'}</h2>
        <Link href={valid ? `/housing/${valid}` : '/housing'} className="text-sm text-brand-700 hover:underline">{name ? `${name} 공고 전체 보기` : '공고 전체 보기'} →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {picked.map((r) => <HousingCard key={r.slug} row={r} />)}
      </div>
    </section>
  )
}
