import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/JsonLd'
import { breadcrumbs } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import { CALCULATORS } from '../../../../data/calculators'

export const metadata: Metadata = {
  title: '지원금 계산기 모음',
  description: '기준 중위소득 계산기, 아이맞이지원금·아동기본수당 계산기. 정부 발표 자료의 숫자로 계산하고 출처를 밝힙니다.',
  alternates: { canonical: absoluteUrl('/calc') },
}

export default function CalcIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '계산기', path: '/calc' }])} />
      <h1 className="text-2xl font-extrabold sm:text-3xl">계산기</h1>
      <p className="mt-2 max-w-2xl text-gray-600">정부 발표 자료의 숫자를 그대로 옮겨 계산합니다. 각 계산기 아래에 출처와 대조한 날짜를 적어 둡니다.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {CALCULATORS.map((c) => (
          <li key={c.href} className="relative rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm focus-within:border-brand-400">
            <h2 className="text-lg font-bold">
              <Link href={c.href} className="after:absolute after:inset-0 after:rounded-xl hover:text-brand-700">{c.title}</Link>
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{c.description}</p>
            <p className="mt-3 text-xs text-gray-500">{c.basis}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-gray-600">
        계산 결과는 가늠자입니다. 내 조건에 맞는 지원금은 <Link href="/" className="font-medium text-brand-700 hover:underline">진단</Link>에서 찾아보세요.
      </p>
    </div>
  )
}
