import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MyHousingBlock from '../MyHousingBlock'
import type { HousingCardRow } from '@/lib/housing/queries'
import { STORAGE_KEY } from '@/lib/diagnosis/storage'

const row = (slug: string, region_code: string): HousingCardRow => ({
  slug, title: slug, source: 'applyhome', kind: 'apt', kind_detail: null, region_code, status: 'open', receipt_start: '2026-01-19', receipt_end: '2026-01-25', total_units: 100, sp_newlywed_units: 0, sp_first_life_units: 0, sp_multi_child_units: 0, detail_url: null,
})
const rows = [row('서울1', 'seoul'), row('서울2', 'seoul'), row('부산1', 'busan'), row('전국1', 'ALL'), row('서울3', 'seoul'), row('서울4', 'seoul'), row('서울5', 'seoul')]

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-20T03:00:00Z'), toFake: ['Date'] })
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

describe('MyHousingBlock', () => {
  it('진단 지역이 있으면 그 지역 + 전국만, 최대 4건, 지역 목록으로 링크', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: '', ageBand: null, situations: [], region: 'seoul', incomeBand: null }))
    render(<MyHousingBlock rows={rows} />)
    await waitFor(() => expect(screen.getByText('서울 청약·임대 공고')).toBeInTheDocument())
    expect(screen.queryByText('부산1')).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByRole('link', { name: /서울 공고 전체 보기/ })).toHaveAttribute('href', '/housing/seoul')
  })

  it('지역이 없으면 전국 접수중 4건과 /housing 링크', async () => {
    render(<MyHousingBlock rows={rows} />)
    await waitFor(() => expect(screen.getByText('접수 중인 청약·임대 공고')).toBeInTheDocument())
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByRole('link', { name: /공고 전체 보기/ })).toHaveAttribute('href', '/housing')
  })

  it('저장된 지역이 목록에 없는 값이면 지역 없음으로 다룬다', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: '', ageBand: null, situations: [], region: 'nowhere', incomeBand: null }))
    render(<MyHousingBlock rows={rows} />)
    await waitFor(() => expect(screen.getByText('접수 중인 청약·임대 공고')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /공고 전체 보기/ })).toHaveAttribute('href', '/housing')
  })

  // 빈 제목만 남은 섹션은 내용 없는 화면으로 보인다(홈의 마감 임박 섹션과 같은 규칙).
  it('해당 공고가 0건이면 블록을 내지 않는다', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ q: '', ageBand: null, situations: [], region: 'jeju', incomeBand: null }))
    const { container } = render(<MyHousingBlock rows={[row('부산1', 'busan')]} />)
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
  })
})
