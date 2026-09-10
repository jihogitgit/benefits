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

export function regionHubDescription(regionName: string, segmentName: string, count: number): string {
  return `${regionName}에서 받을 수 있는 ${segmentName} 지원금 ${count.toLocaleString()}개(전국 공통 포함). 마감 임박 순으로 정리했습니다.`
}

/** 제목의 '2026'은 KST 기준이어야 한다. 서버가 UTC로 돌면 연말 9시간 동안 지난 해가 박힌다. */
export function kstYear(now: Date = new Date()): number {
  return new Date(now.getTime() + 9 * 3_600_000).getUTCFullYear()
}
