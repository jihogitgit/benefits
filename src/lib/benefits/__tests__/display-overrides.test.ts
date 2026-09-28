import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DISPLAY_OVERRIDES, withDisplayOverrides, hasSummaryOverride } from '../display-overrides'

describe('요약 보정표', () => {
  it('보정이 없는 사업은 같은 객체를 돌려준다', () => {
    const row = { slug: '없는-사업', summary: '원문', target_text: '원문 대상' }
    expect(withDisplayOverrides(row)).toBe(row)
    expect(hasSummaryOverride('없는-사업')).toBe(false)
  })

  it('summary와 target_text를 바꾸고 나머지 필드는 둔다', () => {
    const row = { slug: '주거안정-월세대출', summary: '연 960만원 한도로 월세대출 지원', target_text: '우대형의 경우 사회취약계층', amount_text: 'x' }
    const out = withDisplayOverrides(row)
    expect(out.summary).toContain('1,440만원')
    expect(out.summary).not.toContain('960')
    expect(out.target_text).toBe(DISPLAY_OVERRIDES['주거안정-월세대출'].target)
    expect(out.amount_text).toBe('x')
  })

  it('target_text가 없는 목록 행에는 target_text를 만들지 않는다', () => {
    const out = withDisplayOverrides({ slug: '주거안정-월세대출', summary: 's' })
    expect('target_text' in out).toBe(false)
  })

  // firstLine이 첫 줄만 쓰고 요약 칸은 line-clamp-3이다. 여러 줄이나 너무 긴 문구는 잘린다.
  it('모든 문구가 한 줄이고 요약 칸 한도(60자) 안쪽이다', () => {
    for (const [slug, o] of Object.entries(DISPLAY_OVERRIDES)) {
      for (const v of [o.summary, o.target]) {
        if (v === undefined) continue
        expect(v, slug).not.toMatch(/\n/)
        expect(v.length, `${slug}: ${v}`).toBeLessThanOrEqual(60)
      }
    }
  })

  // 보정이 실제로 화면에 걸리는지. 호출부에서 빠지면 표만 있고 아무것도 바뀌지 않는다.
  it('요약 칸·카드·상세 메타가 보정을 거친다', () => {
    for (const f of ['src/components/benefits/SummaryGrid.tsx', 'src/components/benefits/BenefitCard.tsx', 'src/app/(site)/benefit/[slug]/page.tsx']) {
      expect(readFileSync(f, 'utf8'), f).toContain('withDisplayOverrides(')
    }
  })
})
