import { createHash } from 'node:crypto'

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
  /**
   * 지원금 조회 함수 전부가 단다. 비우면 상세 1만 장이 한꺼번에 낡은 것으로 표시되어, 그 뒤 방문
   * (대부분 크롤러)마다 재생성이 일어난다. 그래서 대량 변경이나 연초 같은 전면 갱신에만 쓴다.
   * 일상적인 변경은 benefit:{slug}(상세 한 장)와 benefits:lists(목록 수십 장)로 좁혀서 비운다.
   */
  benefitsAll: 'benefits:all',
  /** 목록·집계(세그먼트·지역·전체 목록·피드). 상세 페이지의 조회 함수는 이 태그를 달지 않는다. */
  benefitsLists: 'benefits:lists',
  /** 홈 전용 목록(마감 임박·최근 갱신·최종 동기화 시각). */
  benefitsHome: 'benefits:home',
  /** 공고 목록·지역 집계·홈/my 블록. 동기화가 매번 비운다. */
  housingLists: 'housing:lists',
  /** 공고 상세 전부. 대량 변경·실패 시에만. */
  housingAll: 'housing:all',
  guides: 'guides',
  regions: 'regions',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS] | `benefit:${string}` | `housing:${string}`

export const ALL_CACHE_TAGS: readonly CacheTag[] = Object.values(CACHE_TAGS)

/**
 * 상세 한 장만 비우는 태그. getBenefitBySlug가 달고, 동기화·발행이 변경된 슬러그에만 쏜다.
 *
 * 슬러그를 그대로 넣지 않고 해시한다. Next는 렌더 중 모은 태그를 `x-next-cache-tags` 헤더로
 * 내보내는데(Vercel의 minimal mode에서 실제로 쓴다), 헤더 값에 한글이 들어가면 Node가
 * ERR_INVALID_CHAR로 거부해 페이지가 500이 된다. 로컬 `next start`는 이 헤더를 지워서 재현되지
 * 않는다. encodeURIComponent도 답이 아니다 — 한글 1자가 9자로 늘어 태그 길이 상한(256)을 넘기면
 * Next가 경고만 남기고 태그를 버려, 슬러그별 무효화가 조용히 아무것도 하지 않게 된다.
 */
export const BENEFIT_TAG_PREFIX = 'benefit:'
const BENEFIT_TAG_RE = /^benefit:[0-9a-f]{16}$/

export function benefitTag(slug: string): CacheTag {
  if (!isSlugLike(slug)) throw new Error(`슬러그가 아니다: ${slug}`)
  return `${BENEFIT_TAG_PREFIX}${createHash('sha1').update(slug).digest('hex').slice(0, 16)}`
}

/** 공고 상세 한 장. benefitTag와 같은 이유로 해시한다. */
export const HOUSING_TAG_PREFIX = 'housing:'
const HOUSING_TAG_RE = /^housing:[0-9a-f]{16}$/

export function housingTag(slug: string): CacheTag {
  if (!isSlugLike(slug)) throw new Error(`슬러그가 아니다: ${slug}`)
  return `${HOUSING_TAG_PREFIX}${createHash('sha1').update(slug).digest('hex').slice(0, 16)}`
}

/** slugify 결과(문자·숫자·하이픈)만 통과. revalidate-targets.assertSlug와 같은 기준이다. */
export function isSlugLike(s: string): boolean {
  return s.length > 0 && !/[/:\s?#%]/.test(s)
}

export function isCacheTag(v: string): v is CacheTag {
  if ((ALL_CACHE_TAGS as readonly string[]).includes(v)) return true
  return BENEFIT_TAG_RE.test(v) || HOUSING_TAG_RE.test(v)
}
