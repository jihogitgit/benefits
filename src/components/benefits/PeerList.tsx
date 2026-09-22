import Link from 'next/link'
import { sigunguOf, type PeerItem } from '@/lib/benefits/peer-group'
import { regionName } from './BenefitCard'

/**
 * 같은 사업을 하는 다른 지역 목록.
 *
 * 금액을 싣지 않는다. 두 번 막혔다.
 *
 * 하나는 축이다. amount_text에는 "970만원"(총액)·"월 20만원×3회"(월액)·"125만원씩 4년"
 * (분할)이 한 열에 섞여 있어, 나란히 놓거나 정렬하는 순간 서로 다른 것을 잰 값이 한 축에
 * 서고 그 순서가 곧 "여기가 더 많다"는 주장이 된다.
 *
 * 하나는 발췌다. amount_text는 금액만 담긴 열이 아니라 "○ 지원대상 … ○ 지원금액 …"처럼
 * 절이 여럿인 원문이다. 앞 몇 글자를 자르면 어떤 행은 금액이, 어떤 행은 대상이 실린다 —
 * 표의 열 이름은 하나인데 담긴 것이 행마다 다르다.
 *
 * 그래서 지금은 "어디가 또 하는가"만 답한다. 금액 비교는 축을 하나 정의한 뒤의 일이다.
 *
 * 사업명도 적지 않는다. 묶음 170개 중 제목이 둘 이상인 113개를 전수로 읽었더니 차이가
 * 전부 지역 괄호·꼬리말("지원"·"지급"·"지원사업")·가운뎃점뿐이고 뜻이 다른 예가 없었다.
 * 매 줄에 같은 글자를 반복하면 정작 줄마다 다른 지역명이 묻힌다.
 */
export default function PeerList({ items }: { items: readonly PeerItem[] }) {
  const rows = items
    .map((p) => {
      const sigungu = sigunguOf(p.title, p.agency)
      const sido = regionName(p.region_code)
      return { ...p, sigungu, place: sigungu ? `${sido} ${sigungu}` : sido }
    })
    .sort((a, b) => a.place.localeCompare(b.place, 'ko') || a.title.localeCompare(b.title, 'ko'))

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {rows.map((p) => (
        <li key={p.slug}>
          <Link
            href={`/benefit/${p.slug}`}
            className="block rounded-xl border border-gray-200 px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40"
          >
            <span className="text-[15px] font-semibold text-gray-900">{p.place}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
