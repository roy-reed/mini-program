import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ForbiddenHit {
  line: number
  word: string
  text: string
}

export interface HardcodedCjkHit {
  line: number
  text: string
}

export function parseWords(text: string): string[] {
  const words: string[] = []
  const seen = new Set<string>()
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const key = line.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    words.push(line)
  }
  return words
}

export function findForbidden(text: string, words: readonly string[]): ForbiddenHit[] {
  const hits: ForbiddenHit[] = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const lowerLine = line.toLocaleLowerCase()
    for (const word of words) {
      if (word !== '' && lowerLine.includes(word.toLocaleLowerCase())) {
        hits.push({ line: index + 1, word, text: line })
      }
    }
  }
  return hits
}

function blankComment(source: string, start: number, end: number): string {
  let result = ''
  for (let index = start; index < end; index += 1) {
    const char = source[index]
    result += char === '\n' || char === '\r' ? char : ' '
  }
  return result
}

function stripComments(source: string, kind: 'ts' | 'wxml'): string {
  let result = ''
  let state: 'code' | 'single' | 'double' | 'template' = 'code'
  let index = 0

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (state === 'code') {
      const isLineComment = kind === 'ts' && char === '/' && next === '/'
      const isBlockComment = kind === 'ts' && char === '/' && next === '*'
      const isXmlComment = kind === 'wxml' && source.startsWith('<!--', index)
      if (isLineComment) {
        const end = source.indexOf('\n', index + 2)
        const commentEnd = end === -1 ? source.length : end
        result += blankComment(source, index, commentEnd)
        index = commentEnd
        continue
      }
      if (isBlockComment) {
        const endMarker = source.indexOf('*/', index + 2)
        const commentEnd = endMarker === -1 ? source.length : endMarker + 2
        result += blankComment(source, index, commentEnd)
        index = commentEnd
        continue
      }
      if (isXmlComment) {
        const endMarker = source.indexOf('-->', index + 4)
        const commentEnd = endMarker === -1 ? source.length : endMarker + 3
        result += blankComment(source, index, commentEnd)
        index = commentEnd
        continue
      }
      if (char === "'") state = 'single'
      else if (char === '"') state = 'double'
      else if (char === '`') state = 'template'
      result += char
      index += 1
      continue
    }

    result += char
    if (char === '\\') {
      if (index + 1 < source.length) result += source[index + 1]
      index += 2
      continue
    }
    if (
      (state === 'single' && char === "'") ||
      (state === 'double' && char === '"') ||
      (state === 'template' && char === '`')
    ) {
      state = 'code'
    }
    index += 1
  }
  return result
}

export function findHardcodedCjk(text: string, kind: 'ts' | 'wxml'): HardcodedCjkHit[] {
  const hits: HardcodedCjkHit[] = []
  const lines = stripComments(text, kind).split(/\r?\n/)
  const cjk = /[\u3400-\u4DBF\u4E00-\u9FFF]/u
  for (let index = 0; index < lines.length; index += 1) {
    if (cjk.test(lines[index])) hits.push({ line: index + 1, text: lines[index] })
  }
  return hits
}

function walkFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function addFileIfPresent(files: Set<string>, filePath: string): void {
  try {
    if (statSync(filePath).isFile()) files.add(filePath)
  } catch {
    // Missing optional targets are intentionally skipped.
  }
}

function collectFiles(root: string): { forbidden: string[]; hardcoded: string[] } {
  const forbidden = new Set<string>()
  const hardcoded = new Set<string>()
  const add = (relativePath: string) => addFileIfPresent(forbidden, join(root, relativePath))
  add('miniprogram/core/copy.ts')
  add('miniprogram/core/legal.ts')
  add('miniprogram/data/manifest.ts')
  add('miniprogram/app.json')
  add('assets-src/library.json')
  add('review/审核备注.md')

  const pagesRoot = join(root, 'miniprogram/pages')
  const miniprogramRoot = join(root, 'miniprogram')
  for (const filePath of walkFiles(miniprogramRoot)) {
    const relativePath = relative(root, filePath).replaceAll('\\', '/')
    if (relativePath.startsWith('miniprogram/pages/') && relativePath.endsWith('.json')) {
      forbidden.add(filePath)
    }
    if (relativePath.endsWith('.wxml')) forbidden.add(filePath)
  }
  if (statSync(pagesRoot, { throwIfNoEntry: false })) {
    for (const filePath of walkFiles(pagesRoot)) {
      if (filePath.endsWith('.ts')) hardcoded.add(filePath)
      if (filePath.endsWith('.wxml')) hardcoded.add(filePath)
    }
  }
  const componentsRoot = join(root, 'miniprogram/components')
  if (statSync(componentsRoot, { throwIfNoEntry: false })) {
    for (const filePath of walkFiles(componentsRoot)) {
      if (filePath.endsWith('.ts')) hardcoded.add(filePath)
      if (filePath.endsWith('.wxml')) hardcoded.add(filePath)
    }
  }
  return {
    forbidden: [...forbidden].sort(),
    hardcoded: [...hardcoded].sort(),
  }
}

function displayPath(root: string, filePath: string): string {
  return relative(root, filePath).replaceAll('\\', '/')
}

export function runCheck(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')): number {
  const wordsPath = join(root, 'scripts/forbidden-words.txt')
  const words = parseWords(readFileSync(wordsPath, 'utf8'))
  const targets = collectFiles(root)
  const failures: string[] = []

  for (const filePath of targets.forbidden) {
    const text = readFileSync(filePath, 'utf8')
    for (const hit of findForbidden(text, words)) {
      failures.push(`${displayPath(root, filePath)}:${hit.line}:${hit.word}:${hit.text}`)
    }
  }

  for (const filePath of targets.hardcoded) {
    const text = readFileSync(filePath, 'utf8')
    const kind = filePath.endsWith('.wxml') ? 'wxml' : 'ts'
    for (const hit of findHardcodedCjk(text, kind)) {
      failures.push(`${displayPath(root, filePath)}:${hit.line}:硬编码中文:${hit.text}`)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(failure)
    return 1
  }
  console.log(`check:words OK (${targets.forbidden.length} files, ${words.length} words)`)
  return 0
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
const scriptPath = fileURLToPath(import.meta.url)
if (invokedPath.toLowerCase() === scriptPath.toLowerCase()) {
  process.exitCode = runCheck()
}
