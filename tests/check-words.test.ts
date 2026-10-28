import { describe, expect, it } from 'vitest'
import { findForbidden, findHardcodedCjk, parseWords } from '../scripts/check-words'

describe('禁用词与硬编码中文检查', () => {
  const words = parseWords('# 注释\n盲盒\nmock\n')

  it('按不区分大小写的子串匹配禁用词', () => {
    expect(findForbidden('请抽取您的专属邀请函', words)).toEqual([])
    expect(findForbidden('快来开盲盒', words).map((hit) => hit.word)).toEqual(['盲盒'])
    expect(findForbidden('MOCK', words).map((hit) => hit.word)).toEqual(['mock'])
  })

  it('去掉注释后检查 wxml 和 ts 的硬编码中文', () => {
    expect(findHardcodedCjk('<view>{{copy.a.b}}</view><!-- 注释 -->', 'wxml')).toEqual([])
    expect(findHardcodedCjk('<view>你好</view>', 'wxml')).toHaveLength(1)
    expect(findHardcodedCjk("const a = '中文'", 'ts')).toHaveLength(1)
    expect(findHardcodedCjk('// 注释', 'ts')).toEqual([])
  })
})
