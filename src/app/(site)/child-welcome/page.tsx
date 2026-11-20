import type { Metadata } from 'next'
import Link from 'next/link'
import ChildWelcomeCalculator from '@/components/calc/ChildWelcomeCalculator'
import JsonLd from '@/components/JsonLd'
import { breadcrumbs } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import { currentPlan, reformPlan } from '@/lib/benefits/child-welcome'
import { CHILD_WELCOME_SOURCE, type Area, type BirthOrder } from '../../../../data/child-welcome'

/** 정부안이 바뀔 때만 바뀐다. */
export const revalidate = 86400

const TITLE = '아이맞이지원금·아동기본수당 계산기 (2027년 개편안)'

export const metadata: Metadata = {
  title: TITLE,
  description: '출생 월, 출생 순위, 지역, 보육 방식을 고르면 2027년 개편안의 아이맞이지원금과 아동기본수당을 0~12세 합계로 계산하고 현행 제도와 비교합니다. 보건복지부 발표 자료 기준.',
  alternates: { canonical: absoluteUrl('/child-welcome') },
}

const ORDERS: { order: BirthOrder; label: string }[] = [{ order: 1, label: '첫째' }, { order: 2, label: '둘째' }, { order: 3, label: '셋째 이상' }]
const AREAS: { area: Area; label: string; currentLabel: string }[] = [
  { area: 'basic', label: '기본 지역', currentLabel: '수도권' },
  { area: 'priority', label: '우대지역', currentLabel: '인구감소지역(특별)' },
]
const n = (v: number) => v.toLocaleString('ko-KR')

