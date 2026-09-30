import { REGIONS } from '../../../data/regions'
import { BROWSE_SORTS, BROWSE_STATUSES, REGION_NATIONAL, type BrowseInput } from '@/lib/benefits/browse'

/**
 * /benefits 필터. 평범한 GET 폼이다 — "적용" 버튼으로 제출되고, 주소가 곧 필터 상태다.
 *
 * 값을 바꾸는 즉시 제출하지 않는다. Windows 크롬·엣지는 닫힌 select에서 화살표 키를 누를 때마다
 * change를 내므로, 즉시 제출하면 키보드 사용자는 첫 옵션을 지나가지 못한다(한 칸마다 페이지가
 * 다시 그려지고 초점이 사라진다 — WCAG 3.2.2). 그래서 클라이언트 코드가 필요 없어 서버 컴포넌트다.
 *
 * page는 싣지 않는다. 필터가 바뀌면 결과 건수가 바뀌므로 1페이지로 돌아가는 것이 맞다.
 * 분야는 폼 밖의 탭이 맡으므로 숨은 값으로만 넘긴다.
 */
export default function BrowseFilters({ input }: { input: BrowseInput }) {
  const select = 'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900'
  return (
    <form action="/benefits" method="get" className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="search" aria-label="지원금 필터">
      {input.seg && <input type="hidden" name="seg" value={input.seg} />}
      {/* 검색어와 적용 버튼을 한 줄에 둔다. 버튼 하나가 검색어와 아래 필터를 함께 제출한다. */}
      <div className="col-span-2 flex gap-2 sm:col-span-4">
        <label className="flex-1">
          <span className="sr-only">지원금 이름 검색</span>
          <input
            type="search"
            name="q"
            defaultValue={input.q}
            placeholder="지원금 이름으로 찾기 (예: 월세, 출산)"
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400"
          />
        </label>
        <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          적용
        </button>
      </div>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-500">지역</span>
        <select name="region" defaultValue={input.region ?? ''} className={select}>
          <option value="">전체 지역</option>
          <option value={REGION_NATIONAL}>전국 공통만</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>{r.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-500">신청 상태</span>
        <select name="status" defaultValue={input.status} className={select}>
          {BROWSE_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-500">정렬</span>
        <select name="sort" defaultValue={input.sort} className={select}>
          {BROWSE_SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </label>
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-500">보기</span>
        <label className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800">
          <input type="checkbox" name="explained" value="1" defaultChecked={input.explained} className="h-4 w-4 shrink-0" />
          해설 있는 것만
        </label>
      </div>
    </form>
  )
}
