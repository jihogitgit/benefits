import type { Segment } from '@/types/database'

/**
 * 규칙(rules.ts)이 놓친 세그먼트를 사업 단위로 더한다. 키는 보조금24 서비스ID다.
 *
 * 규칙을 고치지 않고 표로 두는 이유: 놓친 원인이 낱말이 아니라 원천 문장에 대상층이 아예
 * 적혀 있지 않은 것이라서다. 주거급여 원문은 "중위소득 48% 이내의 가구"뿐이고 청년 분리지급은
 * 운영기관 안내에만 있다. 이런 행을 잡으려고 낱말을 넓히면 rules.ts가 막아 둔 오탐이 돌아온다.
 *
 * DB만 고치면 안 되는 이유: 동기화는 원천이 바뀐 행의 segments를 다시 계산하고
 * (normalize.ts), backfill-segments는 전 건을 다시 계산한다. 둘 다 이 표를 거친다.
 *
 * 더하기만 한다. 규칙이 준 세그먼트를 빼지 않는다. 공개 세그먼트가 하나라도 생기면 'other'는 뗀다
 * — 'other'가 남으면 상세 페이지의 대표 세그먼트(segments[0])가 기타로 잡힌다.
 *
 * 항목마다 근거 문서를 적는다. 근거 없이 넣으면 허브 목록에 대상이 아닌 사업이 섞인다.
 */
export const SEGMENT_ADDITIONS: Record<string, { add: Segment[]; slug: string; why: string }> = {
  '999000000025': {
    slug: '주거안정-월세대출',
    add: ['youth'],
    why: '주택도시기금 대출안내(nhuf.molit.go.kr FP05020201) 첫 문장이 "월세 부담으로 고민인 청년들에게 청년전용 주거안정 월세자금을 대출해 드립니다."이고 우대형 취업준비생·사회초년생이 만 35세 이하다. 정부24 원문에는 청년이라는 말이 없다.',
  },
  '134200005001': {
    slug: '고졸-후학습자-장학금-희망사다리Ⅱ유형',
    add: ['youth'],
    why: '한국장학재단 선발배점표가 34세 이하를 청년으로 보아 최고점(30점)을 주고 35~39세 군필자도 청년으로 인정한다. 점수순 선발이라 사실상 청년 재직자가 대상이다. 정부24 원문은 고졸 재직자라고만 적는다.',
  },
  // 주거급여(336000000096)는 넣지 않았다. 청년 경로가 수급가구 20대 자녀 분리지급 하나뿐이라
  // 저소득 가구 일반 제도를 청년 허브에 싣게 된다(2026-09-28 판단).
}

export function applySegmentOverrides(sourceId: string | null | undefined, segments: Segment[]): Segment[] {
  const o = sourceId ? SEGMENT_ADDITIONS[sourceId] : undefined
  if (!o) return segments
  const out: Segment[] = segments.filter((s) => s !== 'other')
  for (const s of o.add) if (!out.includes(s)) out.push(s)
  return out.length ? out : ['other']
}