export default function ChildWelcomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <JsonLd data={breadcrumbs([{ name: '홈', path: '/' }, { name: '아이맞이지원금 계산기', path: '/child-welcome' }])} />
      <nav className="mb-1 text-xs text-gray-500" aria-label="현재 위치"><Link href="/" className="hover:underline">홈</Link> › <Link href="/calc" className="hover:underline">계산기</Link></nav>
      <h1 className="text-2xl font-extrabold sm:text-3xl">아이맞이지원금·아동기본수당 계산기</h1>
      <p className="mt-2 max-w-2xl text-gray-600">
        2027년 7월 1일 이후 태어나는 아이부터 첫만남이용권·부모급여·아동수당이 아이맞이지원금과 아동기본수당으로 바뀔 예정입니다. 우리 아이가 12세까지 얼마를 받는지, 지금 제도와 얼마나 다른지 계산합니다.
      </p>
      <p className="mt-3 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="status">
        <b className="font-semibold">아직 정부안입니다.</b> 국회 예산 심의와 아동수당법 개정이 남아 있어 금액, 대상, 시행일이 바뀔 수 있습니다. 아래 숫자는 2026년 8월 28일 보건복지부 발표 기준입니다.
      </p>

      <div className="mt-6"><ChildWelcomeCalculator /></div>

      <section className="mt-10">
        <h2 className="mb-1 text-xl font-bold">한눈에 보는 0~12세 합계</h2>
        <p className="mb-3 text-sm text-gray-600">가정 보육 기준, 단위 만 원. 보건복지부 자료의 비교표와 같은 값입니다. 현행 금액은 비교표를 따라 수도권(아동수당 월 10만 원)과 인구감소지역 특별(월 12만 원)로 계산해, 다른 지역은 조금 다릅니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">출생 순위·지역별 현행 제도와 개편안의 0~12세 합계</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">순위</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">지역</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">현행</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">개편안</th>
                <th scope="col" className="py-2 text-right font-semibold text-gray-700">차이</th>
              </tr>
            </thead>
            <tbody>
              {ORDERS.flatMap((o) => AREAS.map((a) => {
                const cur = currentPlan({ order: o.order, area: a.area, care: 'home' })!.total
                const ref = reformPlan({ order: o.order, area: a.area, care: 'home' }).total
                return (
                  <tr key={`${o.order}-${a.area}`} className="border-b border-gray-100">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-gray-900">{o.label}</th>
                    <td className="py-2 pr-3 text-gray-700">{a.label}<span className="block text-xs text-gray-500">현행 {a.currentLabel}</span></td>
                    <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{n(cur)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold text-gray-900">{n(ref)}</td>
                    <td className="py-2 text-right tabular-nums text-brand-700">+{n(ref - cur)}</td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="mb-3 text-xl font-bold">알아둘 것</h2>
        <dl className="space-y-4 text-sm leading-relaxed text-gray-700">
          <div><dt className="font-semibold text-gray-900">누가 새 제도를 받나요</dt><dd className="mt-1">2027년 7월 1일 이후 태어난 아이입니다. 2027년 6월 30일까지 태어난 아이에게는 지금 제도가 그대로 적용될 예정입니다: 첫만남이용권(출생 후 2년 안에 사용), 부모급여(만 2세 미만까지), 아동수당(만 13세 미만까지).</dd></div>
          <div><dt className="font-semibold text-gray-900">아이맞이지원금은 언제 들어오나요</dt><dd className="mt-1">출생 후 1년 동안 분기마다 네 번, 현금으로 받습니다. 2027년 7월생이면 2027년 7월·10월, 2028년 1월·4월입니다. 바우처였던 첫만남이용권과 달리 쓰는 곳과 기한에 제한이 없습니다.</dd></div>
          <div><dt className="font-semibold text-gray-900">중간에 이사하면요</dt><dd className="mt-1">아이맞이지원금은 지급월 15일, 아동기본수당은 매월 15일에 사는 주소가 기준입니다. 정부 자료의 예: 2027년 7월에 수도권에서 태어난 첫째가 12월 31일에 우대지역으로 이사하면 7월·10월에는 250만 원씩, 이듬해 1월·4월에는 375만 원씩 받아 합계가 1,250만 원입니다.</dd></div>
          <div><dt className="font-semibold text-gray-900">몇째인지는 어떻게 정하나요</dt><dd className="mt-1">주민등록등본과 부모의 가족관계증명서에 나온 출생 순위로 정합니다. 이혼한 경우는 기본증명서·법원 판결문 등으로, 입양은 입양관계증명서 등으로 확인합니다. 재혼해서 낳은 아이는 양육권이 있는지에 따라 순위가 달라질 수 있습니다.</dd></div>
          <div><dt className="font-semibold text-gray-900">출생신고가 늦으면 못 받나요</dt><dd className="mt-1">출생신고나 계좌 정보 제출이 늦어도, 주민등록번호와 계좌 정보가 확인되면 받지 못한 급여를 출생월부터 소급해서 지급합니다.</dd></div>
          <div><dt className="font-semibold text-gray-900">이 계산이 가정한 것</dt><dd className="mt-1">12세까지 같은 지역에 살고, 0~1세 동안 보육 방식이 바뀌지 않는다고 보았습니다. 현행 제도 금액은 정부 자료의 비교표를 따라 기본 지역은 수도권(아동수당 월 10만 원), 우대지역은 인구감소지역 특별(월 12만 원)으로 계산했습니다. 지자체가 따로 주는 출산지원금은 넣지 않았습니다.</dd></div>
        </dl>
      </section>

      <section className="mt-10 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-bold text-gray-900">이 숫자는 어디서 왔나</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-700">
          <a href={CHILD_WELCOME_SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline hover:text-brand-800">{CHILD_WELCOME_SOURCE.label}</a>
          의 표와 질의응답에서 옮겼고, {CHILD_WELCOME_SOURCE.checkedAt.replace(/-/g, '.')}에 원문과 대조했습니다. 계산 결과는 <b className="font-semibold">가늠자</b>입니다. 제도가 확정되면 이 페이지도 고칩니다.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/parenting" className="font-medium text-brand-700 hover:underline">지금 신청할 수 있는 출산·육아 지원금 →</Link>
          <Link href="/median-income" className="font-medium text-brand-700 hover:underline">중위소득 계산기 →</Link>
        </p>
      </section>
    </div>
  )
}
