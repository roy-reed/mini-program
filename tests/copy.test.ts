import { describe, expect, it } from 'vitest'
import { COPY, fill, t } from '../miniprogram/core/copy'

describe('copy', () => {
  it('resolves keys and variables', () => {
    expect(t('draw.title')).toBe('请抽取您的专属邀请函')
    expect(fill('致 {name}，共 {count} 首', { name: '小明', count: 2 })).toBe('致 小明，共 2 首')
  })

  it('rejects missing variables and unknown keys', () => {
    expect(() => fill('致 {name}')).toThrow(/missing variable/)
    expect(() => t('draw.unknown' as never)).toThrow()
  })

  it('contains only non-empty strings', () => {
    const values = Object.values(COPY).flatMap((group) => Object.values(group))
    expect(values.every((value) => typeof value === 'string' && value.length > 0)).toBe(true)
  })
})
