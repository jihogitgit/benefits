import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'https://api.odcloud.kr/api/gov24/v3'
const key = process.env.GOV24_API_KEY
if (!key) { console.error('GOV24_API_KEY 누락'); process.exit(1) }

async function capture(op: 'serviceList' | 'supportConditions', perPage: number) {
  const url = new URL(`${BASE}/${op}`)
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', String(perPage))
  url.searchParams.set('returnType', 'JSON')
  url.searchParams.set('serviceKey', key!)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${op} ${res.status} ${await res.text()}`)
  const json = await res.json()
  mkdirSync('fixtures/gov24', { recursive: true })
  writeFileSync(`fixtures/gov24/${op}.sample.json`, JSON.stringify(json, null, 2))
  console.log(`${op}: totalCount=${json.totalCount}, saved ${json.data?.length} rows`)
  console.log(`${op} keys:`, Object.keys(json.data?.[0] ?? {}).join(', '))
}

async function main() {
  await capture('serviceList', 20)
  await capture('supportConditions', 20)
}

main().catch((e) => { console.error(e); process.exit(1) })
