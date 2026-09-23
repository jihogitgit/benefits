import type { Metadata } from 'next'
import Link from 'next/link'
import MedianIncomeCalculator from '@/components/income/MedianIncomeCalculator'
import {
  MEDIAN_INCOME_2026,
  MEDIAN_INCOME_YEAR,
  MEDIAN_INCOME_ANCHORS,
  MEDIAN_INCOME_SOURCE,
  MAX_HOUSEHOLD_SIZE,
} from '../../../../data/median-income'
import { amountAt } from '@/lib/benefits/income'
import { absoluteUrl } from '@/lib/seo/site'

/** 고시값은 해마다 한 번 바뀐다. 매시간 다시 만들 이유가 없다. */
export const revalidate = 86400

export const metadata: Metadata = {
  title: `${MEDIAN_INCOME_YEAR}년 기준 중위소득 계산기`,
  description: `가구원 수와 월 소득을 넣으면 ${MEDIAN_INCOME_YEAR}년 기준 중위소득의 몇 %인지 계산하고, 그 구간에서 신청할 수 있는 지원금으로 바로 연결합니다.`,
  alternates: { canonical: absoluteUrl('/median-income') },
}

const SIZES = Array.from({ length: MAX_HOUSEHOLD_SIZE }, (_, i) => i + 1)
const won = (n: number) => n.toLocaleString('ko-KR')

export default function MedianIncomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{MEDIAN_INCOME_YEAR}년 기준 중위소득 계산기</h1>
      <p className="mt-2 max-w-2xl text-gray-600">
        거의 모든 지원금이 &ldquo;중위소득 몇 % 이하&rdquo;로 자격을 정합니다. 가구원 수와 월 소득을 넣으면
        내가 어느 구간인지 계산하고, 그 구간에서 신청할 수 있는 지원금으로 바로 넘어갑니다.
      </p>

      <div className="mt-6">
        <MedianIncomeCalculator />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold">가구원 수별 기준 중위소득</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">{MEDIAN_INCOME_YEAR}년 가구원 수별 월 기준 중위소득</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">가구원 수</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">월 기준 중위소득 (100%)</th>
              </tr>
            </thead>
            <tbody>
              {SIZES.map((n) => (
                <tr key={n} className="border-b border-gray-100">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-gray-900">{n}인</th>
                  <td className="py-2 pr-3 text-right tabular-nums text-gray-900">{won(MEDIAN_INCOME_2026[n])}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          7인 이상 가구는 고시 원문을 확인하세요. 위 보도자료 표가 6인까지만 싣습니다.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-xl font-bold">제도별 기준선</h2>
        <p className="mb-3 text-sm text-gray-600">
          아래 비율은 임의로 고른 눈금이 아니라 보건복지부 보도자료가 제도와 함께 명시한 값입니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">제도별 기준 중위소득 비율과 가구원 수별 금액</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">제도</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">기준</th>
                {SIZES.map((n) => (
                  <th key={n} scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">{n}인</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEDIAN_INCOME_ANCHORS.map((a) => (
                <tr key={`${a.pct}-${a.label}`} className="border-b border-gray-100">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-gray-900">{a.label}</th>
                  <td className="py-2 pr-3 tabular-nums text-gray-600">{a.pct}%</td>
                  {SIZES.map((n) => (
                    <td key={n} className="py-2 pr-3 text-right tabular-nums text-gray-700">
                      {won(amountAt(n, a.pct)!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-bold text-gray-900">이 숫자는 어디서 왔나</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-700">
          기준 중위소득은 보건복지부 장관이 중앙생활보장위원회 심의를 거쳐 고시합니다. 위 표는{' '}
          <a
            href={MEDIAN_INCOME_SOURCE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 underline hover:text-brand-800"
          >
            {MEDIAN_INCOME_SOURCE.label}
          </a>
          의 표를 그대로 옮긴 값입니다. 실제 자격은 세전 소득이 아니라 소득인정액(소득평가액 + 재산의 소득환산액)으로
          판정하는 제도가 많아, 계산 결과는 <b className="font-semibold">가늠자</b>이지 판정이 아닙니다.
          신청 전에 각 지원금의 공식 페이지에서 확인하세요.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/" className="font-medium text-brand-700 hover:underline">나이·지역까지 넣어 진단하기 →</Link>
        </p>
      </section>
    </div>
  )
}
