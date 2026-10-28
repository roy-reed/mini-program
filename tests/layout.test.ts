import { describe, expect, it } from 'vitest'
import { layoutFor } from '../miniprogram/core/layout'

describe('layout', () => {
  it.each([
    [390, 844, 600, 800],
    [320, 568, 600, 800],
    [768, 1024, 435, 580],
    [1024, 768, 360, 480],
  ])('%i × %i px becomes %i × %i rpx', (width, height, playerWidthRpx, playerHeightRpx) => {
    expect(layoutFor(width, height)).toEqual({ playerWidthRpx, playerHeightRpx })
  })

  it.each([
    [0, 844],
    [390, 0],
    [-1, 844],
    [390, -1],
  ])('rejects non-positive window dimensions', (width, height) => {
    expect(() => layoutFor(width, height)).toThrow(RangeError)
  })
})
