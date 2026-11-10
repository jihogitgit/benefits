import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * 광고는 검수 해설이 게재된 상세(/benefit/[slug])와 가이드(/guide/[slug])에만 싣는다
 * (components/ads/AdsenseScript.tsx, BenefitList.tsx 주석). 허브·목록·홈에 돌아오면 카드 반복뿐인
 * 페이지에 광고가 붙어 심사에서 "가치가 별로 없는 콘텐츠"로 거절된다(2026-10·11).
 *
 * 금지 목록이 아니라 **허용 목록**이다. 페이지를 하나씩 나열하면 새 라우트(compare가 그랬다)가
 * 기본으로 빠진다. 모든 page.tsx·not-found.tsx·layout.tsx를 훑어 허용된 두 곳 외에서 광고 관련
 * 식별자가 보이면 실패한다. `showAd`도 막는다 — BenefitList에 showAd를 넘기면 AdPlacement를
 * import하지 않고도 광고가 살아난다.
 */
const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const AD = /AdsenseScript|AdPlacement|adsbygoogle|ADSENSE_CLIENT|showAd(?!=\{false\})/

const AD_PAGES = ['src/app/(site)/benefit/[slug]/page.tsx', 'src/app/(site)/guide/[slug]/page.tsx']
// 홈은 광고 없이 ADSENSE_CLIENT를 메타 태그(사이트 확인)에만 쓴다. 아래 전용 테스트가 본다.
const HOME = 'src/app/(site)/page.tsx'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/^(page|layout|not-found|template|error)\.tsx$/.test(name)) out.push(relative(ROOT, p))
  }
  return out
}

const ROUTE_FILES = walk(join(ROOT, 'src/app'))

describe('애드센스 노출 범위', () => {
  it('라우트 파일을 실제로 찾았다 (walk가 빈 배열이면 아래 검사가 공허하게 통과한다)', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(15)
    for (const p of [...AD_PAGES, HOME]) expect(ROUTE_FILES).toContain(p)
  })

  it.each(ROUTE_FILES.filter((p) => !AD_PAGES.includes(p) && p !== HOME))('%s 에는 광고 관련 코드가 없다', (p) => {
    expect(read(p)).not.toMatch(AD)
  })

  it('지원금 상세는 해설이 게재된 경우에만 광고를 싣는다', () => {
    const src = read(AD_PAGES[0])
    expect(src).toContain('{published && <AdsenseScript />}')
    expect(src).not.toMatch(/^\s*<AdsenseScript \/>/m)
    expect(src).not.toMatch(/^\s*<AdPlacement /m)
    expect(src).toContain('showAd={published}')
  })

  it('가이드 상세는 광고를 싣는다', () => {
    const src = read(AD_PAGES[1])
    expect(src).toContain('<AdsenseScript />')
    expect(src).toContain('<AdPlacement ')
  })

  // 홈 스크립트를 뺀 대신 사이트 확인은 메타 태그로 한다. 이것까지 빠지면 애드센스가 사이트를 못 찾는다.
  it('홈은 광고 없이 google-adsense-account 메타 태그로 사이트를 확인한다', () => {
    const src = read(HOME)
    expect(src).toContain("'google-adsense-account': ADSENSE_CLIENT")
    expect(src).not.toMatch(/AdsenseScript|AdPlacement|adsbygoogle|showAd/)
  })

  // 목록 컴포넌트가 기본으로 광고를 켜면 허브 페이지가 import만으로 광고를 되살린다.
  it('BenefitList의 showAd 기본값은 꺼짐이다', () => {
    expect(read('src/components/benefits/BenefitList.tsx')).toMatch(/showAd = false,/)
  })

  // AdPlacement를 그리는 컴포넌트가 늘면 허브 페이지가 그 컴포넌트를 통해 광고를 실을 수 있다.
  it('AdPlacement를 import하는 컴포넌트는 BenefitList와 StickyRail뿐이다', () => {
    const importers = walkAll(join(ROOT, 'src/components'))
      .filter((p) => /\.tsx?$/.test(p) && !p.includes('__tests__') && !p.endsWith('AdPlacement.tsx'))
      .filter((p) => /from '(\.\/|@\/components\/benefits\/)AdPlacement'/.test(read(p)))
      .sort()
    expect(importers).toEqual(['src/components/benefits/BenefitList.tsx', 'src/components/benefits/StickyRail.tsx'])
  })
})

function walkAll(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkAll(p, out)
    else out.push(relative(ROOT, p))
  }
  return out
}

describe('404', () => {
  // 루트 레이아웃이 robots index를 적어 두면 not-found의 noindex와 한 문서에 같이 나간다(프로덕션 실측).
  it('루트 레이아웃은 robots를 적지 않고, not-found는 noindex를 낸다', () => {
    expect(read('src/app/layout.tsx')).not.toMatch(/^\s*robots:/m)
    for (const p of ['src/app/not-found.tsx', 'src/app/(site)/not-found.tsx']) {
      expect(read(p), p).toMatch(/robots: \{ index: false/)
    }
  })
})
