/** 색인 여부는 이 파일에서만 결정한다. 페이지 robots 메타와 사이트맵이 모두 이 함수를 따른다. */

export interface ArticleFlags {
  review_status: string
  indexable: boolean
}

/**
 * 색인을 유지하는 검수 상태. published 후 원천이 바뀐 stale도 포함한다
 * (페이지에 "내용 확인 중" 배지가 붙고 색인은 그대로 둔다).
 *
 * 상수로 뽑아 둔 이유: 이 목록을 SQL where절에도 그대로 넘겨야 하기 때문이다.
 * 판정을 JS에서만 하면 DB가 LIMIT을 색인 대상이 아닌 행에까지 써버려, 초안이 쌓였을 때
 * 발행분이 조용히 잘려나간다(queries.ts의 listWithArticles 참고).
 */
export const INDEXABLE_REVIEW_STATUSES = ['published', 'stale'] as const

export function benefitIndexable(b: { status: string; article: ArticleFlags | null }): boolean {
  if (b.status !== 'open') return false
  if (!b.article) return false
  return b.article.indexable && (INDEXABLE_REVIEW_STATUSES as readonly string[]).includes(b.article.review_status)
}

/**
 * 분야 허브(/youth 등)의 색인 임계값. 세는 대상은 **그 분야에 연결된 게재 해설 수**다.
 *
 * 허브는 카드 목록이 본문의 대부분이라, 해설이 몇 편 걸려 있지 않으면 보조금24를 다시 나열한
 * 페이지와 다를 바 없다. 해설이 있어야 "자세히 정리한 지원금" 절이 생기고 그리로 내부 링크가
 * 이어진다. 2026-11 기준 청년 11·출산육아 11·소상공인 9편이라 셋 다 통과하지만, 새 분야를
 * 열 때 해설 없이 색인부터 되는 일을 막는다. 사이트맵(staticEntries)도 같은 판정을 쓴다.
 */
export const HUB_MIN_EXPLAINED = 3

/**
 * 허브가 "자세히 정리한 지원금" 절에 펴는 해설 수. 허브 본문·generateMetadata·사이트맵이 전부
 * 이 limit으로 listWithArticles를 불러 unstable_cache 항목 하나를 나눠 쓴다(limit이 다르면 키가 갈린다).
 * HUB_MIN_EXPLAINED보다 커야 판정이 잘리지 않는다.
 */
export const HUB_EXPLAINED_LIMIT = 8

export function hubIndexable(h: { explainedCount: number }): boolean {
  return h.explainedCount >= HUB_MIN_EXPLAINED
}

/**
 * 가이드는 발행된 것만 색인한다.
 * /guide/[slug] 페이지가 published_at이 없으면 notFound()를 내므로, 이 기준이 어긋나면
 * 사이트맵이 404를 신고하게 된다. 페이지와 사이트맵이 같은 함수를 보게 여기에 둔다.
 */
export function guideIndexable(g: { published_at: string | null }): boolean {
  return !!g.published_at
}

/**
 * 세그먼트×지역 페이지의 색인 임계값. 세는 대상은 **그 지역에만 있는** 지원금이다.
 *
 * 전국(ALL) 공통분을 더해서 세면 안 된다. 청년 183·출산육아 473·소상공인 478건이 모든 지역
 * 페이지에 똑같이 깔리므로 어떤 임계값이든 항상 통과하고, 판정 장치가 사실상 꺼진다.
 * 실제로 광주는 지역 전용이 1/0/0인데 전국분 덕에 3페이지가 모두 색인 대상이었다.
 * 그렇게 열면 지역명만 다른 사실상 같은 페이지 51개가 색인되는 doorway page가 된다.
 */
export const REGION_HUB_MIN_LOCAL_ITEMS = 10

/**
 * 지역 허브는 분야 허브(hubIndexable)와 독립으로 판정한다. 분야 허브의 기준은 해설 수인데
 * 해설은 전부 전국 공통이라 지역 허브에는 적용할 수 없고, 지역 허브의 가치는 그 지역에만 있는
 * 목록과 손으로 쓴 안내문이다. 분야 허브가 noindex여도 지역 허브는 자기 기준으로 색인될 수 있다 — 의도한 것.
 */
export function regionHubIndexable(r: { localCount: number; description_md: string | null }): boolean {
  return r.localCount >= REGION_HUB_MIN_LOCAL_ITEMS && !!r.description_md?.trim()
}

/**
 * 비교 페이지(/compare/[key])의 색인 임계값. 세는 대상은 **서로 다른 시·도 수**다.
 *
 * 기존 지원금·허브 판정은 건드리지 않는다. 이건 새 페이지 종류에 대한 새 기준이다.
 *
 * 건수가 아니라 지역 수를 보는 이유는 지역 허브와 같다. 한 지자체가 대상별로 쪼개 등록한
 * 사업 여러 건은 "여러 곳이 하는 같은 사업"이 아니라서 비교할 것이 없고, 그런 묶음까지
 * 색인을 열면 제목만 다른 목록 페이지 170장이 깔린다. 지역 5곳으로 끊으면 66장이 남는다.
 *
 * 임계값을 넘지 못한 묶음도 페이지는 만든다 — 상세 페이지의 "다른 지역" 절이 그리로
 * 링크하기 때문이다. 다만 robots가 noindex이고 사이트맵에도 넣지 않는다.
 */
export const COMPARE_MIN_REGIONS = 5

/** 지역 수 기준으로 비교할 거리가 있는 묶음인가. 색인 스위치와 별개로 판정만 한다. */
export function compareEligible(g: { regionCount: number }): boolean {
  return g.regionCount >= COMPARE_MIN_REGIONS
}

/**
 * 비교 페이지 색인 스위치. 지금은 끈다(2026-09-30).
 *
 * 사이트맵에 66장을 올린 뒤 GSC에서 한 장도 색인되지 않았다. 실측하니 본문이 평균 780자 —
 * 시·도 이름과 지자체 이름이 줄지어 있을 뿐이고, 링크 대상도 전부 noindex 상세다. 색인된
 * 페이지 어디에서도 이리로 오는 링크가 없어(0건) 사이트맵에만 있는 고아였다. 신생 사이트에서
 * 162장 중 66장이 이런 목록이면 사이트 전체가 얇게 평가된다. 금액·조건을 나란히 놓는 본문이
 * 생기기 전까지 사이트맵에서 빼고 noindex로 둔다. 페이지는 그대로 남아 상세의 "다른 지역"
 * 링크는 계속 동작한다.
 */
export const COMPARE_INDEX_ENABLED = false

export function compareIndexable(g: { regionCount: number }): boolean {
  return COMPARE_INDEX_ENABLED && compareEligible(g)
}

/**
 * 지역별 공고 목록(/housing/[region])의 색인 임계값. 세는 대상은 **그 지역 전용** 접수중·예정 공고다
 * (전국 ALL 제외 — 지역 허브와 같은 doorway page 이유). 공고 상세는 항상 noindex(설계 5절).
 */
export const HOUSING_REGION_MIN_ACTIVE = 5

export function housingRegionIndexable(r: { activeCount: number }): boolean {
  return r.activeCount >= HOUSING_REGION_MIN_ACTIVE
}
