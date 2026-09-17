/**
 * 모바일·태블릿용 목차.
 *
 * 목차는 StickyRail에 있는데 그 컴포넌트가 hidden lg:block이라 1024px 미만에서는 렌더되지
 * 않는다. 정부 지원금 검색은 모바일 비중이 큰데, 주 독자층에게는 이 글에 신청 순서나
 * 자주 묻는 질문이 있다는 사실 자체가 보이지 않았다. 끝까지 스크롤해야 발견한다.
 *
 * 세로 공간을 거의 쓰지 않도록 가로 스크롤 칩 한 줄로 만든다. 항목은 StickyRail과 같은
 * sections 배열에서 오므로 둘이 어긋날 수 없다.
 */
export default function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  if (sections.length < 2) return null
  return (
    // -mx-4 px-4: 칩이 화면 가장자리까지 스크롤되게 하되 본문 여백은 유지한다.
    // 이 요소만 가로로 넘치고 페이지 본문은 넘치지 않는다.
    <nav aria-label="목차" className="-mx-4 mt-3 overflow-x-auto px-4 lg:hidden">
      {/* py-1: overflow-x-auto는 세로도 clip하므로 여백이 없으면 포커스 링이 잘린다 */}
      <ul className="flex w-max gap-2 py-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="block whitespace-nowrap rounded-full border bg-white px-3 py-2 text-sm text-gray-700 hover:border-brand-400 hover:text-brand-700"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
