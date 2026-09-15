import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Checklist from '../Checklist'
import type { ConditionJoin } from '@/lib/benefits/queries'
import type { CheckItem } from '@/lib/benefits/checklist'

const cond: ConditionJoin = {
  age_min: 19,
  age_max: 34,
  gender: 'any',
  income_bands: [],
  life_stages: [],
  household_types: [],
  occupations: ['job_seeker'],
  region_codes: ['seoul'],
}
const items: CheckItem[] = [
  { key: 'age', label: '만 19~34세' },
  { key: 'region', label: '서울 거주' },
  { key: 'occupation:job_seeker', label: '구직자·실업자' },
]

describe('Checklist', () => {
  beforeEach(() => localStorage.clear())

  it('진단값으로 프리필하고 요약 문장을 보여준다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '20s', situations: ['job_seeker'], region: 'seoul' }))
    render(<Checklist items={items} cond={cond} />)
    expect(screen.getByText(/3개 조건 모두 충족/)).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(3)
  })

  it('사용자가 직접 체크를 바꿀 수 있다', () => {
    render(<Checklist items={items} cond={cond} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes[0].checked).toBe(false)
    fireEvent.click(boxes[0])
    expect(boxes[0].checked).toBe(true)
    expect(screen.getByText(/3개 중 1개 충족/)).toBeInTheDocument()
  })

  it('항목이 없으면 안내만', () => {
    render(<Checklist items={[]} cond={null} />)
    expect(screen.getByText(/대상 조건이 등록되지 않은/)).toBeInTheDocument()
  })
})

describe('Checklist 부분 겹침', () => {
  beforeEach(() => localStorage.clear())

  it('나이대가 일부만 겹치면 체크를 비우고 "나이 확인 필요"를 붙인다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '30s', situations: [], region: 'seoul' }))
    render(<Checklist items={items} cond={cond} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes[0].checked).toBe(false) // 만 19~34세 ∩ 30대 = 부분
    expect(screen.getByText(/나이 확인 필요/)).toBeInTheDocument()
    expect(screen.queryByText(/바로 신청/)).not.toBeInTheDocument()
  })

  it('부분 겹침 항목도 사용자가 직접 체크할 수 있다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '30s', situations: [], region: 'seoul' }))
    render(<Checklist items={items} cond={cond} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(boxes[0])
    expect(boxes[0].checked).toBe(true)
  })
})

describe('Checklist 상태 유지', () => {
  beforeEach(() => localStorage.clear())

  it('부모가 새 props 참조로 리렌더돼도 사용자가 켠 체크를 되돌리지 않는다', () => {
    const { rerender } = render(<Checklist items={items} cond={cond} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(boxes[0])
    expect(boxes[0].checked).toBe(true)
    // RSC 페이로드 갱신을 흉내낸다: 내용은 같고 참조만 새 객체
    rerender(<Checklist items={items.map((i) => ({ ...i }))} cond={{ ...cond }} />)
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true)
  })
})

describe('Checklist 판정 불가 항목', () => {
  beforeEach(() => localStorage.clear())

  it('성별·소득 항목에는 빈 칸이 "자격 없음"으로 읽히지 않게 "직접 확인"을 붙인다', () => {
    const withIncome = [...items, { key: 'income:0-50', label: '중위소득 50% 이하' }, { key: 'gender', label: '여성' }]
    render(<Checklist items={withIncome} cond={cond} />)
    expect(screen.getAllByText(/직접 확인/)).toHaveLength(2)
  })
})
