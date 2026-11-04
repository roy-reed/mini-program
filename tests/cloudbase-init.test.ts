import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkForbiddenApis } from '../scripts/precheck'

function withMiniProgramRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'shared-chord-cloud-init-'))
  mkdirSync(join(root, 'miniprogram'), { recursive: true })
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function writeApp(root: string, source: string): void {
  writeFileSync(join(root, 'miniprogram/app.ts'), source)
}

describe('CloudBase initialization allowlist', () => {
  it('allows exactly one wx.cloud.init({ env }) in app.ts', () => {
    withMiniProgramRoot((root) => {
      writeApp(root, "App({ onLaunch() { const env = 'test-env'; wx.cloud.init({ env }) } })")

      expect(checkForbiddenApis(root).ok).toBe(true)
    })
  })

  it('requires exactly one initialization in app.ts', () => {
    withMiniProgramRoot((root) => {
      writeApp(root, 'App({ onLaunch() {} })')
      expect(checkForbiddenApis(root).ok).toBe(false)

      writeApp(root, "App({ onLaunch() { const env = 'test-env'; wx.cloud.init({ env }); wx.cloud.init({ env }) } })")
      expect(checkForbiddenApis(root).ok).toBe(false)
    })
  })

  it('rejects other CloudBase APIs and CloudBase references outside app.ts', () => {
    withMiniProgramRoot((root) => {
      writeApp(root, "App({ onLaunch() { const env = 'test-env'; wx.cloud.init({ env }) } })")
      writeFileSync(join(root, 'miniprogram/page.ts'), 'wx.cloud.getTempFileURL({})')
      expect(checkForbiddenApis(root).ok).toBe(false)
    })
  })

  it('keeps all other forbidden APIs blocked', () => {
    withMiniProgramRoot((root) => {
      writeApp(root, "App({ onLaunch() { const env = 'test-env'; wx.cloud.init({ env }) } })")
      writeFileSync(join(root, 'miniprogram/page.ts'), 'wx.request({})')
      expect(checkForbiddenApis(root).ok).toBe(false)
    })
  })
})
