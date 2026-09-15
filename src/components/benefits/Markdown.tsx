/** 검수 콘텐츠용 최소 마크다운: #/## 제목, - 목록, 1. 목록, 빈 줄 단락. 인라인 서식·HTML은 처리하지 않는다(텍스트로 출력). */
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
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*[-*•]\s+/, '')}</li>)}</ul>
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return <ol key={i} className="list-decimal space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*\d+[.)]\s+/, '')}</li>)}</ol>
        if (/^##\s+/.test(lines[0])) return <h3 key={i} className="pt-2 text-base font-bold">{lines[0].replace(/^##\s+/, '')}</h3>
        if (/^#\s+/.test(lines[0])) return <h2 key={i} className="pt-2 text-lg font-bold">{lines[0].replace(/^#\s+/, '')}</h2>
        return <p key={i} className="whitespace-pre-line">{lines.join('\n')}</p>
      })}
    </div>
  )
}
