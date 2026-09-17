import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { ALL_CACHE_TAGS, isCacheTag } from '@/lib/cache-tags'

export const runtime = 'nodejs'

/**
 * 발행 후 온디맨드 재검증.
 *
 * 가이드·해설 본문은 DB에 있고 화면은 ISR이라, 발행해도 만료 전까지는 이전 응답이 그대로 나간다.
 * 특히 초안(published_at=null) 상태에서 그 주소가 한 번이라도 요청되면 notFound()의 404가 라우트
 * 캐시에 박혀서, 발행 후에도 계속 404가 나간다. 실제로 그렇게 됐다.
 *
 * unstable_cache의 태그 무효화(revalidateTag)만으로는 이미 만들어진 HTML이 지워지지 않아
 * 경로 재검증(revalidatePath)이 함께 필요하다.
 *
 * 입력이 조금이라도 모호하면 무효화하지 않고 400을 낸다. 이 엔드포인트의 실패는 전부
 * 조용하기 때문이다 — revalidateTag는 없는 태그를 받아도 성공하고, revalidatePath는 없는
 * 경로를 받아도 성공한다. 그래서 호출자는 "무효화됐다"고 믿고 낡은 응답이 계속 나간다.
 * 실제로 'benefits', 'benefit-articles', 'sitemap'을 보내고 ok:true를 받은 적이 있다(셋 다
 * 존재하지 않는 태그다). 일부만 도는 것은 전부 실패보다 나쁘다 — 성공으로 보이기 때문이다.
 */

const MAX_ITEMS = 50 // 인증된 입구지만 무한 루프를 돌 이유가 없다(cron 라우트의 maxDuration 사고 참고)

export const maxDuration = 60

export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요하다' }, { status: 400 })
  }

  const { tags, paths } = (body ?? {}) as { tags?: unknown; paths?: unknown }

  // 모양부터 본다. 배열이 아닌 값을 조용히 []로 바꾸면 검증할 것이 사라져, 오타가 그대로
  // ok:true가 된다. {"tags":"benefits:all"}(배열을 빼먹은 가장 흔한 실수)이 실제로 그랬다.
  const tagList = stringArray(tags)
  if (tagList === null) return bad('tags는 문자열 배열이어야 한다', { got: tags })
  const pathList = stringArray(paths)
  if (pathList === null) return bad('paths는 문자열 배열이어야 한다', { got: paths })

  if (tagList.length + pathList.length > MAX_ITEMS) {
    return bad(`tags와 paths의 합은 ${MAX_ITEMS}개를 넘을 수 없다`, { count: tagList.length + pathList.length })
  }

  const unknownTags = tagList.filter((t) => !isCacheTag(t))
  if (unknownTags.length) return bad('알 수 없는 태그', { unknown: unknownTags, valid: ALL_CACHE_TAGS })

  // 버리지 않고 거절한다. 버리면 호출자는 자기가 보낸 경로가 처리된 줄 안다.
  const badPaths = pathList.filter((p) => !p.startsWith('/') || p.startsWith('//'))
  if (badPaths.length) return bad('경로는 /로 시작해야 한다', { invalid: badPaths })

  if (!tagList.length && !pathList.length) {
    return bad('tags 또는 paths 중 하나는 있어야 한다')
  }

  for (const t of tagList) revalidateTag(t)
  for (const p of pathList) revalidatePath(p)

  // 호출자가 보낸 것과 대조할 수 있도록 그대로 되돌려준다(스크립트가 이 값을 검사한다)
  return NextResponse.json({ ok: true, tags: tagList, paths: pathList })
}

function bad(error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status: 400 })
}

/** 문자열 배열이면 그대로, 없으면 [], 그 외에는 null(거절 신호). */
function stringArray(v: unknown): string[] | null {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) return null
  if (!v.every((x) => typeof x === 'string' && x.length > 0)) return null
  return v
}
