import { listGuides, listWithArticles, EXPLAINED_ALL_LIMIT } from '@/lib/benefits/queries'
import { absoluteUrl, siteName, SITE_DESCRIPTION } from '@/lib/seo/site'
import { PUBLIC_SEGMENTS } from '../../../data/segments'

/**
 * llms.txt(llmstxt.org 제안 형식). AI 검색·답변 엔진이 사이트의 요지와 읽을 만한 페이지를
 * 한 번에 찾게 한다. 목록은 사이트맵과 같은 기준(색인 대상 해설·발행된 가이드)만 싣는다 —
 * noindex 상세를 여기 올리면 검색엔진에 숨긴 페이지를 다른 경로로 내미는 셈이 된다.
 */
export const revalidate = 3600

export async function GET(): Promise<Response> {
  const [guides, explained] = await Promise.all([listGuides(), listWithArticles(null, EXPLAINED_ALL_LIMIT)])
  if (explained.length >= EXPLAINED_ALL_LIMIT) console.warn(`해설 목록이 상한 ${EXPLAINED_ALL_LIMIT}건에 닿았다 — 잘린 행이 있다`)
  // 사업명에 대괄호가 들어가면 마크다운 링크가 깨지므로 이스케이프한다.
  const line = (title: string, path: string) => `- [${title.replace(/[[\]]/g, '\\$&')}](${absoluteUrl(path)})`
  const body = [
    `# ${siteName()}`,
    '',
    `> ${SITE_DESCRIPTION} 행정안전부 보조금24 공공데이터를 매일 두 번 동기화하며, 신청 자격·금액·기한은 각 지원금의 공식 페이지에서 최종 확인해야 합니다.`,
    '',
    '## 찾기',
    line('지원금 전체 목록(분야·지역·신청 상태 필터)', '/benefits'),
    ...PUBLIC_SEGMENTS.map((s) => line(`${s.name} 지원금`, `/${s.path}`)),
    line('마감 임박 지원금', '/deadline'),
    line('기준 중위소득 계산기', '/median-income'),
    '',
    '## 가이드',
    ...guides.map((g) => line(g.title, `/guide/${g.slug}`)),
    '',
    '## 해설이 있는 지원금',
    ...explained.map((r) => line(r.title, `/benefit/${r.slug}`)),
    '',
    '## 기타',
    line('서비스 소개·데이터 출처', '/about'),
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
