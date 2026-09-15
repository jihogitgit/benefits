import { describe, it, expect } from 'vitest'
import { groupByWeek } from '../calendar'
import type { BenefitListRow } from '../queries'

const row = (slug: string, end: string): BenefitListRow => ({
  slug,
  title: slug,
  summary: null,
  amount_text: null,
  deadline_type: 'period',
  apply_start: null,
  apply_end: end,
  region_code: 'ALL',
  segments: ['other'],
  agency: null,
  synced_at: '',
})
const now = new Date('2026-09-10T03:00:00Z') // 목요일

describe('groupByWeek', () => {
  it('이번 주 / 다음 주 / 이달 안 / 그 이후 로 묶고 각 그룹은 마감 오름차순', () => {
    const g = groupByWeek([row('c', '2026-09-25'), row('a', '2026-09-11'), row('b', '2026-09-16'), row('d', '2026-10-05')], now)
    expect(g.map((x) => x.label)).toEqual(['이번 주', '다음 주', '이달 안', '그 이후'])
    expect(g[0].rows.map((r) => r.slug)).toEqual(['a'])
    expect(g[1].rows.map((r) => r.slug)).toEqual(['b'])
    expect(g[2].rows.map((r) => r.slug)).toEqual(['c'])
    expect(g[3].rows.map((r) => r.slug)).toEqual(['d'])
  })
  it('빈 그룹은 제외', () => {
    expect(groupByWeek([row('a', '2026-09-11')], now).map((x) => x.label)).toEqual(['이번 주'])
  })
  it('이미 지난 마감은 버린다', () => {
    expect(groupByWeek([row('past', '2026-09-09'), row('today', '2026-09-10')], now).flatMap((x) => x.rows.map((r) => r.slug))).toEqual(['today'])
  })
})
