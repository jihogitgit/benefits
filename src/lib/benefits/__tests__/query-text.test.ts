import { describe, it, expect } from 'vitest'
import { normalizeQuery, queryTokens, Q_MAX_LEN, Q_MAX_TOKENS } from '../query-text'

describe('normalizeQuery', () => {
  it('문자·숫자·공백만 남기고 공백을 하나로 줄인다', () => {
    expect(normalizeQuery('  청년   월세  ')).toBe('청년 월세')
    expect(normalizeQuery('청년(만39세)')).toBe('청년 만39세')
  })
  it('PostgREST·ILIKE 문법 문자를 남기지 않는다', () => {
    // 이 문자들이 그대로 나가면 or() 필터가 깨지거나 와일드카드로 해석된다.
    for (const ch of [',', '(', ')', '"', '\\', '%', '_', '.', ':', '*']) {
      expect(normalizeQuery(`월세${ch}지원`)).not.toContain(ch)
    }
    expect(normalizeQuery('%_,()')).toBe('')
  })
  it('빈 값·공백뿐인 값은 빈 문자열', () => {
    expect(normalizeQuery(null)).toBe('')
    expect(normalizeQuery(undefined)).toBe('')
    expect(normalizeQuery('   ')).toBe('')
  })
  it('길이를 제한하고 잘린 뒤 남은 공백도 정리한다', () => {
    const long = normalizeQuery('가'.repeat(Q_MAX_LEN + 20))
    expect(long.length).toBe(Q_MAX_LEN)
    // 상한에서 잘리며 끝이 공백이 되어도 트림된다
    expect(normalizeQuery('가'.repeat(Q_MAX_LEN - 1) + ' 나')).toBe('가'.repeat(Q_MAX_LEN - 1))
  })
})

describe('queryTokens', () => {
  it('공백으로 나누고 개수를 제한한다', () => {
    expect(queryTokens('청년 월세')).toEqual(['청년', '월세'])
    expect(queryTokens('')).toEqual([])
    expect(queryTokens('가 나 다 라 마 바').length).toBe(Q_MAX_TOKENS)
  })
  it('정규화를 거치지 않은 문자열도 안전하게 받는다', () => {
    expect(queryTokens('  청년,월세  ')).toEqual(['청년', '월세'])
  })
})

describe('코드 포인트 경계', () => {
  it('길이 제한이 서로게이트 페어를 반토막 내지 않는다', () => {
    // String.slice는 UTF-16 코드 유닛을 세기 때문에 astral plane 문자가 경계에 걸리면
    // 고아 서로게이트가 남고, URL 직렬화에서 U+FFFD로 바뀌어 검색어가 조용히 달라진다.
    const q = normalizeQuery('a' + '𠀀'.repeat(Q_MAX_LEN))
    expect([...q].length).toBe(Q_MAX_LEN)
    // 정상적인 astral 문자는 서로게이트 '쌍'으로 표현되므로 쌍을 이루지 못한 것만 잡는다
    expect(q).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
    expect(encodeURIComponent(q)).not.toContain('%EF%BF%BD')
  })
})
