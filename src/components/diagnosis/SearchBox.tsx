'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { normalizeQuery } from '@/lib/benefits/query-text'
import { cn } from '@/lib/utils'

/** 입력이 멎고 이만큼 지나면 조건에 반영한다. 매 글자마다 올리면 키 입력 수만큼 요청이 나간다. */
const DEBOUNCE_MS = 300

interface Props {
  /** 현재 확정된 검색어(정규화된 값). 부모가 소유한다. */
  value: string
  /** 정규화된 검색어를 올려준다. 값이 실제로 바뀔 때만 호출된다. */
  onChange: (q: string) => void
  label: string
  placeholder: string
  className?: string
}

export default function SearchBox({ value, onChange, label, placeholder, className }: Props) {
  // 인스턴스마다 다른 id. 라벨-입력칸 연결이 한 화면에 두 개가 놓여도 모호해지지 않는다.
  const id = useId()
  const [draft, setDraft] = useState(value)
  // 마지막으로 주고받은 확정값. 입력칸과 부모 상태 사이의 되먹임을 끊는 기준점이다.
  const settled = useRef(value)
  // 부모가 onChange를 매 렌더 새로 만들어도 디바운스 타이머가 계속 초기화되지 않게 ref로 잡아둔다.
  const cb = useRef(onChange)
  useEffect(() => {
    cb.current = onChange
  })

  // 바깥에서 값이 바뀐 경우(localStorage 복원 등)만 입력칸에 반영한다.
  // 우리가 올려보낸 값이 되돌아온 것까지 반영하면 입력 도중 커서가 튄다.
  useEffect(() => {
    if (value !== settled.current) {
      settled.current = value
      setDraft(value)
    }
  }, [value])

  const commit = useCallback((raw: string) => {
    const n = normalizeQuery(raw)
    if (n === settled.current) return
    settled.current = n
    cb.current(n)
  }, [])

  useEffect(() => {
    if (normalizeQuery(draft) === settled.current) return
    const t = setTimeout(() => commit(draft), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [draft, commit])

  // 입력칸을 벗어나면 디바운스를 기다리지 않고 바로 확정한다.
  // 검색어를 치자마자 '내 지원금 보기' 링크를 누르면 blur가 클릭보다 먼저 일어나는데,
  // 이때 확정하지 않으면 대기 중인 타이머가 언마운트 정리로 버려져 방금 친 검색어가
  // 통째로 유실되고 이전 검색어로 결과 화면이 열린다.
  const flush = () => commit(draft)

  // 기호·이모지만 입력하면 정규화 결과가 비어 검색이 돌지 않는다. 입력칸에는 글자가 보이는데
  // 화면은 아무 반응이 없어 고장으로 보이므로 이유를 알려준다.
  const unusable = draft.trim().length > 0 && normalizeQuery(draft) === ''

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold text-gray-500">
        {label}
      </label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
          {/* 돋보기 */}
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5 17 17" strokeLinecap="round" />
          </svg>
        </span>
        <input
          id={id}
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={flush}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              flush()
            }
          }}
          placeholder={placeholder}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="search"
          aria-describedby={unusable ? `${id}-hint` : undefined}
          className={cn(
            'min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 text-sm text-gray-900 outline-none',
            'placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200',
            draft ? 'pr-10' : 'pr-3.5',
          )}
        />
        {draft && (
          // type=search의 기본 지우기 버튼은 브라우저마다 있거나 없다. 직접 둬서 동작을 통일한다.
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => {
              setDraft('')
              commit('')
            }}
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2 12 12M12 2 2 12" />
            </svg>
          </button>
        )}
      </div>
      {unusable && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-amber-600">
          검색에 쓸 수 있는 글자가 없습니다. 지원금 이름을 글자나 숫자로 입력해 주세요.
        </p>
      )}
    </div>
  )
}
