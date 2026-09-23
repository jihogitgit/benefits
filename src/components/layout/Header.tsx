import Link from 'next/link'
import { siteName } from '@/lib/seo/site'
import LogoMark from '@/components/brand/Logo'
import MobileMenu from './MobileMenu'
import { NAV_LINKS_SHORT } from './nav-links'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-lg text-lg font-bold text-brand-700 transition hover:text-brand-800"
        >
          <LogoMark className="h-6 w-6 shrink-0" />
          {siteName()}
        </Link>

        <div className="flex items-center gap-1 sm:gap-5">
          {/* 가로줄은 sm 이상에서만. 좁은 화면에서는 같은 목록이 MobileMenu 안에 있다. */}
          <nav aria-label="주요 메뉴" className="hidden items-center gap-5 text-sm font-medium sm:flex">
            {NAV_LINKS_SHORT.map((l) => (
              <Link key={l.href} href={l.href} className="text-gray-700 transition hover:text-brand-700">
                {l.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/my"
            className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            내 진단
          </Link>

          <MobileMenu />
        </div>
      </div>
    </header>
  )
}
