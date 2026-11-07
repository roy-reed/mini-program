export const PLAYER_MAX_WIDTH_PX = 480
export const PLAYER_MIN_HEIGHT_PX = 300
export const PLAYER_RESERVED_HEIGHT_PX = 220
export const PLAYER_HORIZONTAL_MARGIN_PX = 16
export const ENVELOPE_FRONT_HEIGHT_PX = 72

export interface PlayerLayout {
  playerWidthRpx: number
  playerHeightRpx: number
  envelopeFrontHeightRpx: number
}

export function layoutFor(windowWidthPx: number, windowHeightPx: number): PlayerLayout {
  if (
    !Number.isFinite(windowWidthPx) ||
    !Number.isFinite(windowHeightPx) ||
    windowWidthPx <= 0 ||
    windowHeightPx <= 0
  ) {
    throw new RangeError('windowWidthPx and windowHeightPx must be finite numbers greater than 0')
  }

  // Work in CSS pixels first. rpx scales with window width, not devicePixelRatio.
  // The 220px reserve includes the envelope flap and the page's surrounding UI.
  const availableWidthPx = Math.max(1, windowWidthPx - PLAYER_HORIZONTAL_MARGIN_PX * 2)
  const availableHeightPx = Math.max(PLAYER_MIN_HEIGHT_PX, windowHeightPx - PLAYER_RESERVED_HEIGHT_PX)
  const widthFromHeightPx = availableHeightPx * 3 / 4
  const playerWidthPx = Math.min(PLAYER_MAX_WIDTH_PX, availableWidthPx, widthFromHeightPx)

  // Convert the final CSS-pixel dimensions to rpx only at the rendering boundary.
  const playerWidthRpx = Math.max(1, Math.floor(playerWidthPx * 750 / windowWidthPx))
  const playerHeightRpx = Math.max(1, Math.round(playerWidthRpx * 4 / 3))
  const envelopeFrontHeightRpx = Math.max(1, Math.round(ENVELOPE_FRONT_HEIGHT_PX * 750 / windowWidthPx))

  return { playerWidthRpx, playerHeightRpx, envelopeFrontHeightRpx }
}
