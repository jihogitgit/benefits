import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import SourceFooter from '../SourceFooter'
import { CURATED_SOURCE } from '../../../../data/curated-benefits'

const FRESH = '2026-09-17T00:00:00+09:00'
const OLD = '2025-01-01T00:00:00+09:00'

function at(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

afterEach(() => vi.useRealTimers())

describe('SourceFooter', () => {
  it('보조금24 행은 보조금24를 출처로 밝히고 정부24 원문을 건다', () => {
    at('2026-09-17T09:00:00+09:00')
    render(
      <SourceFooter source="gov24" agency="보건복지부" syncedAt={FRESH} sourceUpdatedAt={null} applyUrl="https://www.gov.kr/x" />,
    )
    expect(screen.getByText(/행정안전부 보조금24/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '정부24 원문 보기' }).getAttribute('href')).toBe('https://www.gov.kr/x')
  })

  it('손으로 채운 행은 보조금24를 출처로 주장하지 않는다', () => {
    at('2026-09-17T09:00:00+09:00')
    render(
      <SourceFooter
        source={CURATED_SOURCE}
        agency="보건복지부"
        syncedAt={FRESH}
        sourceUpdatedAt={null}
        applyUrl="https://www.bokjiro.go.kr/"
        evidence={[{ label: '보건복지부 안내', url: 'https://www.mohw.go.kr/x' }]}
      />,
    )
    expect(screen.queryByText(/보조금24 오픈API에는 이 제도가 없습니다/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('출처: 행정안전부 보조금24')
    expect(screen.queryByRole('link', { name: '정부24 원문 보기' })).toBeNull()
    expect(screen.getByRole('link', { name: '보건복지부 안내' }).getAttribute('href')).toBe('https://www.mohw.go.kr/x')
  })

  it('보조금24 행은 하루만 지나도 낡았다고 말한다', () => {
    at('2026-09-19T09:00:00+09:00')
    render(<SourceFooter source="gov24" agency={null} syncedAt={FRESH} sourceUpdatedAt={null} applyUrl={null} />)
    expect(screen.getByText(/24시간 이상 지난 정보/)).toBeTruthy()
  })

  it('손으로 채운 행은 하루 지났다고 경고하지 않는다 — 매일 갱신되는 행이 아니다', () => {
    at('2026-09-19T09:00:00+09:00')
    render(<SourceFooter source={CURATED_SOURCE} agency={null} syncedAt={FRESH} sourceUpdatedAt={null} applyUrl={null} />)
    expect(document.body.textContent).not.toContain('공식 페이지에서 확인하세요')
  })

  it('손으로 채운 행도 대조가 오래 끊기면 스스로 드러낸다', () => {
    at('2026-09-19T09:00:00+09:00')
    render(<SourceFooter source={CURATED_SOURCE} agency={null} syncedAt={OLD} sourceUpdatedAt={null} applyUrl={null} />)
    expect(screen.getByText(/180일 넘게 대조하지 않았습니다/)).toBeTruthy()
  })
})

describe('손으로 채운 행의 날짜 표기', () => {
  it('근거 문서에 없는 시각을 만들어 붙이지 않는다', () => {
    at('2026-09-19T09:00:00+09:00')
    render(
      <SourceFooter
        source={CURATED_SOURCE}
        agency="보건복지부"
        syncedAt="2026-09-18T00:00:00+09:00"
        sourceUpdatedAt="2026-03-25T00:00:00+00:00"
        applyUrl={null}
      />,
    )
    expect(document.body.textContent).toContain('근거 문서 수정 2026.03.25')
    expect(document.body.textContent).toContain('근거 문서와 마지막 대조 2026.09.18')
    expect(document.body.textContent).not.toMatch(/\d{2}:\d{2}/)
  })

  it('보조금24 행은 동기화 시각을 분까지 그대로 보여준다', () => {
    at('2026-09-18T09:00:00+09:00')
    render(<SourceFooter source="gov24" agency={null} syncedAt="2026-09-18T06:34:52+00:00" sourceUpdatedAt={null} applyUrl={null} />)
    expect(document.body.textContent).toContain('최종 확인 2026.09.18 15:34')
  })
})
