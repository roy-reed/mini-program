import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { MANIFEST } from '../miniprogram/data/manifest'
import { validateManifest } from '../miniprogram/core/manifest-check'
import { runCheck } from './check-words'

export type CheckResult = { ok: boolean; message: string; warnings?: string[] }

function result(ok: boolean, message: string, warnings: string[] = []): CheckResult { return { ok, message, warnings } }

export function checkAppId(config: unknown): CheckResult {
  const appid = typeof config === 'object' && config !== null && 'appid' in config ? (config as { appid?: unknown }).appid : undefined
  return typeof appid === 'string' && appid !== 'wx0000000000000000' && appid !== 'touristappid'
    ? result(true, `appid ${appid}`)
    : result(false, 'project.config.json appid is still a placeholder')
}

export function checkPages(app: unknown): CheckResult {
  const pages = typeof app === 'object' && app !== null && 'pages' in app ? (app as { pages?: unknown }).pages : undefined
  const expected = ['pages/login/index', 'pages/draw/index', 'pages/invitation/index', 'pages/legal/index']
  return Array.isArray(pages) && JSON.stringify(pages) === JSON.stringify(expected)
    ? result(true, 'app.json has the four formal pages')
    : result(false, 'app.json pages must contain exactly the four formal pages')
}

export function checkManifest(manifest: typeof MANIFEST): CheckResult {
  const problems = validateManifest(manifest)
  if (manifest.base.includes('example.invalid')) problems.push('manifest base still uses example.invalid')
  if (manifest.version < 1) problems.push('manifest version must be at least 1')
  if (manifest.videos.length < 2 || manifest.audios.length < 2) problems.push('manifest needs at least two videos and two audios')
  return problems.length === 0 ? result(true, 'manifest is ready') : result(false, problems.join('; '))
}

function fileText(root: string, relativePath: string): string {
  const path = join(root, relativePath)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

export function checkPlaceholders(root: string): CheckResult {
  const files = ['miniprogram/core/copy.ts', 'miniprogram/core/legal.ts', 'miniprogram/data/manifest.ts', 'review/审核备注.md', 'assets-src/library.json']
  const found = files.filter((file) => fileText(root, file).includes('【待填】'))
  return found.length === 0 ? result(true, 'no placeholders remain') : result(false, `placeholders remain in ${found.join(', ')}`)
}

const FORBIDDEN_APIS = ['wx.request', 'wx.downloadFile', 'wx.uploadFile', 'wx.connectSocket', 'wx.login', 'wx.cloud', 'getUserProfile', 'getUserInfo', 'wx.getLocation', 'wx.chooseMedia', 'wx.chooseImage', 'saveVideoToPhotosAlbum', 'setClipboardData']

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

export function checkForbiddenApis(root: string): CheckResult {
  const hits: string[] = []
  for (const file of walkFiles(join(root, 'miniprogram')).filter((path) => path.endsWith('.ts'))) {
    const text = readFileSync(file, 'utf8')
    for (const api of FORBIDDEN_APIS) if (text.includes(api)) hits.push(`${relative(root, file)} contains ${api}`)
  }
  return hits.length === 0 ? result(true, 'no forbidden APIs found') : result(false, hits.join('; '))
}

export function checkAutoplayMuted(root: string): CheckResult {
  const hits: string[] = []
  for (const file of walkFiles(join(root, 'miniprogram')).filter((path) => path.endsWith('.wxml'))) {
    const text = readFileSync(file, 'utf8')
    for (const tag of text.match(/<video\b[^>]*>/gu) ?? []) if (/\bautoplay\b/u.test(tag) && !/\bmuted\b/u.test(tag)) hits.push(`${relative(root, file)} has autoplay without muted`)
  }
  return hits.length === 0 ? result(true, 'autoplay videos are muted') : result(false, hits.join('; '))
}

export function checkSize(root: string): CheckResult {
  const files = walkFiles(join(root, 'miniprogram'))
  const total = files.reduce((sum, file) => sum + statSync(file).size, 0)
  const assets = walkFiles(join(root, 'miniprogram/assets')).reduce((sum, file) => sum + statSync(file).size, 0)
  const warnings: string[] = []
  if (total >= 1.5 * 1024 * 1024) warnings.push(`miniprogram size is ${(total / 1024 / 1024).toFixed(2)} MB`)
  if (assets >= 300 * 1024) warnings.push(`assets size is ${(assets / 1024).toFixed(0)} KB`)
  return total > 2 * 1024 * 1024 ? result(false, `miniprogram exceeds 2 MB (${total} bytes)`, warnings) : result(true, `package size ${total} bytes`, warnings)
}

export function checkVersion(root: string): CheckResult {
  const versionText = fileText(root, 'miniprogram/core/version.ts')
  const match = versionText.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/u)
  const record = fileText(root, '版本记录.md')
  return match !== null && record.includes(match[1]) ? result(true, `version ${match[1]} is recorded`) : result(false, 'APP_VERSION is missing from 版本记录.md')
}

async function checkOnline(): Promise<CheckResult> {
  const entries = Object.values(MANIFEST.combos).flatMap((combo) => [{ url: combo.url, type: 'video/mp4' }, { url: combo.posterUrl, type: 'image/jpeg' }])
  const failures: string[] = []
  for (const entry of entries) {
    try {
      const response = await fetch(entry.url, { method: 'HEAD' })
      const contentType = response.headers.get('content-type') ?? ''
      if (!response.ok || !contentType.includes(entry.type)) failures.push(`${entry.url}: ${response.status} ${contentType}`)
    } catch (error) { failures.push(`${entry.url}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  return failures.length === 0 ? result(true, 'online assets are reachable') : result(false, failures.join('; '))
}

export async function runPrecheck(root = resolve(new URL('.', import.meta.url).pathname, '..'), online = false): Promise<number> {
  const checks: Array<[string, CheckResult]> = []
  const readJson = (file: string): unknown => JSON.parse(readFileSync(join(root, file), 'utf8')) as unknown
  checks.push(['AppID', checkAppId(readJson('project.config.json'))])
  checks.push(['Pages', checkPages(readJson('miniprogram/app.json'))])
  checks.push(['Manifest', checkManifest(MANIFEST)])
  checks.push(['Placeholders', checkPlaceholders(root)])
  checks.push(['Forbidden APIs', checkForbiddenApis(root)])
  checks.push(['Autoplay', checkAutoplayMuted(root)])
  checks.push(['Package size', checkSize(root)])
  checks.push(['Version', checkVersion(root)])
  if (runCheck(root) !== 0) checks.push(['check:words', result(false, 'check:words failed')])
  else checks.push(['check:words', result(true, 'check:words passed')])
  if (online) checks.push(['Online assets', await checkOnline()])
  for (const [name, item] of checks) {
    console.log(`${item.ok ? '✓' : '✗'} ${name}: ${item.message}`)
    for (const warning of item.warnings ?? []) console.warn(`! ${name}: ${warning}`)
  }
  return checks.every(([, item]) => item.ok) ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  runPrecheck(process.cwd(), process.argv.includes('--online')).then((code) => { process.exitCode = code })
}
