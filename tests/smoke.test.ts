import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('C00 工程壳', () => {
  it('声明四个页面并以仓库根目录为导入目录', () => {
    const app = JSON.parse(readFileSync(new URL('../miniprogram/app.json', import.meta.url), 'utf8')) as {
      pages: string[]
    }
    const project = JSON.parse(
      readFileSync(new URL('../project.config.json', import.meta.url), 'utf8'),
    ) as { miniprogramRoot: string }

    expect(app.pages).toEqual([
      'pages/login/index',
      'pages/draw/index',
      'pages/invitation/index',
      'pages/legal/index',
    ])
    expect(project.miniprogramRoot).toBe('miniprogram/')
  })
})
