import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkAppId, checkAutoplayMuted, checkForbiddenApis, checkManifest, checkOnlineAssets, checkPages, checkPlaceholders, checkSize, checkVersion } from '../scripts/precheck'
import { FIXTURE_MANIFEST } from './fixtures/manifest'
import type { Manifest } from '../miniprogram/core/manifest-types'

function manifestWithBase(base: string): Manifest {
  const combos = Object.fromEntries(Object.entries(FIXTURE_MANIFEST.combos).map(([key, combo]) => [key, {
    ...combo,
    url: combo.url.replace(FIXTURE_MANIFEST.base, base),
    posterUrl: combo.posterUrl.replace(FIXTURE_MANIFEST.base, base),
  }]))
  return { ...FIXTURE_MANIFEST, base, combos }
}

function withTempRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'shared-chord-precheck-'))
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function createMiniProgramRoot(root: string): void {
  mkdirSync(join(root, 'miniprogram/assets'), { recursive: true })
  mkdirSync(join(root, 'miniprogram/core'), { recursive: true })
}

describe('precheck helpers', () => {
  it('checks appid and formal pages in both directions', () => {
    expect(checkAppId({ appid: 'wx1234567890123456' }).ok).toBe(true)
    expect(checkAppId({ appid: 'wx0000000000000000' }).ok).toBe(false)
    expect(checkAppId({ appid: 'touristappid' }).ok).toBe(false)
    expect(checkPages({ pages: ['pages/login/index', 'pages/draw/index', 'pages/invitation/index', 'pages/legal/index'] }).ok).toBe(true)
    expect(checkPages({ pages: ['pages/spike/index'] }).ok).toBe(false)
  })

  it('requires an HTTPS, non-placeholder manifest with at least two videos and audios', () => {
    const valid = manifestWithBase('https://cdn.example.com/shared-chord')
    expect(checkManifest(valid).ok).toBe(true)
    expect(checkManifest(manifestWithBase('http://cdn.example.com/shared-chord')).ok).toBe(false)
    expect(checkManifest(FIXTURE_MANIFEST).ok).toBe(false)
    expect(checkManifest({ ...valid, base: `${valid.base}/` }).ok).toBe(false)
    expect(checkManifest({ ...valid, version: 0 }).ok).toBe(false)
    expect(checkManifest({ ...valid, videos: [valid.videos[0]] }).ok).toBe(false)
    expect(checkManifest({ ...valid, audios: [valid.audios[0]] }).ok).toBe(false)
  })

  it('detects and clears placeholders, forbidden APIs, and unmuted autoplay', () => {
    withTempRoot((root) => {
      mkdirSync(join(root, 'miniprogram/pages'), { recursive: true })
      mkdirSync(join(root, 'miniprogram/core'), { recursive: true })
      mkdirSync(join(root, 'review'), { recursive: true })
      mkdirSync(join(root, 'assets-src'), { recursive: true })
      writeFileSync(join(root, 'miniprogram/pages/page.ts'), 'wx.request({})')
      writeFileSync(join(root, 'miniprogram/pages/page.wxml'), '<video autoplay></video>')
      writeFileSync(join(root, 'miniprogram/core/legal.ts'), '【待填】')
      expect(checkForbiddenApis(root).ok).toBe(false)
      expect(checkAutoplayMuted(root).ok).toBe(false)
      expect(checkPlaceholders(root).ok).toBe(false)

      writeFileSync(join(root, 'miniprogram/pages/page.ts'), 'wx.showToast({})')
      writeFileSync(join(root, 'miniprogram/pages/page.wxml'), '<video autoplay muted></video>')
      writeFileSync(join(root, 'miniprogram/core/legal.ts'), 'Complete legal text')
      expect(checkForbiddenApis(root).ok).toBe(true)
      expect(checkAutoplayMuted(root).ok).toBe(true)
      expect(checkPlaceholders(root).ok).toBe(true)
    })
  })

  it('enforces package, asset, and version thresholds', () => {
    withTempRoot((root) => {
      createMiniProgramRoot(root)
      writeFileSync(join(root, 'miniprogram/app.js'), Buffer.alloc(1.5 * 1024 * 1024))
      const warning = checkSize(root)
      expect(warning.ok).toBe(true)
      expect(warning.warnings?.length).toBe(1)

      writeFileSync(join(root, 'miniprogram/assets/large.bin'), Buffer.alloc(300 * 1024))
      expect(checkSize(root).ok).toBe(false)

      writeFileSync(join(root, 'miniprogram/core/version.ts'), "export const APP_VERSION = '0.1.0'")
      writeFileSync(join(root, '版本记录.md'), '0.1.0')
      expect(checkVersion(root).ok).toBe(true)
      writeFileSync(join(root, '版本记录.md'), '0.1.1')
      expect(checkVersion(root).ok).toBe(false)
    })

    withTempRoot((root) => {
      createMiniProgramRoot(root)
      writeFileSync(join(root, 'miniprogram/large.bin'), Buffer.alloc(2 * 1024 * 1024 + 1))
      expect(checkSize(root).ok).toBe(false)
    })
  })

  it('checks online video and poster content types', async () => {
    const manifest = manifestWithBase('https://cdn.example.com/shared-chord')
    const goodFetcher: typeof fetch = async (input) => {
      const contentType = String(input).endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'
      return {
        ok: true,
        status: 200,
        headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? contentType : null },
      } as Response
    }
    const badFetcher: typeof fetch = async () => ({
      ok: false,
      status: 403,
      headers: { get: () => 'text/html' },
    } as Response)

    expect((await checkOnlineAssets(manifest, goodFetcher)).ok).toBe(true)
    expect((await checkOnlineAssets(manifest, badFetcher)).ok).toBe(false)
  })
})
