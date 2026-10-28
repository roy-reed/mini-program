export const PLAYER_MAX_W_RPX = 600
export const PLAYER_MIN_H_RPX = 480
export const RESERVED_H_RPX = 420

export interface PlayerLayout {
  playerWidthRpx: number
  playerHeightRpx: number
}

export function layoutFor(windowWidthPx: number, windowHeightPx: number): PlayerLayout {
  if (windowWidthPx <= 0 || windowHeightPx <= 0) {
    throw new RangeError('windowWidthPx and windowHeightPx must be greater than 0')
  }
  const heightRpx = windowHeightPx * 750 / windowWidthPx
  let widthRpx = Math.floor(Math.min(PLAYER_MAX_W_RPX, (heightRpx - RESERVED_H_RPX) * 3 / 4))
  if (widthRpx * 4 / 3 < PLAYER_MIN_H_RPX) widthRpx = 360
  return {
    playerWidthRpx: widthRpx,
    playerHeightRpx: Math.round(widthRpx * 4 / 3),
  }
}
