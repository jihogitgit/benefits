import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

/**
 * 발행 후 온디맨드 재검증.
 *
 * 가이드 본문은 DB에 있고 화면은 ISR이라, 발행해도 만료(24시간) 전까지는 이전 응답이 그대로 나간다.
 * 특히 초안(published_at=null) 상태에서 그 주소가 한 번이라도 요청되면 notFound()의 404가 라우트
 * 캐시에 박혀서, 발행 후에도 계속 404가 나간다. 실제로 그렇게 됐다.
 *
 * unstable_cache의 태그 무효화(revalidateTag)만으로는 이미 만들어진 404 HTML이 지워지지 않아
 * 경로 재검증(revalidatePath)이 함께 필요하다.
 */
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
  const tagList = strings(tags)
  const pathList = strings(paths).filter((p) => p.startsWith('/'))

  if (!tagList.length && !pathList.length) {
    return NextResponse.json({ error: 'tags 또는 paths 중 하나는 있어야 한다' }, { status: 400 })
  }

  for (const t of tagList) revalidateTag(t)
  for (const p of pathList) revalidatePath(p)

  return NextResponse.json({ ok: true, tags: tagList, paths: pathList })
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
}
