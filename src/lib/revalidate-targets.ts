import { CACHE_TAGS, type CacheTag } from '@/lib/cache-tags'
import { PUBLIC_SEGMENTS } from '../../data/segments'

/**
 * 재검증 대상(태그·경로) 계산. 스크립트에서 분리한 이유는 두 가지다.
 *
 * 하나는 검증이다. revalidateTag도 revalidatePath도 존재하지 않는 값을 받으면 조용히
 * 성공하므로, 이 계산이 틀리면 "재검증했다"는 로그만 남고 낡은 응답이 계속 나간다.
 * 실제로 가이드를 증보하고 발행했는데 프로덕션이 이전 본문을 그대로 내보낸 적이 있다 —
 * 스크립트가 /benefit 경로와 benefits 태그만 비우고 있었기 때문이다.
 *
 * 다른 하나는 스크립트가 모듈 로드 시점에 main()을 실행해서 import만으로 네트워크 요청이
 * 나간다는 점이다. 순수 함수만 여기로 옮겨 테스트에서 안전하게 부른다.
 */

export interface RevalidateArgs {
  url?: string
  /** /benefit/<slug> — 지원금 상세 */
  slugs: string[]
  /** /guide/<slug> — 가이드 본문 */
  guides: string[]
}

/**
 * 슬러그는 slugify가 만든 값이라 문자·숫자·하이픈뿐이다(src/lib/benefits/slug.ts).
 * 주소를 통째로 붙여넣는 실수를 여기서 잡지 않으면 /benefit/https%3A%2F%2F... 같은 경로가
 * 만들어지고, revalidatePath는 그런 경로에도 조용히 성공한다.
 */
export function assertSlug(s: string): void {
  if (!s) throw new Error('빈 슬러그')
  if (/[/:\s?#%]/.test(s)) throw new Error(`슬러그가 아니다(주소를 붙여넣었는가?): ${s}`)
}

export function parseArgs(argv: string[]): RevalidateArgs {
  const slugs: string[] = []
  const guides: string[] = []
  let url: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--url') {
      // 공백 형태(--url X)를 받지 않으면 X가 슬러그로 흘러들어가 쓰레기 경로를 만든다
      url = argv[++i]
      if (!url) throw new Error('--url 뒤에 주소가 없다')
    } else if (a.startsWith('--url=')) {
      url = a.slice('--url='.length)
    } else if (a === '--guide') {
      const g = argv[++i]
      if (!g) throw new Error('--guide 뒤에 슬러그가 없다')
      guides.push(g)
    } else if (a.startsWith('--guide=')) {
      guides.push(a.slice('--guide='.length))
    } else if (a.startsWith('-')) {
      // 모르는 플래그를 조용히 무시하면 --ulr= 같은 오타가 기본값으로 흘러간다
      throw new Error(`알 수 없는 옵션: ${a}`)
    } else {
      slugs.push(a)
    }
  }
  return { url, slugs, guides }
}

/** API가 한 번에 받는 상한(tags + paths). 서버 쪽 MAX_ITEMS와 같은 값이다. */
export const MAX_ITEMS = 50

/**
 * 경로는 반드시 퍼센트 인코딩해서 넘긴다. 프로덕션에서 두 형태를 교차 측정한 결과
 * 인코딩된 경로만 무효화되고 한글 원형은 캐시가 그대로 HIT였다. Next가 들어온 URL의
 * pathname과 그대로 맞추기 때문이다.
 */
export function buildTargets({ slugs, guides }: Pick<RevalidateArgs, 'slugs' | 'guides'>): {
  tags: CacheTag[]
  paths: string[]
} {
  for (const s of slugs) assertSlug(s)
  for (const g of guides) assertSlug(g)

  // 상세·목록·집계는 benefits:all, 홈 전용 목록은 benefits:home을 달고 있다.
  const tags: CacheTag[] = [CACHE_TAGS.benefitsAll, CACHE_TAGS.benefitsHome]
  // 가이드를 건드릴 때만 guides를 더한다. 가이드 조회 함수(listGuides·getGuide)가 이 태그를
  // 달고 있어서, 경로만 비우고 태그를 빼면 HTML은 다시 만들어지는데 내용이 캐시에서 나온다.
  if (guides.length) tags.push(CACHE_TAGS.guides)

  const paths = [
    '/',
    ...PUBLIC_SEGMENTS.map((s) => `/${s.path}`),
    ...slugs.map((s) => `/benefit/${encodeURIComponent(s)}`),
    // 목록 페이지도 함께 비운다. 제목이 바뀌면 목록에 그대로 남는다.
    ...(guides.length ? ['/guide'] : []),
    ...guides.map((g) => `/guide/${encodeURIComponent(g)}`),
  ]

  if (tags.length + paths.length > MAX_ITEMS) {
    throw new Error(`한 번에 보낼 수 있는 항목은 ${MAX_ITEMS}개다(지금 ${tags.length + paths.length}개). 나눠서 실행한다.`)
  }
  return { tags, paths }
}
