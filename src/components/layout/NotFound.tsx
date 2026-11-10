import Link from 'next/link'
import { PUBLIC_SEGMENTS } from '../../../data/segments'

/**
 * 404 본문. 두 not-found.tsx(루트·(site))가 같은 내용을 낸다.
 *
 * Next 기본 404는 영문("This page could not be found")이고 헤더·푸터도 없다. 이 사이트의 404는
 * 대부분 마감되어 내려간 지원금 주소이거나 한글 슬러그가 잘려 들어온 경우라, "없다"만 말하지 않고
 * 다음 행동(찾기·분야·진단)으로 이어 준다.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">페이지를 찾을 수 없습니다</h1>
      <p className="mx-auto mt-3 max-w-md text-gray-600">
        주소가 바뀌었거나, 지원금이 마감되어 내려갔을 수 있습니다. 아래에서 다시 찾아보세요.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link href="/benefits" className="inline-flex min-h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          지원금 찾기
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm font-medium text-gray-800 hover:border-brand-400">
          조건으로 진단하기
        </Link>
      </div>

      <nav aria-label="분야별로 보기" className="mt-10">
        <h2 className="text-sm font-semibold text-gray-500">분야별로 보기</h2>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {PUBLIC_SEGMENTS.map((s) => (
            <li key={s.slug}>
              <Link href={`/${s.path}`} className="inline-flex min-h-10 items-center rounded-full border bg-white px-4 text-sm hover:border-brand-400">
                {s.name} 지원금
              </Link>
            </li>
          ))}
          <li>
            <Link href="/guide" className="inline-flex min-h-10 items-center rounded-full border bg-white px-4 text-sm hover:border-brand-400">
              가이드
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  )
}
