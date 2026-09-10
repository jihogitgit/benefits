import { describe, it, expect, beforeEach } from 'vitest'
import { readDiagnosis, writeDiagnosis, toSearchParams, isEmpty, type Diagnosis } from '../storage'

describe('diagnosis storage', () => {
  beforeEach(() => localStorage.clear())

  it('저장하고 읽는다', () => {
    const d: Diagnosis = { ageBand: '30s', situations: ['pregnancy'], region: 'seoul' }
    writeDiagnosis(d)
    expect(readDiagnosis()).toEqual(d)
  })
  it('없거나 깨진 값은 빈 진단', () => {
    expect(readDiagnosis()).toEqual({ ageBand: null, situations: [], region: null })
    localStorage.setItem('diagnosis', '{not json')
    expect(readDiagnosis()).toEqual({ ageBand: null, situations: [], region: null })
  })
  it('허용되지 않은 값은 걸러낸다', () => {
    localStorage.setItem('diagnosis', JSON.stringify({ ageBand: '99s', situations: ['x', 'single'], region: 'mars' }))
    expect(readDiagnosis()).toEqual({ ageBand: null, situations: ['single'], region: null })
  })
  it('검색 API 쿼리스트링으로 변환', () => {
    expect(toSearchParams({ ageBand: '20s', situations: ['job_seeker', 'single'], region: null }).toString()).toBe('age=20s&situations=job_seeker%2Csingle')
    expect(toSearchParams({ ageBand: null, situations: [], region: 'busan' }).toString()).toBe('region=busan')
  })
  it('isEmpty', () => {
    expect(isEmpty({ ageBand: null, situations: [], region: null })).toBe(true)
    expect(isEmpty({ ageBand: null, situations: ['single'], region: null })).toBe(false)
  })
})
