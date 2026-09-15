import { describe, it, expect, beforeEach } from 'vitest'
import { readDiagnosis, writeDiagnosis, toSearchParams, isEmpty, EMPTY, emptyDiagnosis, type Diagnosis } from '../storage'

describe('diagnosis storage', () => {
  beforeEach(() => localStorage.clear())

  it('저장하고 읽는다', () => {
    const d: Diagnosis = { q: '', ageBand: '30s', situations: ['pregnancy'], region: 'seoul' }
    writeDiagnosis(d)
    expect(readDiagnosis()).toEqual(d)
  })
  it('없거나 깨진 값은 빈 진단', () => {
    expect(readDiagnosis()).toEqual({ q: '', ageBand: null, situations: [], region: null })
    localStorage.setItem('diagnosis', '{not json')
    expect(readDiagnosis()).toEqual({ q: '', ageBand: null, situations: [], region: null })
  })
  it('허용되지 않은 값은 걸러낸다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '99s', situations: ['x', 'single'], region: 'mars' }))
    expect(readDiagnosis()).toEqual({ q: '', ageBand: null, situations: ['single'], region: null })
  })
  it('검색 API 쿼리스트링으로 변환', () => {
    expect(toSearchParams({ q: '', ageBand: '20s', situations: ['job_seeker', 'single'], region: null }).toString()).toBe('age=20s&situations=job_seeker%2Csingle')
    expect(toSearchParams({ q: '', ageBand: null, situations: [], region: 'busan' }).toString()).toBe('region=busan')
  })
  it('isEmpty', () => {
    expect(isEmpty({ q: '', ageBand: null, situations: [], region: null })).toBe(true)
    expect(isEmpty({ q: '', ageBand: null, situations: ['single'], region: null })).toBe(false)
  })

  it('실패 경로가 공유 객체를 돌려주지 않는다 (호출자가 변형해도 오염 없음)', () => {
    const a = readDiagnosis()
    a.situations.push('single')
    a.ageBand = '30s'
    expect(readDiagnosis()).toEqual({ q: '', ageBand: null, situations: [], region: null })
    expect(isEmpty(readDiagnosis())).toBe(true)
    expect(emptyDiagnosis()).not.toBe(emptyDiagnosis())
  })

  it('EMPTY는 동결되어 있다', () => {
    expect(Object.isFrozen(EMPTY)).toBe(true)
  })

  it('검색어를 저장하고 쿼리스트링에 싣는다', () => {
    const d: Diagnosis = { q: '청년 월세', ageBand: null, situations: [], region: null }
    writeDiagnosis(d)
    expect(readDiagnosis()).toEqual(d)
    expect(toSearchParams(d).toString()).toBe('q=%EC%B2%AD%EB%85%84+%EC%9B%94%EC%84%B8')
  })
  it('검색어만 있어도 빈 진단이 아니다', () => {
    expect(isEmpty({ q: '월세', ageBand: null, situations: [], region: null })).toBe(false)
  })
  it('손으로 심은 검색어는 정규화해서 읽는다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ q: "  월세%_,) '  지원  ", ageBand: null, situations: [], region: null }))
    expect(readDiagnosis().q).toBe('월세 지원')
    localStorage.setItem('diagnosis', JSON.stringify({ q: 42, ageBand: null, situations: [], region: null }))
    expect(readDiagnosis().q).toBe('')
  })

  it('중복 상황은 하나로 합친다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: null, situations: ['single', 'single', 'job_seeker'], region: null }))
    expect(readDiagnosis().situations).toEqual(['single', 'job_seeker'])
  })
})
