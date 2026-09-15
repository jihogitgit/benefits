import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Markdown from '../Markdown'

describe('Markdown', () => {
  it('제목 바로 아래(빈 줄 없이) 이어지는 본문을 잃지 않는다', () => {
    render(<Markdown text={'## 신청 방법\n1. 정부24 접속\n2. 공동인증서 로그인'} />)
    expect(screen.getByRole('heading', { name: '신청 방법' })).toBeInTheDocument()
    expect(screen.getByText('정부24 접속')).toBeInTheDocument()
    expect(screen.getByText('공동인증서 로그인')).toBeInTheDocument()
  })

  it('제목 뒤 본문이 목록이면 목록으로 렌더한다', () => {
    const { container } = render(<Markdown text={'# 대상\n- 만 19세 이상\n- 서울 거주'} />)
    expect(screen.getByRole('heading', { name: '대상' })).toBeInTheDocument()
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
  })

  it('제목 뒤 본문이 단락이면 단락으로 렌더한다', () => {
    render(<Markdown text={'## 유의사항\n예산 소진 시 조기 마감됩니다.'} />)
    expect(screen.getByText('예산 소진 시 조기 마감됩니다.')).toBeInTheDocument()
  })

  it('빈 줄로 구분된 기존 문서도 그대로 동작한다', () => {
    const { container } = render(<Markdown text={'# 제목\n\n첫 단락\n\n- a\n- b'} />)
    expect(screen.getByRole('heading', { name: '제목' })).toBeInTheDocument()
    expect(screen.getByText('첫 단락')).toBeInTheDocument()
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
  })
})
