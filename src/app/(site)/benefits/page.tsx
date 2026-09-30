import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listBrowse, countBrowseBySegment } from '@/lib/benefits/queries'
import { BROWSE_KEYS, BROWSE_PAGE_SIZE, BROWSE_SEGMENTS, browseHref, isDefaultBrowse, parseBrowseParams } from '@/lib/benefits/browse'
import { LIFE_EVENTS } from '../../../../data/life-events'
import { kstYear } from '@/lib/seo/hub-meta'
import { absoluteUrl } from '@/lib/seo/site'
import BenefitList from '@/components/benefits/BenefitList'
import BrowseFilters from '@/components/benefits/BrowseFilters'

type SP = Promise<Record<string, string | string[] | undefined>>

/**
 * 필터를 건 주소는 색인하지 않는다. 조합마다 목록만 다른 얇은 페이지가 수천 개 생기고, 모두
 * 같은 카드의 다른 순서라 검색엔진에는 중복으로 보인다. 링크는 따라가게(follow) 둬서 카드 너머의
 * 상세 페이지로는 크롤러가 계속 들어간다. 기본 목록 하나만 색인한다.
 */
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const input = parseBrowseParams(await searchParams)
  return {
    title: `${kstYear()} 정부·지자체 지원금 전체 보기 · 분야·지역·마감 필터`,
    description: '정부·지자체 지원금 전체를 분야·지역·신청 상태로 걸러 보고, 마감 임박순이나 최근 갱신순으로 정렬합니다.',
    // canonical은 기본 목록에만 단다. 필터 주소에 canonical=/benefits와 noindex를 함께 달면
    // 서로 다른 신호가 되어(대표 주소는 저기 / 이 주소는 색인 말라) 검색엔진이 한쪽을 무시한다.
    ...(isDefaultBrowse(input) ? { alternates: { canonical: absoluteUrl('/benefits'), types: { 'application/rss+xml': '/rss.xml' } } } : {
          // 루트 레이아웃이 모든 페이지에 canonical './'을 단다. 쿼리는 빠지므로 그대로 두면 /benefits를 가리킨다.
          alternates: { canonical: null, types: { 'application/rss+xml': '/rss.xml' } },
          robots: { index: false, follow: true },
        }),
  }
}

