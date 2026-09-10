import type { ReactNode } from 'react'
import AdSlot from '@/components/ads/AdSlot'

export type AdPlacementSlot = 'home' | 'list' | 'detail-1' | 'detail-2' | 'rail'

// NEXT_PUBLIC_* 는 정적 참조만 빌드 시 치환되므로 동적 인덱싱 대신 슬롯별로 나열한다.
const ADSENSE_SLOT: Record<AdPlacementSlot, string | undefined> = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
  list: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST,
  'detail-1': process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL_1,
  'detail-2': process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL_2,
  rail: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RAIL,
}

function AdFrame({ isRail, children }: { isRail: boolean; children: ReactNode }) {
  return (
    <div className="my-6" style={{ minHeight: isRail ? 600 : 100 }} aria-label="광고">
      <p className="mb-1 text-[10px] text-gray-400">광고</p>
      {children}
    </div>
  )
}

/** 광고 위치별 단일 진입점. 승인 전에는 애드핏, 승인 후 env로 애드센스 전환. 높이를 예약해 CLS를 막는다. */
export default function AdPlacement({ slot }: { slot: AdPlacementSlot }) {
  const isRail = slot === 'rail'
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  const adsenseSlot = ADSENSE_SLOT[slot]

  // 클라이언트·슬롯이 모두 있어야 애드센스를 태운다. 하나라도 없으면 빈 박스를 예약하지 않고 애드핏으로 폴백.
  if (adsenseClient && adsenseSlot) {
    return (
      <AdFrame isRail={isRail}>
        <AdSlot type="adsense" adClient={adsenseClient} adSlot={adsenseSlot} adFormat={isRail ? 'vertical' : 'auto'} />
      </AdFrame>
    )
  }

  const unit = isRail ? process.env.NEXT_PUBLIC_ADFIT_UNIT_PC : process.env.NEXT_PUBLIC_ADFIT_UNIT_MOBILE
  if (!unit) return null
  return (
    <AdFrame isRail={isRail}>
      <AdSlot type="adfit" adUnit={unit} adWidth={isRail ? 300 : 320} adHeight={isRail ? 600 : 100} />
    </AdFrame>
  )
}
