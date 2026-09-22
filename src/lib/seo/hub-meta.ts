/** 허브 페이지 메타 문자열. 페이지에서 분리해 순수 함수로 테스트한다. */

export function hubTitle(segmentName: string, year: number): string {
  return `${year} ${segmentName} 지원금 총정리 · 조건별 조회`
}

export function hubDescription(segmentName: string, count: number): string {
  return `${segmentName} 지원금 ${count.toLocaleString()}개를 나이·지역 조건으로 걸러 확인하세요. 마감 임박 순 정렬, 신청 방법과 자격을 쉬운 말로 정리했습니다.`
}

export function regionHubTitle(regionName: string, segmentName: string, year: number): string {
  return `${year} ${regionName} ${segmentName} 지원금 · 조건별 조회`
}

export interface RegionHubDescriptionInput {
  regionName: string
  segmentName: string
  /** 그 지역에만 있는 건수. 전국 공통을 더하지 않는다 — 아래 주석 참고. */
  localCount: number
  nationalCount: number
}

/**
 * 지역 허브의 검색 스니펫.
 *
 * 전에는 "OO에서 받을 수 있는 OO 지원금 N개(전국 공통 포함). 마감 임박 순으로 정리했습니다."
 * 한 틀이었다. 색인되는 46장이 지역명과 숫자 하나만 다른 같은 문장을 갖고 있었고, 그 숫자마저
 * 전국 공통을 더한 값이라 서로 더 비슷해졌다(청년 185·출산육아 448·소상공인 476건이 모든
 * 지역에 똑같이 깔린다). 읽는 사람은 어느 지역 페이지를 열어도 같은 설명을 본다.
 *
 * 그래서 앞자리를 **그 지역에만 있는 건수**로 바꿨다. 색인 판정(regionHubIndexable)이 이미
 * 지역 전용 건수만 보고 있으므로 스니펫도 같은 것을 앞세운다.
 *
 * 사업 이름 두어 개를 넣어 봤다가 되돌렸다. 목록은 마감 임박 순이라 앞에 오는 것이 그 지역
 * ·분야를 대표하지 않고, 세그먼트 분류가 틀린 행이 그대로 올라온다 — 제주 소상공인 스니펫에
 * "4.3생존희생자·유족·며느리 진료비 지원"이, 서울 출산·육아에 "취약계층 인플루엔자 백신 및
 * 접종 지원"이 들어갔다. 분류 오류는 목록에서는 한 줄이지만 스니펫에서는 그 페이지의 얼굴이
 * 된다. 분류가 믿을 만해지면 다시 넣을 값이 있다.
 *
 * 한글 스니펫은 대략 80자 근처에서 잘린다. 구별되는 정보가 전부 앞 30자 안에 온다.
 */
export function regionHubDescription(p: RegionHubDescriptionInput): string {
  const national = p.nationalCount.toLocaleString()
  if (p.localCount === 0) {
    // 본문 emptyText와 같은 사실을 말한다. "0개"로 시작하면 클릭할 이유가 없어지므로
    // 이 페이지에 실제로 있는 것(전국 공통)을 알린다.
    return `${p.regionName} 지자체가 따로 운영하는 ${p.segmentName} 지원금은 아직 없습니다. 전국 어디서나 받을 수 있는 ${national}개를 마감 임박 순으로 정리했습니다.`
  }
  return `${p.regionName} 지자체가 직접 운영하는 ${p.segmentName} 지원금 ${p.localCount.toLocaleString()}개. 전국 공통 ${national}개까지 마감 임박 순으로 함께 정리했습니다.`
}

/** 제목의 '2026'은 KST 기준이어야 한다. 서버가 UTC로 돌면 연말 9시간 동안 지난 해가 박힌다. */
export function kstYear(now: Date = new Date()): number {
  return new Date(now.getTime() + 9 * 3_600_000).getUTCFullYear()
}
