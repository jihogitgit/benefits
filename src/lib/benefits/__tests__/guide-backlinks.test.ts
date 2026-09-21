import { describe, expect, it } from 'vitest'
import { benefitSlugsInGuide, buildGuideBacklinks } from '../guide-backlinks'

/**
 * 이 색인이 틀리면 상세 페이지에 없는 관계가 뜨거나, 있는 관계가 안 뜬다. 둘 다 화면을
 * 봐야만 드러나고, 상세는 1만 건이라 눈으로 볼 수가 없다.
 */
describe('benefitSlugsInGuide', () => {
  it('링크로 쓰인 사업 슬러그를 모은다', () => {
    expect(benefitSlugsInGuide('국토부 [청년월세 지원](/benefit/청년월세-지원)은 월 20만원입니다.')).toEqual([
      '청년월세-지원',
    ])
  })

  it('퍼센트 인코딩을 푼다', () => {
    expect(benefitSlugsInGuide('[아동수당](/benefit/%EC%95%84%EB%8F%99%EC%88%98%EB%8B%B9)')).toEqual(['아동수당'])
  })

  it('같은 사업을 여러 번 걸어도 하나로 센다', () => {
    expect(benefitSlugsInGuide('[가](/benefit/아동수당) 그리고 [나](/benefit/아동수당)')).toEqual(['아동수당'])
  })

  // Markdown.tsx의 inline()은 주소에 공백이 있으면 링크로 만들지 않고 글자로 남긴다.
  // 여기서만 링크로 세면 화면에 링크가 없는데 상세에는 관계가 뜬다.
  it('제목이 달려 렌더러가 링크로 만들지 않는 것은 세지 않는다', () => {
    expect(benefitSlugsInGuide('[아동수당](/benefit/아동수당 "매달 나옵니다")')).toEqual([])
  })

  it('앵커와 쿼리는 뗀다', () => {
    expect(benefitSlugsInGuide('[가](/benefit/아동수당#faq) [나](/benefit/첫만남이용권-지원?v=2)')).toEqual([
      '아동수당',
      '첫만남이용권-지원',
    ])
  })

  // Markdown.tsx가 ! 뒤의 대괄호를 링크로 보지 않는다. 여기서만 링크로 세면 화면에 없는
  // 관계가 색인에 생긴다.
  it('그림 문법은 링크로 보지 않는다', () => {
    expect(benefitSlugsInGuide('![대체](/benefit/아동수당)')).toEqual([])
  })

  it('다른 폴더는 세지 않는다', () => {
    expect(benefitSlugsInGuide('[가](/guide/x) [나](/my) [다](https://example.com/benefit/x)')).toEqual([])
  })

  // 가이드 한 편의 깨진 주소 때문에 색인 전체가 서면 안 된다.
  it('잘못 인코딩된 주소에도 던지지 않는다', () => {
    expect(() => benefitSlugsInGuide('[가](/benefit/%E0%A4%A)')).not.toThrow()
    expect(benefitSlugsInGuide('[가](/benefit/%E0%A4%A)')).toEqual(['%E0%A4%A'])
  })
})

describe('buildGuideBacklinks', () => {
  const guides = [
    { slug: 'g1', title: '첫째 가이드', body_md: '[가](/benefit/아동수당) [나](/benefit/첫만남이용권-지원)' },
    { slug: 'g2', title: '둘째 가이드', body_md: '[다](/benefit/아동수당)' },
  ]

  it('사업별로 그 사업을 다룬 가이드를 모은다', () => {
    const idx = buildGuideBacklinks(guides)
    expect(idx['아동수당']).toEqual([
      { slug: 'g1', title: '첫째 가이드' },
      { slug: 'g2', title: '둘째 가이드' },
    ])
    expect(idx['첫만남이용권-지원']).toEqual([{ slug: 'g1', title: '첫째 가이드' }])
  })

  it('아무 가이드도 다루지 않은 사업은 없는 키로 둔다', () => {
    expect(buildGuideBacklinks(guides)['없는-사업']).toBeUndefined()
  })

  it('가이드가 없으면 빈 색인이다', () => {
    expect(buildGuideBacklinks([])).toEqual({})
  })
})
