import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPeerGroup } from '@/lib/benefits/queries'
import { sigunguOf, type PeerItem } from '@/lib/benefits/peer-group'
import { compareIndexable } from '@/lib/seo/index-policy'
import { breadcrumbs } from '@/lib/seo/jsonld'
import { absoluteUrl } from '@/lib/seo/site'
import { kstYear } from '@/lib/seo/hub-meta'
import { eulReul } from '@/lib/korean'
import { regionName } from '@/components/benefits/BenefitCard'
import JsonLd from '@/components/JsonLd'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return [] // 요청 시 생성. 묶음 170개를 전부 빌드할 이유가 없다.
}

/**
 * 시·도별로 갈라 건수 많은 순으로. 한 줄 요약과 본문 목록이 같은 순서를 본다.
 *
 * 건수와 지자체 수를 따로 센다. 한 지자체가 같은 사업을 여러 건 등록한 묶음이 170개 중
 * 7개 있고, 체육시설 이용요금 감면은 31건이지만 지자체는 22곳이다. 건수를 "지자체 N곳"
 * 이라고 쓰면 9곳을 부풀려 말하게 된다.
 *
 * 같은 지자체가 여럿인 자리에는 원래 제목을 함께 적는다. 안 적으면 목록에 「청주시」가
 * 세 줄 연달아 나오고, 서로 다른 세 페이지로 가는데 화면에는 같은 글자만 보인다.
 */
function bySido(items: PeerItem[]) {
  const map = new Map<string, PeerItem[]>()
  for (const i of items) {
    const arr = map.get(i.region_code)
    if (arr) arr.push(i)
    else map.set(i.region_code, [i])
  }
  const placeOf = (i: PeerItem) => `${i.region_code}/${sigunguOf(i.title, i.agency) ?? ''}`
  const perPlace = new Map<string, number>()
  for (const i of items) perPlace.set(placeOf(i), (perPlace.get(placeOf(i)) ?? 0) + 1)

  const groups = [...map.entries()]
    .map(([code, list]) => ({
      code,
      name: regionName(code),
      list: list
        .map((i) => ({
          slug: i.slug,
          label: sigunguOf(i.title, i.agency) ?? regionName(code),
          // 같은 지자체가 둘 이상일 때만 제목을 덧붙인다.
          detail: (perPlace.get(placeOf(i)) ?? 0) > 1 ? i.title : null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ko') || a.slug.localeCompare(b.slug, 'ko')),
    }))
    .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name, 'ko'))

  return { groups, placeCount: perPlace.size }
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const name = decodeURIComponent(key)
  const items = await getPeerGroup(name)
  if (!items) return {}
  const { groups, placeCount } = bySido(items)
  const top = groups.slice(0, 3).map((g) => `${g.name} ${g.list.length}`).join(' · ')
  return {
    title: `${name} 지자체 ${placeCount}곳 비교 (${kstYear()})`,
    description: `${name}${eulReul(name)} 운영하는 지자체 ${placeCount}곳. ${top}. 금액과 조건은 지자체마다 다릅니다.`,
    // absoluteUrl이 경로 조각마다 인코딩한다. 여기서 또 걸면 '%'가 '%25'가 되어
    // 모든 비교 페이지가 없는 주소를 canonical로 가리킨다(운영에 한 번 그렇게 나갔다).
    // 반대로 화면 링크(href)는 absoluteUrl을 안 거치므로 그쪽은 인코딩해서 넘겨야 한다.
    alternates: { canonical: absoluteUrl(`/compare/${name}`) },
    robots: { index: compareIndexable({ regionCount: groups.length }), follow: true },
  }
}

export default async function ComparePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const name = decodeURIComponent(key)
  const items = await getPeerGroup(name)
  if (!items) notFound()

  const { groups, placeCount } = bySido(items)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <JsonLd data={[breadcrumbs([{ name: '홈', path: '/' }, { name: name, path: `/compare/${name}` }])]} />

      <nav className="text-xs text-gray-500"><Link href="/">홈</Link></nav>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{name}</h1>
      <p className="mt-2 text-[15px] leading-7 text-gray-700">
        전국 {groups.length}개 시·도의 지자체 {placeCount}곳이 {name}{eulReul(name)} 운영합니다
        {placeCount !== items.length && `(등록된 지원사업 ${items.length}건)`}.
        이름은 같아도 금액·대상·신청 기간은 지자체마다 다르므로, 사는 곳의 페이지에서 확인하세요.
      </p>
      {/*
        금액을 여기에 모으지 않는다. 원천의 금액 칸은 총액·월액·분할이 한 열에 섞여 있고
        대상 설명까지 함께 들어 있어, 나란히 놓는 순간 서로 다른 것을 잰 값이 한 축에 선다.
        근거는 components/benefits/PeerList.tsx 주석에 있다.
      */}

      <div className="mt-8 space-y-6">
        {groups.map((g) => (
          <section key={g.code}>
            {/*
              여기는 '건'으로 센다. 아래 목록이 사업 한 건에 한 줄이라 이 숫자는 줄 수와 같다.
              '곳'을 쓰면 앞 문장의 "지자체 N곳"과 같은 낱말이 서로 다른 것을 세게 되고,
              한 지자체가 여러 건을 등록한 묶음에서 두 숫자가 어긋나 보인다 — 실측 66장 중
              3장(공영주차장 20↔29, 체육시설 22↔31, 상수도 25↔26)이 그랬다.
            */}
            <h2 className="mb-2 text-sm font-bold text-gray-500">
              {g.name} <span className="font-normal">{g.list.length}건</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.list.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={`/benefit/${i.slug}`}
                    className="block rounded-xl border border-gray-200 px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className="text-[15px] font-medium text-gray-900">{i.label}</span>
                    {i.detail && <span className="mt-0.5 block text-sm text-gray-600">{i.detail}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
