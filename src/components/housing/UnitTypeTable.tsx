import type { HousingUnitTypeRow } from '@/types/housing'

const won = (n: number | null) => (n == null ? '-' : `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}억`)
const num = (n: number | null) => (n == null ? '-' : n.toLocaleString())

/** 주택형별 면적·최고 분양가·세대수. 분양가는 만원 단위 원문을 억으로 보여준다(98000 → 9.8억). */
export default function UnitTypeTable({ rows }: { rows: HousingUnitTypeRow[] }) {
  if (!rows.length) return null
  const anySpecial = rows.some((r) => (r.special_units ?? 0) > 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">주택형별 공급 내역</caption>
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th scope="col" className="py-2 pr-3 font-semibold text-gray-700">주택형</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">공급면적(㎡)</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">최고 분양가</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">일반</th>
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">특별</th>}
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">신혼</th>}
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">생애최초</th>}
            {anySpecial && <th scope="col" className="py-2 pr-3 text-right font-semibold text-gray-700">다자녀</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.house_type} className="border-b border-gray-100">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-gray-900">{r.house_type}</th>
              <td className="py-2 pr-3 text-right tabular-nums">{r.supply_area ?? '-'}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{won(r.max_price_manwon)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{num(r.general_units)}</td>
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.special_units)}</td>}
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.sp_newlywed)}</td>}
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.sp_first_life)}</td>}
              {anySpecial && <td className="py-2 pr-3 text-right tabular-nums">{num(r.sp_multi_child)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-500">분양가는 주택형별 최고가(청약홈 원문, 만원 단위를 억으로 환산). 실제 금액은 모집공고문을 확인하세요.</p>
    </div>
  )
}
