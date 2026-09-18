import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { GUIDE_FIGURES, resolveFigure } from '../guide-figures'

const DIR = join(process.cwd(), 'public/guide')

/**
 * 표와 실제 파일이 어긋나면 둘 중 하나가 조용히 망가진다. 표에만 있으면 독자가 깨진 이미지를
 * 보고, 파일에만 있으면 본문에 써도 그림이 되지 않는다. 크기가 틀리면 파일이 도착하는 순간
 * 본문이 밀린다 — 셋 다 화면을 봐야만 드러나는 종류라 여기서 막는다.
 */
describe('그림 목록', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.svg'))

  it('public/guide의 svg와 목록이 정확히 같다', () => {
    expect(files.sort()).toEqual(Object.keys(GUIDE_FIGURES).sort())
  })

  it.each(Object.keys(GUIDE_FIGURES))('%s의 크기가 viewBox와 같다', (name) => {
    const svg = readFileSync(join(DIR, name), 'utf8')
    const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
    expect(m, `${name}에 viewBox가 없다`).not.toBeNull()
    expect({ width: Number(m![1]), height: Number(m![2]) }).toEqual(GUIDE_FIGURES[name])
  })

  // 그림을 <img>로 부르면 브라우저가 SVG 안의 스크립트를 실행하지 않지만, 그건 부르는 쪽 규칙이라
  // 언젠가 인라인으로 바꾸면 사라진다. 실을 때 아예 없는 편이 안전하다.
  it.each(Object.keys(GUIDE_FIGURES))('%s에 스크립트나 외부 참조가 없다', (name) => {
    const svg = readFileSync(join(DIR, name), 'utf8')
    expect(svg).not.toMatch(/<script|<foreignObject|\son[a-z]+=|xlink:href|href="http/i)
  })

  /**
   * 범례를 단 그림은 막대에 쓴 색을 전부 범례에 두어야 한다.
   *
   * 상환 비교 그림에서 아래 행만 다른 색으로 칠해 놓고 범례에 그 줄을 넣지 않은 일이 있었다.
   * 범례를 대조하는 독자는 그 색을 찾지 못해 설명되지 않은 제3의 범주로 읽는다 — 색이
   * 범주와 행 정체를 동시에 나르는데 범례는 그중 하나만 설명하는 꼴이다.
   *
   * 색의 '뜻'은 묻지 않는다. 묻는 것은 "설명되지 않은 기호가 있는가" 하나이므로 집합
   * 포함만 보면 되고, 범례 문자열을 읽을 필요가 없다. 범례가 없는 그림은 건너뛴다 —
   * 그런 그림은 색을 축 위치·라벨·각주로 설명하므로 범례가 할 주장이 없다.
   */
  it.each(Object.keys(GUIDE_FIGURES))('%s: 막대에 쓴 색이 범례에 다 있다', (name) => {
    const svg = readFileSync(join(DIR, name), 'utf8')
    const swatches = new Set<string>()
    const marks = new Set<string>()
    for (const tag of svg.match(/<rect\b[^>]*>/g) ?? []) {
      const fill = /fill="(#[0-9a-f]{6})"/i.exec(tag)?.[1]
      const w = Number(/\bwidth="([\d.]+)"/.exec(tag)?.[1])
      const h = Number(/\bheight="([\d.]+)"/.exec(tag)?.[1])
      if (!fill || fill === '#ffffff' || !w || !h) continue
      // 범례 견본은 한 변 16px 이하의 정사각형이다. 그보다 크거나 찌그러진 것은 데이터다.
      if (w === h && w <= 16) swatches.add(fill)
      else marks.add(fill)
    }
    for (const fill of svg.match(/<path\b[^>]*fill="#[0-9a-f]{6}"/gi) ?? []) {
      const c = /fill="(#[0-9a-f]{6})"/i.exec(fill)![1]
      if (c !== '#ffffff') marks.add(c)
    }
    if (swatches.size === 0) return
    const unexplained = [...marks].filter((c) => !swatches.has(c))
    expect(unexplained, `${name}의 ${unexplained.join(', ')}가 범례에 없다`).toEqual([])
  })
})

describe('resolveFigure', () => {
  it('실린 그림이면 주소와 크기를 돌려준다', () => {
    expect(resolveFigure('/guide/youth-challenge-350.svg')).toEqual({
      src: '/guide/youth-challenge-350.svg',
      width: 480,
      height: 180,
    })
  })

  // 이름 패턴이 아니라 목록으로 거른다. 오타는 형태가 멀쩡해도 통과하면 안 된다.
  it.each([
    ['/guide/youth-challenge-35.svg', '오타 난 파일명'],
    ['/guide/없는파일.svg', '없는 파일'],
    ['/guide/../secret.svg', '상위 경로'],
    ['/guide/sub/youth-challenge-350.svg', '하위 폴더'],
    ['https://example.com/youth-challenge-350.svg', '외부 주소'],
    ['/uploads/youth-challenge-350.svg', '다른 폴더'],
    ['javascript:alert(1)', '스킴'],
    ['/guide/youth-challenge-350.svg?v=2', '쿼리스트링'],
  ])('%s는 거른다 (%s)', (src) => {
    expect(resolveFigure(src)).toBeNull()
  })
})
