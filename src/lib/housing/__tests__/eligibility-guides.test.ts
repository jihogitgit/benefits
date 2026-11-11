import { describe, it, expect } from 'vitest'
import { ELIGIBILITY_GUIDES, MEDIAN_INCOME_100, RELAXED_NOTICE, RELAXED_NOTICE_UNVERIFIED, URBAN_INCOME_100, incomeLimit, relaxedNotice } from '../eligibility-guides'

describe('소득 한도 계산', () => {
  // 공식 표에 적힌 값과 대조한다(마이홈 국민임대 70%·50% 열, LH 행복주택 110%·120% 열 — 조사 문서 기본표 1).
  it.each([
    [70, 1, 3_432_027], // 1인은 90%
    [70, 2, 4_693_016], // 2인은 80%
    [70, 3, 5_717_900],
    [70, 4, 6_161_541],
    [70, 7, 7_339_879],
    [50, 1, 2_669_354], // 1인은 70%
    [50, 2, 3_519_762], // 2인은 60%
    [50, 3, 4_084_215],
    [50, 7, 5_242_771],
    [100, 1, 4_576_036], // 1인은 120%
    [100, 2, 6_452_897], // 2인은 110%
    [100, 3, 8_168_429],
    [100, 8, 11_064_819],
  ])('도시근로자 %i%% 기준 %i인 = %i원', (pct, size, expected) => {
    expect(incomeLimit(URBAN_INCOME_100, pct, size)).toBe(expected)
  })

  it.each([
    [150, 3, 8_038_554],
    [150, 4, 9_742_107],
    [150, 8, 15_711_522],
    [100, 3, 5_359_036],
  ])('기준 중위소득 %i%% 기준 %i인 = %i원', (pct, size, expected) => {
    expect(incomeLimit(MEDIAN_INCOME_100, pct, size)).toBe(expected)
  })

  it('소득표는 1~8인이고 가구원이 늘수록 커진다', () => {
    for (const t of [URBAN_INCOME_100, MEDIAN_INCOME_100]) {
      expect(t).toHaveLength(8)
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1])
    }
  })
})

describe('자격 안내 데이터', () => {
  const entries = Object.entries(ELIGIBILITY_GUIDES)

  it('안내가 실제로 있다(빈 객체면 아래 검사가 공허하게 통과한다)', () => {
    expect(entries.length).toBeGreaterThan(10)
  })

  it.each(entries)('%s: 요약·항목·근거가 있고 근거는 https 공식 주소다', (_key, g) => {
    expect(g!.name.length).toBeGreaterThan(1)
    expect(g!.summary.length).toBeGreaterThan(20)
    expect(g!.rows.length).toBeGreaterThanOrEqual(2)
    for (const r of g!.rows) {
      expect(r.label.length).toBeGreaterThan(0)
      expect(r.text.length).toBeGreaterThan(5)
    }
    expect(new Set(g!.rows.map((r) => r.label)).size).toBe(g!.rows.length) // 화면이 label을 key로 쓴다
    expect(g!.sources.length).toBeGreaterThan(0)
    for (const s of g!.sources) {
      const host = new URL(s.url).hostname
      expect(s.url.startsWith('https://')).toBe(true)
      expect(host).toMatch(/(^|\.)(law\.go\.kr|myhome\.go\.kr|lh\.or\.kr|molit\.go\.kr|applyhome\.co\.kr|korea\.kr)$/)
    }
  })

  it.each(entries.filter(([, g]) => g!.income))('%s: 소득표 비율이 본문에 나온다', (_key, g) => {
    const body = [g!.summary, ...g!.rows.map((r) => r.text)].join(' ')
    for (const p of g!.income!.pcts) expect(body).toContain(`${p}%`)
  })

  // 템플릿에 넣은 금액이 undefined로 찍히지 않았는지.
  it.each(entries)('%s: 본문에 undefined·NaN이 없다', (_key, g) => {
    expect(JSON.stringify(g)).not.toMatch(/undefined|NaN/)
  })
})

describe('자격 완화 안내 문구', () => {
  it('완화 조항을 확인한 유형만 "법령에 따라"라고 말한다', () => {
    expect(relaxedNotice('national_rent')).toBe(RELAXED_NOTICE)
    expect(relaxedNotice('purchase_youth')).toBe(RELAXED_NOTICE)
    for (const k of ['public_rent_50', 'public_rent_convertible', 'jeonse_rent'] as const) expect(relaxedNotice(k)).toBe(RELAXED_NOTICE_UNVERIFIED)
    expect(RELAXED_NOTICE).toContain('법령에 따라')
    expect(RELAXED_NOTICE_UNVERIFIED).not.toContain('법령')
  })
})

describe('검수에서 고친 문장이 되돌아가지 않는다', () => {
  const text = (k: keyof typeof ELIGIBILITY_GUIDES) => JSON.stringify(ELIGIBILITY_GUIDES[k])
  it('전세임대는 소득 금액표를 싣지 않는다(1·2인 가산 근거를 확인하지 못했다)', () => {
    expect(ELIGIBILITY_GUIDES.jeonse_rent!.income).toBeUndefined()
  })
  it('신혼희망타운 맞벌이는 140%와 200%를 구분한다', () => {
    expect(text('newlywed_town_sale')).toContain('140% 이하')
    expect(text('newlywed_town_sale')).toContain('1,054만원')
  })
  it('공공분양 소득·자산은 공공주택사업자 공급분이라고 밝힌다', () => {
    expect(ELIGIBILITY_GUIDES.public_sale!.summary).toContain('공공주택사업자')
  })
  it('든든전세는 비분양전환형을 분양 기회에서 뺀다', () => {
    expect(text('purchase_dundun')).toContain('비분양전환형')
  })
  it('일반 매입임대 재계약 횟수를 숫자로 단정하지 않는다', () => {
    expect(text('purchase_general')).not.toMatch(/(9|14)회/)
  })
  it('국민임대·통합공공임대 요약은 자산 한도를 말한다', () => {
    expect(ELIGIBILITY_GUIDES.national_rent!.summary).toContain('자산')
    expect(ELIGIBILITY_GUIDES.integrated_rent!.summary).toContain('자산')
  })
})
