import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export interface CacheEntry { hash: string; output: string }
export type Cache = Record<string, CacheEntry>

export function inputHash(filePaths: readonly string[], parameters: unknown): string {
  const hash = createHash('sha256')
  for (const filePath of filePaths) hash.update(filePath).update('\0').update(readFileSync(filePath))
  hash.update('\0').update(JSON.stringify(parameters))
  return hash.digest('hex')
}

export function readCache(filePath: string): Cache {
  if (!existsSync(filePath)) return {}
  try { return JSON.parse(readFileSync(filePath, 'utf8')) as Cache } catch { return {} }
}

export function writeCache(filePath: string, cache: Cache): void {
  writeFileSync(filePath, `${JSON.stringify(cache, null, 2)}\n`)
}
