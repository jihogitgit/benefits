import { describe, it, expect } from 'vitest'
import { hasFinalConsonant, eulReul, iGa, eunNeun } from '../korean'

describe('hasFinalConsonant', () => {
  it.each([
    ['출산장려금', true, '받침 ㅁ'],
    ['산모신생아건강관리', false, '받침 없음'],
    ['장애인활동지원(추가)', false, '기호로 끝나면 앞 글자를 본다'],
    ['체육시설이용요금감면', true, '받침 ㄴ'],
    ['벼육묘', false, '묘'],
  ])('%s → %s (%s)', (word, expected) => {
    expect(hasFinalConsonant(word)).toBe(expected)
  })

  it.each([
    ['제1종', true],
    ['보조금24', false], // 이십사
    ['지원금1', true], // 일
    ['등급3', true], // 삼
  ])('숫자로 끝나면 읽는 소리를 본다: %s → %s', (word, expected) => {
    expect(hasFinalConsonant(word)).toBe(expected)
  })

  it('판단할 수 없으면 null이다', () => {
    expect(hasFinalConsonant('')).toBe(null)
    expect(hasFinalConsonant('(())')).toBe(null)
  })
})

describe('조사', () => {
  it('받침에 따라 갈린다', () => {
    expect(eulReul('출산장려금')).toBe('을')
    expect(eulReul('산모신생아건강관리')).toBe('를')
    expect(iGa('출산장려금')).toBe('이')
    expect(iGa('산모신생아건강관리')).toBe('가')
    expect(eunNeun('출산장려금')).toBe('은')
    expect(eunNeun('산모신생아건강관리')).toBe('는')
  })

  // 판단이 안 되면 어느 쪽이든 틀리지만, 받침 없는 쪽이 외래어·기호에서 덜 어색하다.
  it('판단이 안 되면 받침 없는 쪽', () => {
    expect(eulReul('')).toBe('를')
  })
})
