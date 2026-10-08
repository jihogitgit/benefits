import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 애드센스는 색인 대상 페이지에만 싣는다(components/ads/AdsenseScript.tsx 주석).
// 레이아웃에 스크립트가 돌아오면 noindex 상세 1만여 건에 자동 광고가 다시 붙는다.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('애드센스 노출 범위', () => {
  it('레이아웃은 애드센스 스크립트를 싣지 않는다', () => {
    for (const p of ['src/app/layout.tsx', 'src/app/(site)/layout.tsx']) {
      const src = read(p)
      expect(src, p).not.toMatch(/adsbygoogle|AdsenseScript|ADSENSE_CLIENT/)
    }
  })

  it('지원금 상세는 해설이 게재된 경우에만 광고를 싣는다', () => {
    const src = read('src/app/(site)/benefit/[slug]/page.tsx')
    expect(src).toContain('{published && <AdsenseScript />}')
    expect(src).not.toMatch(/^\s*<AdsenseScript \/>/m)
    expect(src).not.toMatch(/^\s*<AdPlacement /m)
    expect(src).toContain('showAd={published}')
  })

  it('noindex인 /my는 스크립트를 싣지 않는다', () => {
    expect(read('src/app/(site)/my/page.tsx')).not.toContain('AdsenseScript')
  })
})
