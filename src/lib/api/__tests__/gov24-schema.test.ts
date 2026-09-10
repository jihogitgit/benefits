import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { serviceListResponse, supportConditionsResponse } from '../gov24-schema'

const list = JSON.parse(readFileSync('fixtures/gov24/serviceList.sample.json', 'utf8'))
const cond = JSON.parse(readFileSync('fixtures/gov24/supportConditions.sample.json', 'utf8'))

describe('gov24 schema', () => {
  it('serviceList fixture를 파싱한다', () => {
    const parsed = serviceListResponse.parse(list)
    expect(parsed.data.length).toBeGreaterThan(0)
    expect(parsed.data[0].서비스ID).toMatch(/\S/)
    expect(parsed.data[0].서비스명).toMatch(/\S/)
    expect(parsed.data[0].수정일시).toMatch(/^\d{14}$/)
  })

  it('빈 문자열 필드는 null로 정규화한다', () => {
    const parsed = serviceListResponse.parse({ ...list, data: [{ ...list.data[0], 신청기한: '  ' }] })
    expect(parsed.data[0].신청기한).toBeNull()
  })

  it('숫자로 온 필드는 문자열로 취급한다', () => {
    const parsed = serviceListResponse.parse({ ...list, data: [{ ...list.data[0], 전화문의: 120 }] })
    expect(parsed.data[0].전화문의).toBe('120')
  })

  it('supportConditions fixture를 파싱하고 JA 코드 키를 가진다', () => {
    const parsed = supportConditionsResponse.parse(cond)
    const keys = Object.keys(parsed.data[0]).filter((k) => k.startsWith('JA'))
    expect(keys.length).toBeGreaterThan(5)
  })

  it('서비스ID가 없으면 실패한다', () => {
    expect(() => serviceListResponse.parse({ ...list, data: [{ 서비스명: 'x' }] })).toThrow()
  })
})
