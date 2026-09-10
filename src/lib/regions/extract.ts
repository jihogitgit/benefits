import { REGIONS, REGION_ALL } from '../../../data/regions'

// 긴 키워드(정식 명칭)를 먼저 검사해 "경기도 광주시"가 광주로 잡히지 않게 한다.
const ORDERED = REGIONS.flatMap((r) => r.keywords.map((kw) => ({ kw, slug: r.slug }))).sort(
  (a, b) => b.kw.length - a.kw.length,
)

/** 소관기관명에서 시도 slug를 뽑는다. 중앙부처·공공기관·빈 값은 ALL. */
export function extractRegion(agency: string | null | undefined): string {
  if (!agency) return REGION_ALL
  // 첫 어절(시도 단위)만 본다. "경기도 광주시" → "경기도"
  const head = agency.trim().split(/\s+/)[0]
  for (const { kw, slug } of ORDERED) if (head.startsWith(kw)) return slug
  return REGION_ALL
}
