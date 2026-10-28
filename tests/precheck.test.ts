import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkAppId, checkAutoplayMuted, checkForbiddenApis, checkPages, checkPlaceholders, checkSize, checkVersion } from '../scripts/precheck'

describe('precheck helpers', () => {
  it('checks appid and formal pages', () => {
    expect(checkAppId({ appid: 'wx123' }).ok).toBe(true)
    expect(checkAppId({ appid: 'wx0000000000000000' }).ok).toBe(false)
    expect(checkPages({ pages: ['pages/login/index', 'pages/draw/index', 'pages/invitation/index', 'pages/legal/index'] }).ok).toBe(true)
    expect(checkPages({ pages: ['pages/spike/index'] }).ok).toBe(false)
  })

  it('detects placeholders, forbidden APIs and autoplay', () => {
    const root = mkdtempSync(join('/tmp', 'shared-chord-precheck-'))
    mkdirSync(join(root, 'miniprogram/pages'), { recursive: true })
    mkdirSync(join(root, 'miniprogram/core'), { recursive: true })
    mkdirSync(join(root, 'miniprogram/assets'), { recursive: true })
    mkdirSync(join(root, 'assets-src'), { recursive: true })
    mkdirSync(join(root, 'review'), { recursive: true })
    writeFileSync(join(root, 'miniprogram/pages/page.ts'), 'wx.request({})')
    writeFileSync(join(root, 'miniprogram/pages/page.wxml'), '<video autoplay></video>')
    writeFileSync(join(root, 'miniprogram/core/legal.ts'), '【待填】')
    writeFileSync(join(root, 'review/审核备注.md'), '')
    writeFileSync(join(root, 'assets-src/library.json'), '')
    expect(checkForbiddenApis(root).ok).toBe(false)
    expect(checkAutoplayMuted(root).ok).toBe(false)
    expect(checkPlaceholders(root).ok).toBe(false)
  })

  it('checks version and package size', () => {
    const root = mkdtempSync(join('/tmp', 'shared-chord-precheck-size-'))
    mkdirSync(join(root, 'miniprogram/core'), { recursive: true })
    mkdirSync(join(root, 'miniprogram/assets'), { recursive: true })
    writeFileSync(join(root, 'miniprogram/core/version.ts'), "export const APP_VERSION = '0.1.0'")
    writeFileSync(join(root, '版本记录.md'), '0.1.0')
    expect(checkVersion(root).ok).toBe(true)
    expect(checkSize(root).ok).toBe(true)
  })
})
