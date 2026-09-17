/**
 * unstable_cache 태그의 단일 출처.
 *
 * 태그는 오타가 나도 아무 일이 일어나지 않는다. revalidateTag는 존재하지 않는 태그를 받아도
 * 조용히 성공하므로, 무효화했다고 믿은 채 낡은 응답이 계속 나간다. 실제로 'benefits',
 * 'benefit-articles', 'sitemap'을 보내고 성공 응답을 받은 적이 있다(전부 존재하지 않는 태그다).
 *
 * 그래서 값을 여기 모아 두고, 캐시를 다는 쪽과 /api/revalidate의 검증이 같은 목록을 본다.
 */
export const CACHE_TAGS = {
  /** 지원금 조회 함수 전반(상세·세그먼트 목록·지역 집계·연관). 해설 발행도 여기에 걸린다. */
  benefitsAll: 'benefits:all',
  /** 홈 전용 목록(마감 임박·최근 갱신·최종 동기화 시각). */
  benefitsHome: 'benefits:home',
  guides: 'guides',
  regions: 'regions',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

export const ALL_CACHE_TAGS: readonly CacheTag[] = Object.values(CACHE_TAGS)

export function isCacheTag(v: string): v is CacheTag {
  return (ALL_CACHE_TAGS as readonly string[]).includes(v)
}
