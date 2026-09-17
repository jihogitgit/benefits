import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import SectionNav from '../SectionNav'

const S = [
  { id: 'summary', label: '한눈에 보기' },
  { id: 'steps', label: '신청 순서' },
  { id: 'faq', label: '자주 묻는 질문' },
]

function chips() {
  return within(screen.getByRole('navigation', { name: '목차' })).getAllByRole('link')
}

describe('SectionNav', () => {
  // 이 컴포넌트의 계약은 "칩에 적힌 이름과 실제로 가는 곳이 같다"는 것 하나다.
  // href 문자열이 마크업 어딘가에 있는지만 보면 라벨과 앵커가 서로 뒤바뀌어도,
  // 순서가 뒤집혀도, 일부가 빠져도 통과한다. 쌍·순서·개수를 한 번에 고정한다.
  it('칩의 이름과 앵커가 짝이 맞고 순서와 개수가 같다', () => {
    render(<SectionNav sections={S} />)
    expect(chips().map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['한눈에 보기', '#summary'],
      ['신청 순서', '#steps'],
      ['자주 묻는 질문', '#faq'],
    ])
  })

  // 이 컴포넌트가 존재하는 이유가 모바일이다. StickyRail이 hidden lg:block이라 1024px
  // 미만에서는 목차가 아예 렌더되지 않아, 글에 FAQ나 신청 순서가 있다는 사실이 보이지
  // 않았다. lg:hidden이 빠지면 PC에서 목차가 두 개가 되고 모바일 문제는 그대로 남는다.
  // 클래스가 nav가 아닌 li에 붙어도 마크업에는 똑같이 보이므로 요소를 지정해 확인한다.
  it('목차 전체가 모바일 전용이다 (PC는 StickyRail이 담당)', () => {
    render(<SectionNav sections={S} />)
    expect(screen.getByRole('navigation', { name: '목차' })).toHaveClass('lg:hidden')
  })

  it('가로 스크롤은 목차 요소 안에서만 일어난다', () => {
    // 페이지 본문이 가로로 밀리면 안 된다. 스크롤 컨테이너는 nav여야 하고,
    // 칩은 줄바꿈 없이 그 안에서 넘쳐야 한다.
    render(<SectionNav sections={S} />)
    expect(screen.getByRole('navigation', { name: '목차' })).toHaveClass('overflow-x-auto')
    for (const a of chips()) expect(a).toHaveClass('whitespace-nowrap')
  })

  it('항목이 하나뿐이면 렌더하지 않는다', () => {
    // 목차가 목차 구실을 못 하면 자리만 차지한다
    const { container: one } = render(<SectionNav sections={[S[0]]} />)
    expect(one).toBeEmptyDOMElement()
    const { container: none } = render(<SectionNav sections={[]} />)
    expect(none).toBeEmptyDOMElement()
  })
})
