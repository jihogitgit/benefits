import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchBox from '../SearchBox'

/**
 * 가짜 타이머는 쓰지 않는다. jsdom + React 이벤트 조합에서 advanceTimersByTime이 디바운스
 * 콜백을 발화시키지 못해, 통과하는데 아무것도 검증하지 않는 테스트가 되기 쉽다(리뷰에서 확인됨).
 * 실제 타이머로 "아직 안 됐다 / 이제 됐다"를 양쪽 다 단언한다.
 */
const DEBOUNCE_MS = 300
const props = { label: '지원금 이름으로 찾기', placeholder: '예: 청년 월세' }

describe('SearchBox', () => {
  const onChange = vi.fn()
  beforeEach(() => onChange.mockReset())

  const input = () => screen.getByLabelText(props.label)

  it('디바운스 전에는 발화하지 않고, 지나면 한 번 발화한다', async () => {
    render(<SearchBox value="" onChange={onChange} {...props} />)
    fireEvent.change(input(), { target: { value: '청년' } })

    await new Promise((r) => setTimeout(r, DEBOUNCE_MS - 150))
    expect(onChange).not.toHaveBeenCalled()

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 1000 })
    expect(onChange).toHaveBeenCalledWith('청년')
  })

  it('연속 입력은 마지막 값으로 한 번만 발화한다', async () => {
    render(<SearchBox value="" onChange={onChange} {...props} />)
    for (const v of ['청', '청년', '청년 ', '청년 월', '청년 월세']) {
      fireEvent.change(input(), { target: { value: v } })
      await new Promise((r) => setTimeout(r, 40))
    }
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 1000 })
    expect(onChange).toHaveBeenCalledWith('청년 월세')
  })

  it('포커스를 잃으면 디바운스를 기다리지 않고 바로 확정한다', () => {
    // 검색어를 치자마자 링크를 누르면 blur가 클릭보다 먼저 온다. 여기서 확정하지 않으면
    // 대기 중이던 타이머가 언마운트 정리로 버려져 방금 친 검색어가 통째로 유실된다.
    render(<SearchBox value="" onChange={onChange} {...props} />)
    fireEvent.change(input(), { target: { value: '청년 월세' } })
    fireEvent.blur(input())
    expect(onChange).toHaveBeenCalledWith('청년 월세')
  })

  it('Enter를 누르면 바로 확정한다', () => {
    render(<SearchBox value="" onChange={onChange} {...props} />)
    fireEvent.change(input(), { target: { value: '근로장려금' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('근로장려금')
  })

  it('확정된 값을 다시 확정하지 않는다', () => {
    render(<SearchBox value="월세" onChange={onChange} {...props} />)
    fireEvent.blur(input())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('기호만 입력하면 발화하지 않고 이유를 알려준다', () => {
    render(<SearchBox value="" onChange={onChange} {...props} />)
    fireEvent.change(input(), { target: { value: '???!!!' } })
    fireEvent.blur(input())
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/검색에 쓸 수 있는 글자가 없습니다/)).toBeInTheDocument()
  })

  it('지우기 버튼은 즉시 빈 값으로 확정한다', () => {
    render(<SearchBox value="월세" onChange={onChange} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(onChange).toHaveBeenCalledWith('')
    expect(input()).toHaveValue('')
  })

  it('바깥에서 값이 바뀌면 입력칸에 반영한다 (localStorage 복원)', async () => {
    const { rerender } = render(<SearchBox value="" onChange={onChange} {...props} />)
    rerender(<SearchBox value="근로장려금" onChange={onChange} {...props} />)
    await waitFor(() => expect(input()).toHaveValue('근로장려금'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('인스턴스마다 다른 id를 써서 라벨 연결이 겹치지 않는다', () => {
    const { container } = render(
      <>
        <SearchBox value="" onChange={onChange} {...props} label="A" />
        <SearchBox value="" onChange={onChange} {...props} label="B" />
      </>,
    )
    const ids = [...container.querySelectorAll('input')].map((el) => el.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})