export default async function BrowsePage({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams
  const input = parseBrowseParams(raw)
  // GET 폼은 기본값(status=all, 빈 q 등)까지 싣는다. 같은 목록이 여러 주소를 갖지 않도록
  // 정규화한 주소로 보낸다 — 공유된 링크와 canonical 판단이 한 주소를 보게 된다.
  // 필터와 무관한 값(utm·gclid 같은 추적 값)은 건드리지 않고 그대로 붙여 보낸다 — 지우면 광고·
  // 유입 집계가 이 페이지에서 끊긴다. 순서는 따지지 않고 필터 값의 집합만 비교한다.
  const pairs = Object.entries(raw).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x] as const) : v === undefined ? [] : [[k, v] as const]))
  const known = pairs.filter(([k]) => BROWSE_KEYS.has(k)).map(([k, v]) => `${k}=${v}`).sort()
  const want = [...new URLSearchParams(browseHref(input).split('?')[1] ?? '')].map(([k, v]) => `${k}=${v}`).sort()
  const extra = new URLSearchParams(pairs.filter(([k]) => !BROWSE_KEYS.has(k)) as [string, string][]).toString()
  const go = (href: string): never => redirect(extra ? `${href}${href.includes('?') ? '&' : '?'}${extra}` : href)
  if (known.join('&') !== want.join('&')) go(browseHref(input))

  const now = new Date()
  // 선택된 탭의 숫자는 아래 "N개"와 같은 값(total)을 쓴다. 두 캐시가 따로 늙어 한 화면에 다른
  // 숫자가 나오지 않게 한다.
  const [{ rows, total }, counts] = await Promise.all([listBrowse(input), countBrowseBySegment(input)])
  const pages = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE))
  // 결과보다 뒤 페이지를 요청하면(필터를 좁힌 뒤 남은 주소 등) 마지막 페이지로 보낸다.
  if (input.page > pages) go(browseHref(input, { page: pages }))

  const tab = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm ${
      active ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'
    }`
  const countTone = (active: boolean) => (active ? 'text-brand-100' : 'text-gray-400')

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <nav className="text-xs text-gray-500" aria-label="현재 위치">
        <Link href="/" className="hover:underline">홈</Link> › 지원금 찾기
      </nav>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">지원금 찾기</h1>
      <p className="mt-2 text-sm text-gray-600">분야·지역·신청 상태로 거르고 원하는 순서로 정렬합니다. 내 나이·상황까지 넣으려면 <Link href="/" className="font-semibold text-brand-700 hover:underline">조건 진단</Link>을 쓰세요.</p>

      {/* 분야 탭. 좁은 화면에서는 가로로 밀어 본다 — 줄을 바꾸면 탭이 필터보다 커진다. */}
      <nav aria-label="분야" className="-mx-4 mt-5 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li>
            <Link href={browseHref(input, { seg: null, page: 1 })} aria-current={!input.seg ? 'page' : undefined} className={tab(!input.seg)}>
              전체 <span className={countTone(!input.seg)}>{(!input.seg ? total : counts.all).toLocaleString()}</span>
            </Link>
          </li>
          {BROWSE_SEGMENTS.map((s) => {
            const active = input.seg === s.path
            return (
              <li key={s.path}>
                <Link href={browseHref(input, { seg: s.path, page: 1 })} aria-current={active ? 'page' : undefined} className={tab(active)}>
                  {s.name} <span className={countTone(active)}>{(active ? total : (counts.bySeg[s.path] ?? 0)).toLocaleString()}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <BrowseFilters input={input} />
      </div>

      <p className="mt-5 mb-3 text-sm text-gray-600" aria-live="polite">
        <b className="font-semibold text-gray-900">{total.toLocaleString()}개</b>
        {total > BROWSE_PAGE_SIZE && <> · {input.page} / {pages.toLocaleString()} 페이지</>}
      </p>
      <BenefitList rows={rows} now={now} emptyText="조건에 맞는 지원금이 없습니다. 필터를 줄이거나 검색어를 바꿔 보세요." />

      {pages > 1 && (
        <nav aria-label="페이지" className="mt-6 flex items-center justify-center gap-2 text-sm">
          {input.page > 1 ? (
            <Link href={browseHref(input, { page: input.page - 1 })} rel="prev" className="inline-flex min-h-11 items-center rounded-lg border bg-white px-4 hover:border-brand-400">← 이전</Link>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-lg border px-4 text-gray-300">← 이전</span>
          )}
          <span className="px-2 text-gray-600">{input.page} / {pages.toLocaleString()}</span>
          {input.page < pages ? (
            <Link href={browseHref(input, { page: input.page + 1 })} rel="next" className="inline-flex min-h-11 items-center rounded-lg border bg-white px-4 hover:border-brand-400">다음 →</Link>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-lg border px-4 text-gray-300">다음 →</span>
          )}
        </nav>
      )}

      {/* 메뉴에서 뺀 진입점들. 분야 허브·생애 이벤트·마감 캘린더는 이 페이지를 거쳐 닿는다. */}
      <section className="mt-10 border-t pt-6" aria-label="다른 방법으로 찾기">
        <h2 className="text-base font-bold">다른 방법으로 찾기</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          <li><Link href="/deadline" className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 hover:border-brand-400">마감 임박 캘린더</Link></li>
          {BROWSE_SEGMENTS.filter((s) => s.slug !== 'other').map((s) => (
            <li key={s.path}><Link href={`/${s.path}`} className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 hover:border-brand-400">{s.name} 지원금 모아보기</Link></li>
          ))}
          <li><Link href="/life" className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 hover:border-brand-400">생애 이벤트로 찾기</Link></li>
          {LIFE_EVENTS.map((e) => (
            <li key={e.slug}><Link href={`/life/${e.slug}`} className="inline-flex min-h-10 items-center rounded-full border bg-white px-3 hover:border-brand-400">{e.title}</Link></li>
          ))}
        </ul>
      </section>
    </div>
  )
}
