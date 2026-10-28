import { type CopyKey } from './copy'

export const NAME_MAX = 10
export const RESERVED_WORDS: readonly string[] = ['共享和弦', '官方', '客服', '管理员', '微信', '腾讯']

export type NameError = 'EMPTY' | 'TOO_LONG' | 'BAD_CHAR' | 'RESERVED'
export type NameResult = { ok: true; name: string } | { ok: false; error: NameError }

export const NAME_ERROR_KEYS: Record<NameError, CopyKey> = {
  EMPTY: 'name.errEmpty',
  TOO_LONG: 'name.errTooLong',
  BAD_CHAR: 'name.errBadChar',
  RESERVED: 'name.errReserved',
}

export function normalizeName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[•・‧]/gu, '·')
    .trim()
    .replace(/\s+/gu, ' ')
}

export function validateName(raw: string): NameResult {
  const name = normalizeName(raw)
  if (name.length === 0) return { ok: false, error: 'EMPTY' }
  if (Array.from(name).length > NAME_MAX) return { ok: false, error: 'TOO_LONG' }
  if (!/^[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFFA-Za-z0-9 ·]+$/u.test(name)) {
    return { ok: false, error: 'BAD_CHAR' }
  }
  const lowerName = name.toLocaleLowerCase()
  if (RESERVED_WORDS.some((word) => lowerName.includes(word.toLocaleLowerCase()))) {
    return { ok: false, error: 'RESERVED' }
  }
  return { ok: true, name }
}
