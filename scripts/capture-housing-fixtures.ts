import { writeFileSync, mkdirSync } from 'node:fs'
import { housingApiKey } from '../src/lib/api/applyhome'

/**
 * 청약홈·LH 샘플 응답을 fixtures/housing/에 저장한다. 두 API 모두 문서에 날짜 표기와 코드값이
 * 없어, 스키마·정규화는 이 파일을 보고 확정한다. 저장소에 커밋한다(개인정보 없음 — 공고 공개 정보).
 */
const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
const key = housingApiKey()

async function applyhome(op: string, cond: Record<string, string>) {
  const url = new URL(`https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/${op}`)
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', '5')
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', key)
  for (const [k, v] of Object.entries(cond)) url.searchParams.set(`cond[${k}]`, v)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${op} ${res.status} ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  if (!Array.isArray(json.data)) throw new Error(`${op}: data 배열이 없음(오류 응답?) ${JSON.stringify(json).slice(0, 200)}`)
  writeFileSync(`fixtures/housing/${op}.sample.json`, JSON.stringify(json, null, 2))
  console.log(`${op}: totalCount=${json.totalCount}, keys=${Object.keys(json.data?.[0] ?? {}).join(', ')}`)
  return json
}

async function lh(uppAisTpCd: string) {
  const url = new URL('https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1')
  url.searchParams.set('serviceKey', key)
  url.searchParams.set('PG_SZ', '5')
  url.searchParams.set('PAGE', '1')
  url.searchParams.set('UPP_AIS_TP_CD', uppAisTpCd)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`lh ${uppAisTpCd} ${res.status} ${(await res.text()).slice(0, 200)}`)
  const text = await res.text()
  writeFileSync(`fixtures/housing/lh-${uppAisTpCd}.sample.json`, text)
  console.log(`lh ${uppAisTpCd}: ${text.slice(0, 300)}`)
}

async function main() {
  mkdirSync('fixtures/housing', { recursive: true })
  const apt = await applyhome('getAPTLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': since })
  await applyhome('getUrbtyOfctlLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': since })
  const rem = await applyhome('getRemndrLttotPblancDetail', { 'RCRIT_PBLANC_DE::GTE': since })
  const first = apt.data?.[0]
  if (first) await applyhome('getAPTLttotPblancMdl', { 'HOUSE_MANAGE_NO::EQ': String(first.HOUSE_MANAGE_NO), 'PBLANC_NO::EQ': String(first.PBLANC_NO) })
  const firstRem = rem.data?.[0]
  if (firstRem) await applyhome('getRemndrLttotPblancMdl', { 'HOUSE_MANAGE_NO::EQ': String(firstRem.HOUSE_MANAGE_NO), 'PBLANC_NO::EQ': String(firstRem.PBLANC_NO) })
  let failed = false
  for (const cd of ['05', '06', '13', '39']) {
    try {
      await lh(cd)
    } catch (e) {
      failed = true
      console.error(`lh ${cd} 실패: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (failed) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
