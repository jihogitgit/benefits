import type { MetadataRoute } from 'next'
import { createPublicClient } from '@/lib/supabase/server'
import { countByRegion, listPublishedGuides } from '@/lib/benefits/queries'
import { benefitEntries, guideEntries, regionHubEntries, staticEntries, SITEMAP_IDS, type BenefitSitemapRow } from '@/lib/seo/sitemap-entries'
import { PUBLIC_SEGMENTS } from '../../data/segments'
import { REGIONS } from '../../data/regions'

export const revalidate = 3600

const ROWS_PER_PAGE = 1000 // Supabase 단일 응답 기본 최대 행 수

// id 0: 정적 + 가이드 + 지역 허브, id 1..3: 세그먼트별 상세(색인 가능한 것만)
export async function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }))
}

async function hubSitemap(): Promise<MetadataRoute.Sitemap> {
  // 건수는 countByRegion으로만 구한다. benefits를 직접 훑으면 Supabase의 1000행 상한에 조용히
  // 잘려(실데이터 10,947건) 지역 허브가 색인 기준 미달로 오판된다. countByRegion은 range 페이징과
  // 캐시를 이미 갖고 있고, 지역 허브 페이지의 제목 건수와 같은 식(지역 + 전국)을 쓴다.
  const [regionsRes, countsPerSegment, guides] = await Promise.all([
    createPublicClient().from('regions').select('slug, description_md'),
    Promise.all(PUBLIC_SEGMENTS.map((s) => countByRegion(s.slug))),
    listPublishedGuides(),
  ])
  if (regionsRes.error) throw regionsRes.error
  const regions = (regionsRes.data ?? []) as { slug: string; description_md: string | null }[]
  const descriptions = Object.fromEntries(regions.map((r) => [r.slug, r.description_md]))
  // 색인 판정은 '그 지역에만 있는' 건수로만 한다. 전국(ALL)분을 더하면 모든 지역이 통과해
  // doorway page가 된다(index-policy.ts 참고). 페이지 제목의 총계와는 다른 숫자다.
  const counts = PUBLIC_SEGMENTS.flatMap((s, i) =>
    REGIONS.map((r) => ({
      segmentPath: s.path,
      regionSlug: r.slug,
      localCount: countsPerSegment[i][r.slug] ?? 0,
    })),
  )
  return [...staticEntries(), ...guideEntries(guides), ...regionHubEntries(counts, descriptions)]
}

async function segmentSitemap(segment: string): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient()
  const rows: BenefitSitemapRow[] = []
  // 검수 콘텐츠가 채워지면(Plan 3) 세그먼트 하나가 1000건을 넘을 수 있다. 여기서도 range로 끝까지 돈다.
  for (let offset = 0; ; offset += ROWS_PER_PAGE) {
    const { data, error } = await supabase
      .from('benefits')
      // !inner: 해설 행이 있는 지원금만 조인 결과에 남는다
      .select('slug, status, source_updated_at, benefit_articles!inner(review_status, indexable, reviewed_at)')
      .eq('status', 'open')
      .contains('segments', [segment])
      .order('slug', { ascending: true })
      .range(offset, offset + ROWS_PER_PAGE - 1)
    if (error) throw error
    const chunk = (data ?? []) as unknown as (Omit<BenefitSitemapRow, 'benefit_articles'> & {
      benefit_articles: BenefitSitemapRow['benefit_articles'] | NonNullable<BenefitSitemapRow['benefit_articles']>[]
    })[]
    for (const r of chunk) {
      rows.push({ ...r, benefit_articles: Array.isArray(r.benefit_articles) ? (r.benefit_articles[0] ?? null) : r.benefit_articles })
    }
    if (chunk.length < ROWS_PER_PAGE) break
  }
  return benefitEntries(rows)
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  // Next는 경로 조각('0')을 그대로 넘긴다. 타입은 number지만 런타임 값은 문자열이라
  // id === 0이 거짓이 되어 정적·지역 허브 항목이 통째로 사라졌다(사이트맵 0건). 반드시 수치화한다.
  const n = Number(id)
  if (n === 0) return hubSitemap()
  const seg = PUBLIC_SEGMENTS[n - 1]
  if (!seg) return []
  return segmentSitemap(seg.slug)
}
