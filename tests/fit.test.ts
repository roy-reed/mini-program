import { describe, expect, it } from 'vitest'
import { buildInviteText, fitFontRpx, textWidthEm } from '../miniprogram/core/fit'

describe('fit', () => {
  it('counts wide and narrow characters', () => {
    expect(textWidthEm('诚邀 小明 收听')).toBeCloseTo(7.2)
    expect(textWidthEm('ＡA')).toBeCloseTo(1.6)
  })

  it('fits text between configured bounds', () => {
    expect(fitFontRpx('诚邀 小明 收听', 520, 44, 28)).toBe(44)
    expect(fitFontRpx('诚邀 一二三四五六七八九十 收听', 520, 44, 28)).toBe(34)
    expect(fitFontRpx('一'.repeat(100), 520, 44, 28)).toBe(28)
    expect(fitFontRpx('', 520, 44, 28)).toBe(44)
  })

  it('builds invite text through the shared template helper', () => {
    expect(buildInviteText('诚邀 {name} 收听', '小明')).toBe('诚邀 小明 收听')
  })
})
