import { formatKstDate, formatKstDay } from '@/lib/benefits/format'
import { CURATED_SOURCE, CURATED_STALE_DAYS } from '../../../data/curated-benefits'

export interface Evidence {
  label: string
  url: string
}

const DAY = 86_400_000

/**
 * 이 푸터는 한동안 모든 상세에 "출처: 행정안전부 보조금24"를 찍었다. 그때는 모든 행이
 * 보조금24에서 왔으니 맞는 말이었다. 부모급여처럼 원천에 없어 손으로 채운 행이 생긴 뒤로는
 * 그 문장이 거짓이 되므로 source로 갈라 쓴다.
 *
 * 낡음 기준도 같이 갈라진다. 보조금24 행은 매일 동기화되니 24시간이면 이상 신호지만,
 * 손으로 채운 행은 사람이 근거 문서를 다시 읽을 때만 날짜가 움직인다. 같은 24시간을 적용하면
 * 발행 다음 날부터 영원히 경고가 켜져 경고 자체가 무의미해진다.
 */
export default function SourceFooter({
  source,
  agency,
  syncedAt,
  sourceUpdatedAt,
  applyUrl,
  evidence = [],
}: {
  source: string
  agency: string | null
  syncedAt: string
  sourceUpdatedAt: string | null
  applyUrl: string | null
  evidence?: Evidence[]
}) {
  const curated = source === CURATED_SOURCE
  const stale = Date.now() - new Date(syncedAt).getTime() > (curated ? CURATED_STALE_DAYS : 1) * DAY

  return (
    <footer className="mt-8 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
      {curated ? (
        <p>
          출처: {agency ?? '소관 부처'} 공개 자료를 사람이 직접 옮겼습니다. 보조금24 오픈API에는 이 제도가 없습니다.
          {sourceUpdatedAt ? ` · 근거 문서 수정 ${formatKstDay(sourceUpdatedAt)}` : ''}
        </p>
      ) : (
        <p>
          출처: 행정안전부 보조금24{agency ? ` · ${agency}` : ''}
          {sourceUpdatedAt ? ` · 원문 수정 ${formatKstDate(sourceUpdatedAt)}` : ''}
        </p>
      )}

      <p className={stale ? 'mt-1 text-gray-400' : 'mt-1'}>
        {curated ? '근거 문서와 마지막 대조' : '최종 확인'} {curated ? formatKstDay(syncedAt) : formatKstDate(syncedAt)}
        {stale
          ? curated
            ? ` · ${CURATED_STALE_DAYS}일 넘게 대조하지 않았습니다. 공식 페이지에서 확인하세요.`
            : ' · 24시간 이상 지난 정보입니다. 공식 페이지에서 확인하세요.'
          : ''}
      </p>

      {curated ? (
        evidence.map((e) => (
          <p key={e.url} className="mt-1">
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline">
              {e.label}
            </a>
          </p>
        ))
      ) : (
        applyUrl && (
          <p className="mt-1">
            <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="underline">
              정부24 원문 보기
            </a>
          </p>
        )
      )}
    </footer>
  )
}
