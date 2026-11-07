import { describe, expect, it } from 'vitest'
import {
  ENVELOPE_FRONT_HEIGHT_PX,
  PLAYER_HORIZONTAL_MARGIN_PX,
  PLAYER_MAX_WIDTH_PX,
  PLAYER_MIN_HEIGHT_PX,
  PLAYER_RESERVED_HEIGHT_PX,
  layoutFor,
} from '../miniprogram/core/layout'

const deviceViewports = [
  ['iPhone 12/13 mini', 375, 812],
  ['iPhone 12/13 Pro', 390, 844],
  ['iPhone 12/13 Pro Max', 428, 926],
  ['iPhone 14/15 Pro Max', 430, 932],
  ['iPhone 16', 393, 852],
  ['iPhone 17', 402, 874],
  ['Pixel 9', 412, 923],
  ['Pixel 9 Pro', 410, 914],
  ['Windows', 480, 800],
  ['Mac 13-inch and below', 375, 667],
  ['Mac 15-inch', 375, 736],
  ['Mac 21-inch and above', 414, 896],
  ['iPad mini 6/7', 744, 1133],
  ['iPad 10th/Air 11', 820, 1180],
  ['iPad Pro 11', 834, 1210],
  ['iPad Pro 13', 1032, 1376],
  ['HUAWEI Mate 80', 366, 809],
  ['HUAWEI Mate 70 Pro', 376, 809],
  ['HUAWEI Pura 80 Pro', 365, 814],
  ['HUAWEI nova 13', 361, 804],
  ['HUAWEI nova 14 Ultra', 363, 817],
  ['HUAWEI Pocket 2', 364, 861],
  ['HUAWEI Pura X inner', 440, 907],
  ['HUAWEI Pura X outer', 327, 327],
  ['HUAWEI Pura X Max inner', 940, 665],
  ['HUAWEI Pura X Max outer', 460, 672],
  ['HUAWEI Mate X6 inner', 717, 781],
  ['HUAWEI Mate X6 outer', 346, 781],
] as const

describe('responsive invitation player layout', () => {
  it.each(deviceViewports)('%s keeps a positive, 3:4 player inside the horizontal viewport', (_name, width, height) => {
    const layout = layoutFor(width, height)
    const scale = width / 750
    const playerWidthPx = layout.playerWidthRpx * scale
    const playerHeightPx = layout.playerHeightRpx * scale
    const flapHeightPx = layout.envelopeFrontHeightRpx * scale

    expect(layout.playerWidthRpx).toBeGreaterThan(0)
    expect(layout.playerHeightRpx).toBeGreaterThan(0)
    expect(layout.envelopeFrontHeightRpx).toBeGreaterThan(0)
    expect(playerWidthPx).toBeLessThanOrEqual(Math.max(1, width - PLAYER_HORIZONTAL_MARGIN_PX * 2) + 1)
    expect(playerWidthPx).toBeLessThanOrEqual(PLAYER_MAX_WIDTH_PX + 1)
    expect(playerHeightPx / playerWidthPx).toBeCloseTo(4 / 3, 2)
    expect(flapHeightPx).toBeGreaterThan(ENVELOPE_FRONT_HEIGHT_PX - 2)
    expect(flapHeightPx).toBeLessThan(ENVELOPE_FRONT_HEIGHT_PX + 2)

    // Short viewports may scroll, but the player itself must never collapse below its 300px readable minimum.
    expect(playerHeightPx).toBeGreaterThanOrEqual(PLAYER_MIN_HEIGHT_PX - 1)
    if (height >= PLAYER_RESERVED_HEIGHT_PX + PLAYER_MIN_HEIGHT_PX) {
      expect(playerHeightPx).toBeLessThanOrEqual(height - PLAYER_RESERVED_HEIGHT_PX + 1)
    }
  })

  it.each([
    [0, 844],
    [390, 0],
    [-1, 844],
    [390, -1],
    [Number.NaN, 844],
    [390, Number.POSITIVE_INFINITY],
  ])('rejects invalid window dimensions %i × %i', (width, height) => {
    expect(() => layoutFor(width, height)).toThrow(RangeError)
  })

  it('keeps a complete minimum player on an extremely short custom viewport and lets the page scroll', () => {
    const layout = layoutFor(327, 320)
    const playerHeightPx = layout.playerHeightRpx * 327 / 750
    expect(playerHeightPx).toBeGreaterThanOrEqual(PLAYER_MIN_HEIGHT_PX - 1)
    expect(playerHeightPx + ENVELOPE_FRONT_HEIGHT_PX).toBeGreaterThan(320 - PLAYER_RESERVED_HEIGHT_PX)
  })
})
