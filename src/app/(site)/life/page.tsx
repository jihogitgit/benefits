import type { Metadata } from 'next'
import Link from 'next/link'
import { LIFE_EVENTS } from '../../../../data/life-events'
import { absoluteUrl } from '@/lib/seo/site'

export const revalidate = 86400

export const metadata: Metadata = {
  title: '생애 이벤트로 찾기',
  description: '출산·임신·입학·구직처럼 실제로 벌어진 일로 지원금을 찾습니다. 순서대로 할 것과 함께 봅니다.',
  alternates: { canonical: absoluteUrl('/life') },
}

export default function LifeIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">생애 이벤트로 찾기</h1>
      <p className="mt-2 max-w-2xl text-gray-600">
        나이·지역보다 &ldquo;무슨 일이 있었는지&rdquo;가 먼저인 경우가 많습니다. 사건을 고르면 해당하는
        지원금과 순서대로 할 일을 함께 보여줍니다.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {LIFE_EVENTS.map((e) => (
          <Link
            key={e.slug}
            href={`/life/${e.slug}`}
            className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <h2 className="text-lg font-bold text-gray-900">{e.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{e.description}</p>
          </Link>
        ))}
      </div>

      {/* 왜 네 개뿐인지 화면에서도 밝힌다. 없는 것을 곧 만들 것처럼 두면 기대를 만든다. */}
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-gray-600">
        지금은 네 가지만 엽니다. 원천 데이터(행정안전부 보조금24)가 조건으로 구분해 주는 사건이
        출산·임신·학령기·구직까지이기 때문입니다. 퇴사·폐업·장례 같은 사건은 제목에 낱말이 들어간
        공고를 긁어 만들 수는 있지만, 그러면 &ldquo;해당하는 지원금&rdquo;이라고 말하면서 실제로는
        낱말이 걸린 목록을 보여주게 됩니다. 근거가 생기기 전에는 열지 않습니다.
      </p>
    </div>
  )
}
