/** 기존 행이 없거나 원천 수정일시가 달라졌으면 변경으로 본다. */
export function isChanged(existingUpdatedAt: string | null | undefined, incomingUpdatedAt: string | null): boolean {
  if (existingUpdatedAt === undefined) return true
  return (existingUpdatedAt ?? null) !== (incomingUpdatedAt ?? null)
}

export const DROP_THRESHOLD = 0.3

/** 직전 성공 대비 30% 이상 건수가 줄었거나 0건이면 잘못된 대량 변경으로 보고 중단. */
export function shouldAbortForDrop(lastFetched: number | null, fetched: number): boolean {
  if (fetched === 0) return true
  if (lastFetched === null) return false
  return fetched < lastFetched * (1 - DROP_THRESHOLD)
}
