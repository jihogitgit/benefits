/**
 * 요약 칸·목록 카드·메타 설명·JSON-LD에 나가는 한 줄을 사업 단위로 바꾼다. 키는 슬러그다.
 *
 * 정부24 원문 필드를 그대로 보여 주면 해설을 발행한 페이지에서 한 화면에 두 숫자가 나온다.
 * 주거안정 월세대출은 summary가 "연 960만원 한도"인데 본문이 "현재 1,440만원"이라고 바로잡는다.
 * 대상 칸은 target_text 첫 줄이라 "근로자 유형", "I유형", "지원 요건" 같은 머리말이 찍힌다.
 *
 * DB가 아니라 코드에 두는 이유는 segments/overrides.ts와 같다 — 동기화가 원천이 바뀐 행의
 * summary·target_text를 덮어쓰므로 DB를 고쳐도 되돌아간다.
 *
 * 문구는 발행된 해설(explainer_md 첫 문단·checklist_json)에서만 가져온다. 해설은 운영기관
 * 자료와 대조를 마친 글이라, 여기서 새 숫자를 만들면 검증되지 않은 값이 가장 눈에 띄는 자리에
 * 나간다. 해설을 고치면 여기도 같이 본다.
 *
 * 해설이 없는 사업은 넣지 않는다. 그 페이지는 원문 안내가 본문이라 요약만 바꾸면 요약과 본문이
 * 어긋난다.
 */
export const DISPLAY_OVERRIDES: Record<string, { summary?: string; target?: string }> = {
  '두루누리-사회보험료-지원': {
    // 원문 summary "사회보험 사각지대를 해소"는 무엇을 주는지 말하지 않는다
    summary: '10명 미만 사업장의 고용보험·국민연금 보험료 80% 지원',
    target: '10명 미만 사업장, 월평균보수 270만원 미만 신규가입 근로자와 사업주',
  },
  '기존주택-전세임대주택-지원사업': {
    target: '무주택세대구성원 (일반·청년·신혼부부 등 유형별 소득·자산 기준)',
  },
  '기존주택-매입임대주택-지원사업': {
    target: '무주택세대구성원 (일반·청년·신혼부부 유형별 소득·자산 기준)',
  },
  '국민취업지원제도': {
    target: '만 15~69세 구직자 (I유형은 중위소득 60% 이하·재산 4억원 이하)',
  },
  '육아휴직급여': {
    target: '만 8세 이하(초2 이하) 자녀를 둔 근로자, 고용보험 180일 이상',
  },
  '일상돌봄-서비스': {
    target: '돌봄이 필요한 13~64세 청·중장년, 39세 이하 가족돌봄청년',
  },
  '주거안정-월세대출': {
    // 원문 summary의 960만원은 옛 한도다(해설 첫 절 참고)
    summary: '월세를 월 최대 60만원씩 2년, 최대 1,440만원 대출 (연 1.3~1.8%)',
    target: '무주택 세대주, 부부합산 연소득 5천만원 이하 또는 우대형(취업준비생·사회초년생 등)',
  },
  '고졸-후학습자-장학금-희망사다리Ⅱ유형': {
    // 원문 summary는 "등록금 전액"만 적어 대기업·비영리 재직자 50%와 중소·중견 1년 요건이 빠졌다
    summary: '고졸 재직자의 대학 등록금 학기마다 지원 (중소·중견 전액, 대기업·비영리 50%)',
    target: '고졸 후 재직 2년 이상(중소·중견기업 1년 이상)인 대학생',
  },
  '녹색기업지원-특례보증': {
    summary: '녹색·ESG 실천 중소기업·소상공인의 대출에 기업당 2억원 이내 보증',
  },
  '청소년-미혼-한부모-자립지원-우리원더패밀리': {
    summary: '24세 이하 미혼 한부모(임신부 포함)에게 생활비 월 50만원 (연 600만원)',
  },
  '주거급여-맞춤형-급여': {
    summary: '중위소득 48% 이하 가구에 임차료(현금) 또는 자가 집수리 지원',
  },
}

/** summary·target_text를 보정한 사본. 보정이 없으면 받은 객체를 그대로 돌려준다. */
export function withDisplayOverrides<T extends { slug: string; summary: string | null; target_text?: string | null }>(row: T): T {
  const o = DISPLAY_OVERRIDES[row.slug]
  if (!o) return row
  return {
    ...row,
    summary: o.summary ?? row.summary,
    ...(o.target !== undefined && 'target_text' in row ? { target_text: o.target } : {}),
  }
}

export function hasSummaryOverride(slug: string): boolean {
  return DISPLAY_OVERRIDES[slug]?.summary !== undefined
}
