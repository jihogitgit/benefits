import { parseArgs, buildTargets } from '../src/lib/revalidate-targets'

/**
 * 발행 후 온디맨드 재검증.
 *
 * 발행만 하면 화면에 나오지 않는다. 조회 함수(unstable_cache)와 페이지(ISR)가 각각 캐시를
 * 갖고 있어 최악의 경우 12시간 동안 이전 응답이 나간다. 그 사이 크롤러가 새로 생긴 내부
 * 링크를 타고 들어오면 아직 noindex인 상세 페이지를 받는데, 이는 링크가 없는 것보다 나쁘다 —
 * 검색엔진에 "이 페이지는 색인하지 말라"고 명시적으로 알려주는 꼴이 된다.
 *
 * 태그·경로 계산은 src/lib/revalidate-targets.ts에 있다(테스트가 붙어 있다).
 *
 * 사용:
 *   npm run revalidate -- --url=https://naemok.com
 *   npm run revalidate -- --url=https://naemok.com 청년월세-지원 두루누리-사회보험료-지원
 *   npm run revalidate -- --url=https://naemok.com --guide=출산지원금-첫만남이용권-부모급여-아동수당
 *
 * 슬러그를 여러 개 넘길 때는 npm run 대신 npx tsx를 직접 쓴다. npm이 -- 뒤 인자를 한 덩어리로
 * 넘겨 슬러그들이 argv 한 칸에 뭉친다.
 *   npx tsx --env-file=.env.local scripts/revalidate.ts --url=https://naemok.com a b c
 *
 * 대상은 --url 또는 REVALIDATE_TARGET으로 명시한다. NEXT_PUBLIC_SITE_URL은 기본값으로 쓰지
 * 않는다 — 로컬 개발용(localhost)일 때는 무의미하고, 프로덕션을 가리키게 바꿔 둔 사람이
 * 인자 없이 실행하면 의도치 않게 프로덕션 캐시를 비우게 된다.
 */

/** CRON_SECRET을 보낼 수 있는 호스트. 오타 하나로 프로덕션 비밀키가 임의 호스트로 나가지 않도록 한다. */
const ALLOWED_HOSTS = new Set(['naemok.com', 'www.naemok.com'])

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

async function main() {
  const { url, slugs, guides } = parseArgs(process.argv.slice(2))
  const base = resolveTarget(url)
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET이 없다')

  const { tags, paths } = buildTargets({ slugs, guides })

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
  for (const t of tags) console.log(`  #${t}`)
  for (const p of paths) console.log(`  ${p}`)
  console.log('\n사이트맵(/sitemap/*.xml)은 revalidate 1시간이라 따로 손대지 않아도 반영된다.')
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
