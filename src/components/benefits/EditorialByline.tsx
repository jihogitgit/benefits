import Link from 'next/link'
import { formatKstDay } from '@/lib/benefits/format'
import { siteName } from '@/lib/seo/site'

/**
 * 해설·가이드 상단의 작성·검수 표기.
 *
 * 애드센스 심사와 검색 품질 평가 모두 "누가 썼고 언제 확인했는가"를 본다. 지금까지는 상세 푸터에
 * 동기화 시각만 있었고, 가이드에는 아무 날짜도 없었다(JSON-LD에만 있었다). 사람이 읽는 자리에
 * 같은 사실을 둔다.
 *
 * "작성"이 아니라 "검수"로 적는다. 해설 초안은 자동으로 만들어지고(queries.ts의 listWithArticles 주석)
 * 사람이 하는 일은 원문 대조·수정·검수라서, 작성자로 이름을 올리면 사실과 다르다. 초안 방식은
 * /about#editorial에 밝힌다. 이름은 NEXT_PUBLIC_EDITOR_NAME이 있으면 그 값을, 없으면
 * "{사이트명} 편집팀" — 없는 이름을 지어내지 않기 위해서다.
 */
export default function EditorialByline({
  reviewedAt,
  publishedAt,
  updatedAt,
}: {
  /** 해설: 검수일(benefit_articles.reviewed_at) */
  reviewedAt?: string | null
  /** 가이드: 발행일 */
  publishedAt?: string | null
  /** 가이드: 증보일. 없으면 표시하지 않는다(발행일로 채우면 "증보한 적 없음"과 구분되지 않는다). */
  updatedAt?: string | null
}) {
  const editor = process.env.NEXT_PUBLIC_EDITOR_NAME?.trim() || `${siteName()} 편집팀`
  const parts: string[] = []
  if (publishedAt) parts.push(`발행 ${formatKstDay(publishedAt)}`)
  if (updatedAt) parts.push(`수정 ${formatKstDay(updatedAt)}`)
  if (reviewedAt) parts.push(`검수 ${formatKstDay(reviewedAt)}`)

  return (
    <p className="mt-2 text-xs text-gray-500">
      <span>검수 {editor}</span>
      {parts.map((p) => (
        <span key={p}> · {p}</span>
      ))}
      <span>
        {' '}
        ·{' '}
        <Link href="/about#editorial" className="underline hover:text-gray-700">
          편집 원칙
        </Link>
      </span>
    </p>
  )
}
