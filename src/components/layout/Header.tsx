import Link from 'next/link'
import { PUBLIC_SEGMENTS } from '../../../data/segments'
import { siteName } from '@/lib/seo/site'
import LogoMark from '@/components/brand/Logo'

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5 text-lg font-bold text-brand-700">
          <LogoMark className="h-6 w-6 shrink-0" />
          {siteName()}
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium sm:gap-5">
          {PUBLIC_SEGMENTS.map((s) => (
            <Link key={s.slug} href={`/${s.path}`} className="text-gray-700 hover:text-brand-700">
              {s.name}
            </Link>
          ))}
          <Link href="/guide" className="hidden text-gray-700 hover:text-brand-700 sm:inline">
            가이드
          </Link>
          <Link href="/deadline" className="hidden text-gray-700 hover:text-brand-700 sm:inline">
            마감 임박
          </Link>
          <Link href="/my" className="rounded-full bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700">
            내 진단
          </Link>
        </nav>
      </div>
    </header>
  )
}
