import { fill } from './copy'

function isWideCharacter(char: string): boolean {
  return /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/u.test(char)
}

export function textWidthEm(text: string): number {
  let width = 0
  for (const char of text) width += isWideCharacter(char) ? 1 : 0.6
  return width
}

export function fitFontRpx(text: string, maxWidthRpx: number, maxRpx: number, minRpx: number): number {
  if (text === '') return maxRpx
  const width = textWidthEm(text)
  const fitted = Math.floor(maxWidthRpx / width)
  return Math.min(maxRpx, Math.max(minRpx, fitted))
}

export function buildInviteText(inviteLine: string, name: string): string {
  return fill(inviteLine, { name })
}
