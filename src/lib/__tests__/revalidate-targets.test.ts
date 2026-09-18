import { describe, it, expect } from 'vitest'
import { parseArgs, buildTargets, assertSlug, MAX_ITEMS } from '../revalidate-targets'

describe('parseArgs', () => {
  it('--url=X 와 --url X 를 모두 받는다', () => {
    expect(parseArgs(['--url=https://naemok.com']).url).toBe('https://naemok.com')
    expect(parseArgs(['--url', 'https://naemok.com']).url).toBe('https://naemok.com')
  })

  it('--url 뒤가 비면 던진다', () => {
    // 이걸 허용하면 다음 인자가 주소로 먹혀 슬러그가 사라진다
    expect(() => parseArgs(['--url'])).toThrow()
  })

  it('플래그 없는 인자는 지원금 슬러그, --guide는 가이드 슬러그로 간다', () => {
    const a = parseArgs(['청년월세-지원', '--guide=출산지원금', '두루누리', '--guide', '국가장학금'])
    expect(a.slugs).toEqual(['청년월세-지원', '두루누리'])
    expect(a.guides).toEqual(['출산지원금', '국가장학금'])
  })

  it('--guide 뒤가 비면 던진다', () => {
    expect(() => parseArgs(['--guide'])).toThrow()
  })

  it('모르는 플래그는 조용히 무시하지 않는다', () => {
    // --ulr= 같은 오타가 기본값으로 흘러가면 엉뚱한 호스트를 비운다
    expect(() => parseArgs(['--ulr=https://naemok.com'])).toThrow(/알 수 없는 옵션/)
  })
})

describe('assertSlug', () => {
  it.each(['https://naemok.com/guide/x', 'a b', 'a/b', 'a%20b', 'a?b', 'a#b', ''])('%s 는 슬러그가 아니다', (s) => {
    expect(() => assertSlug(s)).toThrow()
  })

  it('한글 하이픈 슬러그는 통과한다', () => {
    expect(() => assertSlug('출산지원금-첫만남이용권-부모급여-아동수당')).not.toThrow()
  })
})

describe('buildTargets', () => {
  it('가이드가 없으면 guides 태그를 붙이지 않는다', () => {
    const { tags } = buildTargets({ slugs: ['청년월세-지원'], guides: [] })
    expect(tags).toEqual(['benefits:all', 'benefits:home'])
  })

  // 경로만 비우고 태그를 빼면 HTML은 다시 만들어지는데 본문이 unstable_cache에서 나온다.
  // 실제로 가이드를 증보하고 발행했는데 프로덕션이 이전 본문을 내보낸 원인이 이것이다.
  it('가이드가 있으면 guides 태그와 /guide 목록까지 비운다', () => {
    const { tags, paths } = buildTargets({ slugs: [], guides: ['출산지원금'] })
    expect(tags).toContain('guides')
    expect(paths).toContain('/guide')
    expect(paths).toContain('/guide/%EC%B6%9C%EC%82%B0%EC%A7%80%EC%9B%90%EA%B8%88')
  })

  it('가이드가 없으면 /guide 경로를 넣지 않는다', () => {
    expect(buildTargets({ slugs: ['x'], guides: [] }).paths).not.toContain('/guide')
  })

  // 인코딩하지 않으면 API는 ok를 주는데 캐시는 그대로 HIT다(프로덕션에서 4/4 확인).
  it('한글 슬러그를 퍼센트 인코딩한다', () => {
    const { paths } = buildTargets({ slugs: ['청년월세'], guides: ['출산지원금'] })
    expect(paths).toContain(`/benefit/${encodeURIComponent('청년월세')}`)
    expect(paths).toContain(`/guide/${encodeURIComponent('출산지원금')}`)
    expect(paths.some((p) => /[가-힣]/.test(p))).toBe(false)
  })

  it('홈과 공개 세그먼트는 항상 들어간다', () => {
    const { paths } = buildTargets({ slugs: [], guides: [] })
    expect(paths).toEqual(['/', '/youth', '/parenting', '/small-biz'])
  })

  it('주소를 슬러그로 넘기면 던진다', () => {
    expect(() => buildTargets({ slugs: [], guides: ['https://naemok.com/guide/x'] })).toThrow()
  })

  // 서버가 51개째를 거절하면 앞의 50개만 돌고 호출자는 전부 성공으로 믿는다.
  it('항목이 상한을 넘으면 보내기 전에 던진다', () => {
    const many = Array.from({ length: MAX_ITEMS }, (_, i) => `s${i}`)
    expect(() => buildTargets({ slugs: many, guides: [] })).toThrow(new RegExp(String(MAX_ITEMS)))
  })
})
