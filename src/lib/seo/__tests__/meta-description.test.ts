import { describe, expect, it } from 'vitest'
import { metaDescription } from '../meta-description'

/**
 * 스니펫은 <head> 안에만 있어 화면을 봐서는 틀린 줄 모른다. 실제로 발행된 가이드 네 편이
 * 별표를 달고 검색에 올라가 있었다 — 여기서 막지 않으면 다음에도 같은 방식으로 새어 나간다.
 */
describe('metaDescription', () => {
  it('굵게 표시를 지우고 글자만 남긴다', () => {
    expect(metaDescription('소득이 넘거나, **횟수를 다 썼거나**입니다.')).toBe(
      '소득이 넘거나, 횟수를 다 썼거나입니다.',
    )
  })

  it('링크는 글자만 남기고 주소를 버린다', () => {
    expect(metaDescription('국토부 [청년월세 지원](/benefit/청년월세-지원)은 월 20만원입니다.')).toBe(
      '국토부 청년월세 지원은 월 20만원입니다.',
    )
  })

  it('제목·목록·인용 기호를 지운다', () => {
    expect(metaDescription('# 큰 제목\n## 작은 제목\n- 첫째\n1. 둘째\n> 인용')).toBe(
      '큰 제목 작은 제목 첫째 둘째 인용',
    )
  })

  // 그림의 alt는 도형 읽는 법이라 스니펫에 오면 글 내용이 아니라 그림 설명이 나온다.
  it('그림 줄은 캡션까지 통째로 버린다', () => {
    expect(metaDescription('![점선 왼쪽이 신청 구간](/guide/rent-income-bands.svg "소득 기준")\n본문입니다.')).toBe(
      '본문입니다.',
    )
  })

  it('표는 줄째 버린다', () => {
    expect(metaDescription('| 구분 | 금액 |\n| --- | --- |\n| 부모급여 | 100만원 |\n본문입니다.')).toBe('본문입니다.')
  })

  it('짧으면 자르지 않고 말줄임표도 붙이지 않는다', () => {
    expect(metaDescription('짧은 글입니다.')).toBe('짧은 글입니다.')
  })

  it('문장 끝에서 자르고 말줄임표를 붙이지 않는다', () => {
    // 첫 문장이 max의 60%를 넘으므로 거기서 끊는다.
    expect(metaDescription('가나다라마바사아자차카타파하 하나입니다. 두 번째 문장입니다.', 30)).toBe(
      '가나다라마바사아자차카타파하 하나입니다.',
    )
  })

  it('문장 끝이 너무 앞이면 낱말 경계에서 자른다', () => {
    // 첫 문장이 3자뿐이라 거기서 끊으면 스니펫이 쓸모없어진다 — 낱말 경계로 내려간다.
    const out = metaDescription('짧다. 그리고 여기서부터 아주 긴 설명이 계속 이어집니다.', 30)
    expect(out).toBe('짧다. 그리고 여기서부터 아주 긴 설명이 계속…')
    expect(out.length).toBeLessThanOrEqual(31)
  })

  it('공백이 없으면 그냥 자른다', () => {
    expect(metaDescription('가'.repeat(50), 20)).toBe(`${'가'.repeat(20)}…`)
  })

  // 렌더러가 ! 뒤의 대괄호를 링크로 보지 않는다. 여기서만 링크로 처리하면 !만 남는다.
  it('문단에 남은 그림 문법은 링크로 처리하지 않는다', () => {
    expect(metaDescription('앞 ![대체](/guide/x.svg) 뒤')).toBe('앞 ![대체](/guide/x.svg) 뒤')
  })
})
