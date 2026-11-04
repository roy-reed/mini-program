import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkForbiddenApis } from '../scripts/precheck'

function withRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'shared-chord-media-allowlist-'))
  mkdirSync(join(root, 'miniprogram/services'), { recursive: true })
  try {
    writeFileSync(join(root, 'miniprogram/app.ts'), "App({ onLaunch() { const env = 'test-env'; wx.cloud.init({ env }) } })")
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('CloudBase media allowlist', () => {
  it('allows one getTempFileURL call only in the media service', () => {
    withRoot((root) => {
      writeFileSync(join(root, 'miniprogram/services/media.ts'), 'wx.cloud.getTempFileURL({ fileList: [] })')
      expect(checkForbiddenApis(root).ok).toBe(true)
    })
  })

  it('rejects other CloudBase calls in the service', () => {
    withRoot((root) => {
      writeFileSync(join(root, 'miniprogram/services/media.ts'), 'wx.cloud.getTempFileURL({ fileList: [] }); wx.cloud.deleteFile({})')
      expect(checkForbiddenApis(root).ok).toBe(false)
    })
  })

  it('rejects media URL resolution outside the service', () => {
    withRoot((root) => {
      writeFileSync(join(root, 'miniprogram/services/media.ts'), 'wx.cloud.getTempFileURL({ fileList: [] })')
      writeFileSync(join(root, 'miniprogram/other.ts'), 'wx.cloud.getTempFileURL({ fileList: [] })')
      expect(checkForbiddenApis(root).ok).toBe(false)
    })
  })

  it('requires one CloudBase media resolver call when media.ts exists', () => {
    withRoot((root) => {
      writeFileSync(join(root, 'miniprogram/services/media.ts'), 'export const disabled = true')
      expect(checkForbiddenApis(root).ok).toBe(false)
    })
  })
})
