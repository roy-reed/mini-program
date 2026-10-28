import { describe, expect, it } from 'vitest'
import { normalizeName, validateName } from '../miniprogram/core/name'

describe('name', () => {
  it('normalizes whitespace and middle dots', () => {
    expect(normalizeName('  小明  ')).toBe('小明')
    expect(normalizeName('阿依古丽•买买提')).toBe('阿依古丽·买买提')
    expect(normalizeName('Tom   Lee')).toBe('Tom Lee')
  })

  it.each([
    ['   ', 'EMPTY'],
    ['一二三四五六七八九十一', 'TOO_LONG'],
    ['小明🎸', 'BAD_CHAR'],
    ['小明!', 'BAD_CHAR'],
    ['共享和弦粉丝', 'RESERVED'],
    ['微信用户', 'RESERVED'],
  ] as const)('rejects %s as %s', (input, error) => {
    expect(validateName(input)).toEqual({ ok: false, error })
  })

  it('accepts valid names and counts Unicode code points', () => {
    expect(validateName('一二三四五六七八九十')).toEqual({ ok: true, name: '一二三四五六七八九十' })
    expect(validateName('阿依古丽•买买提')).toEqual({ ok: true, name: '阿依古丽·买买提' })
  })
})
