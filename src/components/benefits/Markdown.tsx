import Link from 'next/link'
import { Fragment } from 'react'

/**
 * 검수 콘텐츠용 최소 마크다운.
 * 블록: #/## 제목, - 목록, 1. 목록, | 표 |, > 인용, 빈 줄 단락.
 * 인라인: **굵게**, [텍스트](주소). 그 외 HTML은 처리하지 않는다(텍스트로 출력).
 *
 * 링크를 지원하는 이유: 가이드 글이 진단 결과(/my?age=20s&situations=no_house)와 출처로
 * 이어지지 못하면 독자가 글에서 막힌다. 표는 금액 분해처럼 문장으로 풀면 오히려 읽기 힘든
 * 내용을 위한 것이다. 인용은 제도 안내문의 문구를 글쓴이 요약과 구분해 그대로 보여주기
 * 위한 것이다 — 이 구분이 없으면 원문 표현인지 우리 해석인지 독자가 알 수 없다.
 */

/**
 * 링크로 허용할 주소인지. 내부 경로와 http(s)·mailto만 통과시킨다.
 * 본문은 검수를 거치지만 초안 생성이 자동화되므로, javascript:·data: 같은 스킴이
 * 검수자의 눈을 지나쳐 그대로 실리는 경로를 문법 단계에서 막는다.
 */
function safeHref(href: string): string | null {
  const h = href.trim()
  if (h.startsWith('/') && !h.startsWith('//')) return h
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h
  return null
}

/** **굵게**와 [텍스트](주소)만 처리한다. 중첩은 지원하지 않는다. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyPrefix}-${i++}`
    if (m[1] !== undefined) {
      out.push(<strong key={key} className="font-semibold text-gray-900">{m[1]}</strong>)
    } else {
      const href = safeHref(m[3])
      if (!href) {
        // 허용되지 않은 주소는 링크로 만들지 않고 글자만 남긴다. 조용히 지우면 문맥이 깨진다.
        out.push(m[2])
      } else if (href.startsWith('/')) {
        out.push(<Link key={key} href={href} className="text-brand-700 underline underline-offset-2 hover:text-brand-800">{m[2]}</Link>)
      } else {
        out.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2 hover:text-brand-800">
            {m[2]}
          </a>,
        )
      }
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** 표 블록인지. 첫 줄이 |로 시작하고 둘째 줄이 구분선이면 표로 본다. */
function isTable(lines: string[]): boolean {
  return lines.length >= 2 && /^\s*\|/.test(lines[0]) && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[1])
}

function cells(line: string): string[] {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
}

export default function Markdown({ text }: { text: string }) {
  // 제목 줄 뒤에 빈 줄을 넣어 항상 독립 블록으로 만든다. 이 정규화가 없으면 제목 바로 아래(빈 줄 없이)
  // 이어 쓴 본문이 제목 분기에서 lines[0]만 반환되며 조용히 사라진다. 제목+본문을 붙여 쓰는 것이
  // 마크다운의 일반적인 작성 방식이라 검수 콘텐츠가 통째로 유실될 수 있다.
  const blocks = text
    .replace(/\r\n/g, '\n')
    .replace(/^(#{1,2}\s+.*)$/gm, '$1\n')
    .split(/\n{2,}/)

  return (
    <div className="space-y-3 text-[15px] leading-7 text-gray-800">
      {blocks.map((blk, i) => {
        const lines = blk.split('\n').filter((l) => l.trim())
        if (!lines.length) return null

        if (isTable(lines)) {
          const head = cells(lines[0])
          const body = lines.slice(2).map(cells)
          return (
            // 좁은 화면에서 표가 본문 폭을 밀지 않도록 가로 스크롤을 준다
            <div key={i} className="overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-50">
                    {head.map((c, j) => <th key={j} className="px-3 py-2 text-left font-semibold text-gray-700">{inline(c, `${i}-h-${j}`)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r} className="border-b border-gray-200">
                      {row.map((c, j) => <td key={j} className="px-3 py-2 align-top">{inline(c, `${i}-${r}-${j}`)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (lines.every((l) => /^\s*>\s?/.test(l)))
          return (
            <blockquote key={i} className="border-l-4 border-gray-300 pl-4 text-gray-600">
              {lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && ' '}
                  {inline(l.replace(/^\s*>\s?/, ''), `${i}-${j}`)}
                </Fragment>
              ))}
            </blockquote>
          )
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ''), `${i}-${j}`)}</li>)}</ul>
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return <ol key={i} className="list-decimal space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''), `${i}-${j}`)}</li>)}</ol>
        if (/^##\s+/.test(lines[0])) return <h3 key={i} className="pt-2 text-base font-bold">{inline(lines[0].replace(/^##\s+/, ''), `${i}-h`)}</h3>
        if (/^#\s+/.test(lines[0])) return <h2 key={i} className="pt-2 text-lg font-bold">{inline(lines[0].replace(/^#\s+/, ''), `${i}-h`)}</h2>
        return (
          <p key={i} className="whitespace-pre-line">
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && '\n'}
                {inline(l, `${i}-${j}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
