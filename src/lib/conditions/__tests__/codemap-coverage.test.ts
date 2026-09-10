import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CODEMAP, AGE_MIN_CODE, AGE_MAX_CODE } from '../codemap'

const cond = JSON.parse(readFileSync('fixtures/gov24/supportConditions.sample.json', 'utf8'))

describe('codemap coverage', () => {
  it('fixture에 등장하는 모든 JA 코드는 codemap에 정의되어 있다', () => {
    const keys = new Set<string>()
    for (const row of cond.data) for (const k of Object.keys(row)) if (k.startsWith('JA')) keys.add(k)
    const missing = [...keys].filter((k) => !(k in CODEMAP) && k !== AGE_MIN_CODE && k !== AGE_MAX_CODE)
    expect(missing, `codemap에 없는 코드: ${missing.join(', ')} — codemap.ts에 추가`).toEqual([])
  })

  it('나이 코드는 fixture에서 숫자 또는 null이다', () => {
    for (const row of cond.data) {
      for (const k of [AGE_MIN_CODE, AGE_MAX_CODE]) {
        const v = row[k]
        expect(v === null || typeof v === 'number', `${k}=${JSON.stringify(v)}`).toBe(true)
      }
    }
  })
})
