import { formatKstDate } from '@/lib/benefits/format'

export default function SourceFooter({ agency, syncedAt, sourceUpdatedAt, applyUrl }: { agency: string | null; syncedAt: string; sourceUpdatedAt: string | null; applyUrl: string | null }) {
  const stale = Date.now() - new Date(syncedAt).getTime() > 24 * 3_600_000
  return (
    <footer className="mt-8 rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
      <p>출처: 행정안전부 보조금24{agency ? ` · ${agency}` : ''}{sourceUpdatedAt ? ` · 원문 수정 ${formatKstDate(sourceUpdatedAt)}` : ''}</p>
      <p className={stale ? 'mt-1 text-gray-400' : 'mt-1'}>최종 확인 {formatKstDate(syncedAt)}{stale ? ' · 24시간 이상 지난 정보입니다. 공식 페이지에서 확인하세요.' : ''}</p>
      {applyUrl && <p className="mt-1"><a href={applyUrl} target="_blank" rel="noopener noreferrer" className="underline">정부24 원문 보기</a></p>}
    </footer>
  )
}
