'use client'
import { useEffect, useRef } from 'react'

interface Props {
  type: 'adsense' | 'adfit'
  adClient?: string
  adSlot?: string
  adFormat?: string
  adUnit?: string
  adWidth?: number
  adHeight?: number
  className?: string
}

function AdsenseSlot({ adClient, adSlot, adFormat }: {
  adClient: string
  adSlot: string
  adFormat: string
}) {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;((window as any).adsbygoogle = (window as any).adsbygoogle ?? []).push({})
    } catch {
      // AdSense 초기화 실패 무시
    }
  }, [])

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={adClient}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive="true"
    />
  )
}

function AdFitSlot({ adUnit, adWidth, adHeight }: {
  adUnit: string
  adWidth: number
  adHeight: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || !containerRef.current) return
    initialized.current = true

    const ins = document.createElement('ins')
    ins.className = 'kakao_ad_area'
    ins.setAttribute('data-ad-unit', adUnit)
    ins.setAttribute('data-ad-width', String(adWidth))
    ins.setAttribute('data-ad-height', String(adHeight))
    containerRef.current.appendChild(ins)

    const script = document.createElement('script')
    script.async = true
    script.type = 'text/javascript'
    script.src = '//t1.daumcdn.net/kas/static/ba.min.js'
    containerRef.current.appendChild(script)
  }, [adUnit, adWidth, adHeight])

  return <div ref={containerRef} />
}

export default function AdSlot({
  type,
  adClient = '',
  adSlot = '',
  adFormat = 'auto',
  adUnit = '',
  adWidth = 320,
  adHeight = 100,
  className = '',
}: Props) {
  if (process.env.NODE_ENV === 'development') {
    return (
      <div
        className={`bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 ${className}`}
        style={{ minHeight: adHeight || 90 }}
      >
        광고 영역 ({type})
      </div>
    )
  }

  return (
    <div className={className}>
      {type === 'adsense' && adClient && adSlot ? (
        <AdsenseSlot adClient={adClient} adSlot={adSlot} adFormat={adFormat} />
      ) : type === 'adfit' && adUnit ? (
        <AdFitSlot adUnit={adUnit} adWidth={adWidth} adHeight={adHeight} />
      ) : null}
    </div>
  )
}
