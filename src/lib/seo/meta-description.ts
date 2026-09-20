/**
 * 본문 마크다운에서 검색결과 스니펫으로 쓸 한 줄을 만든다.
 *
 * 가이드 설명은 body_md.slice(0, 120)이었다. 마크다운이 그대로 새어 실제 발행된 다섯 편 중
 * 네 편의 설명에 **굵게**와 [텍스트](/주소)가 들어가 있었다 — 검색결과에 별표와 괄호가
 * 그대로 보인다. 화면에는 렌더러가 있어 드러나지 않고 <head> 안에만 남으므로, 페이지를
 * 열어 봐서는 알 수 없고 검색결과나 소스를 봐야 보인다.
 *
 * 지울 문법은 Markdown.tsx가 처리하는 것과 같게 둔다. 렌더러가 새 문법을 받으면 여기도
 * 받아야 한다 — 한쪽만 알면 그 문법이 다시 스니펫으로 샌다.
 *
 * 표와 그림은 줄째 버린다. 표는 |로 끊긴 칸이 문장이 되지 않고, 그림의 alt는 도형을 읽는
 * 법이라(“점선 왼쪽이 신청 가능 구간”) 스니펫에 오면 글의 내용 대신 그림 설명이 나온다.
 */

/** 한 줄짜리 그림 블록. 캡션까지 포함해 통째로 버린다. */
const FIGURE = /^!\[[^\]]*\]\([^)]*\)$/
/** 표의 칸 줄과 구분선 줄. 둘 다 |로 시작한다. */
const TABLE = /^\|/

/**
 * 문장 끝 > 낱말 경계 > 그냥 자르기 순으로 끊는다. 앞의 방법이 너무 짧게 자르면 다음으로
 * 내려간다 — 첫 문장이 짧다고 20자짜리 설명을 내보내면 스니펫이 통째로 쓸모없어진다.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const floor = Math.floor(max * 0.6)
  const sentence = /^[\s\S]*[.!?](?=\s)/.exec(head)?.[0].length ?? 0
  if (sentence >= floor) return head.slice(0, sentence).trim()
  const space = head.lastIndexOf(' ')
  return `${head.slice(0, space >= floor ? space : max).trim()}…`
}

export function metaDescription(md: string, max = 120): string {
  const kept: string[] = []
  for (const raw of md.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line || FIGURE.test(line) || TABLE.test(line)) continue
    kept.push(line.replace(/^(?:#{1,2}\s+|>\s?|[-*•]\s+|\d+[.)]\s+)/, ''))
  }
  const text = kept
    .join(' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // 그림 줄은 위에서 버렸지만, 블록 조건을 못 맞춘 ![...] 가 문단에 남아 있을 수 있다.
    // 그때 링크 규칙이 먹으면 !만 남으므로 렌더러와 같이 ! 뒤의 대괄호는 건너뛴다.
    .replace(/(?<!!)\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return truncate(text, max)
}
