import { CACHE_TAGS } from '../src/lib/cache-tags'
import { PUBLIC_SEGMENTS } from '../data/segments'

/**
 * 해설 발행 후 온디맨드 재검증.
 *
 * 발행만 하면 화면에 나오지 않는다. 조회 함수(unstable_cache)와 페이지(ISR)가 각각 캐시를
 * 갖고 있어 최악의 경우 12시간 동안 이전 응답이 나간다. 그 사이 크롤러가 새로 생긴 내부
 * 링크를 타고 들어오면 아직 noindex인 상세 페이지를 받는데, 이는 링크가 없는 것보다 나쁘다 —
 * 검색엔진에 "이 페이지는 색인하지 말라"고 명시적으로 알려주는 꼴이 된다.
 *
 * 경로는 반드시 퍼센트 인코딩해서 넘긴다. 프로덕션에서 두 형태를 교차 측정한 결과
 * 인코딩된 경로만 무효화되고(4/4) 한글 원형은 캐시가 그대로 HIT였다. Next가 들어온 URL의
 * pathname과 그대로 맞추기 때문이다. 이 값을 틀리면 API는 ok를 주지만 아무 일도 일어나지 않는다.
 *
 * 사용:
 *   npm run revalidate -- --url=https://naemok.com
 *   npm run revalidate -- --url=https://naemok.com 청년월세-지원 두루누리-사회보험료-지원
 *
 * 대상은 --url 또는 REVALIDATE_TARGET으로 명시한다. NEXT_PUBLIC_SITE_URL은 기본값으로 쓰지
 * 않는다 — 로컬 개발용(localhost)일 때는 무의미하고, 프로덕션을 가리키게 바꿔 둔 사람이
 * 인자 없이 실행하면 의도치 않게 프로덕션 캐시를 비우게 된다.
 */

/** CRON_SECRET을 보낼 수 있는 호스트. 오타 하나로 프로덕션 비밀키가 임의 호스트로 나가지 않도록 한다. */
const ALLOWED_HOSTS = new Set(['naemok.com', 'www.naemok.com'])

function parseArgs(argv: string[]): { url?: string; slugs: string[] } {
  const slugs: string[] = []
  let url: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--url') {
      // 공백 형태(--url X)를 받지 않으면 X가 슬러그로 흘러들어가 쓰레기 경로를 만든다
      url = argv[++i]
      if (!url) throw new Error('--url 뒤에 주소가 없다')
    } else if (a.startsWith('--url=')) {
      url = a.slice('--url='.length)
    } else if (a.startsWith('-')) {
      // 모르는 플래그를 조용히 무시하면 --ulr= 같은 오타가 기본값으로 흘러간다
      throw new Error(`알 수 없는 옵션: ${a}`)
    } else {
      slugs.push(a)
    }
  }
  return { url, slugs }
}

function resolveTarget(flag?: string): string {
  const raw = (flag ?? process.env.REVALIDATE_TARGET ?? '').trim()
  if (!raw) throw new Error('재검증 대상이 없다. --url=https://naemok.com 을 붙이거나 REVALIDATE_TARGET을 설정한다.')
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error(`주소 형식이 아니다: ${raw}`)
  }
  if (u.protocol !== 'https:') throw new Error(`https만 허용한다: ${raw}`)
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    throw new Error(`허용되지 않은 호스트: ${u.hostname} (허용: ${[...ALLOWED_HOSTS].join(', ')})`)
  }
  return u.origin
}

/**
 * 슬러그는 slugify가 만든 값이라 문자·숫자·하이픈뿐이다(src/lib/benefits/slug.ts).
 * 주소를 통째로 붙여넣는 실수를 여기서 잡지 않으면 /benefit/https%3A%2F%2F... 같은 경로가
 * 만들어지고, revalidatePath는 그런 경로에도 조용히 성공한다.
 */
function assertSlug(s: string): void {
  if (/[/:\s?#%]/.test(s)) throw new Error(`슬러그가 아니다(주소를 붙여넣었는가?): ${s}`)
}

async function main() {
  const { url, slugs } = parseArgs(process.argv.slice(2))
  const base = resolveTarget(url)
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET이 없다')
  for (const s of slugs) assertSlug(s)

  const paths = [
    '/',
    ...PUBLIC_SEGMENTS.map((s) => `/${s.path}`),
    // absoluteUrl과 같은 방식(구간별 encodeURIComponent)으로 인코딩한다
    ...slugs.map((s) => `/benefit/${encodeURIComponent(s)}`),
  ]
  // 상세·목록·집계는 benefits:all, 홈 전용 목록은 benefits:home을 달고 있다. 해설 발행은 둘 다 건드린다.
  const tags = [CACHE_TAGS.benefitsAll, CACHE_TAGS.benefitsHome]

  let res: Response
  try {
    res = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ tags, paths }),
    })
  } catch (e) {
    throw new Error(`${base} 요청 실패: ${e instanceof Error ? (e.cause ?? e.message) : e}`)
  }
  const body = (await res.json().catch(() => null)) as { tags?: string[]; paths?: string[] } | null
  if (!res.ok) throw new Error(`재검증 실패 HTTP ${res.status}: ${JSON.stringify(body)}`)

  // 서버가 되돌려준 목록과 대조한다. 이 검사가 없으면 서버가 조용히 버린 항목을
  // 성공으로 출력하게 되고, 없애려던 '거짓 성공'이 스크립트 쪽에 그대로 남는다.
  const same = (a: string[], b: string[] | undefined) => !!b && a.length === b.length && a.every((v, i) => v === b[i])
  if (!same(tags, body?.tags) || !same(paths, body?.paths)) {
    throw new Error(`서버가 처리한 목록이 보낸 것과 다르다.\n  보냄: ${JSON.stringify({ tags, paths })}\n  받음: ${JSON.stringify(body)}`)
  }

  // 무효화 직후 첫 요청은 stale을 받고 뒤에서 재생성된다. 크롤러가 그 한 번을 가져가지
  // 않도록 여기서 먼저 한 번씩 훑어 재생성을 끝내 둔다.
  await Promise.all(paths.map((p) => fetch(`${base}${p}`).catch(() => null)))

  console.log(`재검증 완료 — 태그 ${tags.length}개, 경로 ${paths.length}개 (재생성까지 확인)`)
  for (const p of paths) console.log(`  ${p}`)
  console.log('\n사이트맵(/sitemap/*.xml)은 revalidate 1시간이라 따로 손대지 않아도 반영된다.')
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
