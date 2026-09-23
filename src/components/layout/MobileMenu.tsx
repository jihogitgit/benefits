'use client'
import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from './nav-links'

/**
 * 좁은 화면 전용 메뉴. 헤더 가로줄에는 여섯 곳이 들어가지 않는다 — 390px에서 로고를 빼면
 * 292px가 남는데 링크만 350px가 필요하다. 예전에는 넘치는 두 개(/guide·/deadline)에
 * `hidden sm:inline`을 걸어 감췄고, 대체 경로가 없어 모바일에서는 그 두 곳에 갈 길이
 * 아예 없었다. 감추는 대신 여기로 모은다.
 */
export default function MobileMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelId = useId()

  // 같은 화면으로 이동해도 목록은 닫는다. 레이아웃은 이동 간에 살아남으므로
  // 열린 상태를 그대로 두면 새 페이지 위에 메뉴가 덮인 채로 남는다.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-gray-700 transition hover:text-brand-700 active:scale-[0.98]"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <><path d="M5 5l10 10" /><path d="M15 5L5 15" /></> : <><path d="M3 6h14" /><path d="M3 10h14" /><path d="M3 14h14" /></>}
        </svg>
        메뉴
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫힌다. 헤더 아래 전체를 덮되 배경은 어둡게 하지 않는다 —
              목록이 짧아 화면을 가릴 이유가 없다. */}
          <div className="fixed inset-x-0 bottom-0 top-14 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav
            id={panelId}
            aria-label="전체 메뉴"
            className="absolute inset-x-0 top-14 z-40 border-b border-gray-200 bg-white shadow-sm"
          >
            <ul className="mx-auto max-w-6xl px-4 py-2">
              {NAV_LINKS.map((l) => {
                const active = pathname === l.href || pathname.startsWith(l.href + '/')
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-12 items-center rounded-lg px-2 text-base transition ${
                        active ? 'font-bold text-brand-700' : 'text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {l.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </>
      )}
    </div>
  )
}
