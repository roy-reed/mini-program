import { describe, expect, it } from 'vitest'
import { comboKeyOf, drawInvitation, pickWeighted } from '../miniprogram/core/draw'
import { mulberry32 } from './helpers/rng'
import { FIXTURE_MANIFEST } from './fixtures/manifest'

describe('draw', () => {
  it('picks independently in video-then-audio order', () => {
    expect(comboKeyOf('door', 'track-one')).toBe('door__track-one')
    expect(drawInvitation(FIXTURE_MANIFEST, (() => {
      const values = [0.01, 0.99]
      return () => values.shift() ?? 0
    })(), 123)).toEqual({ videoId: 'door', audioId: 'track-two', comboKey: 'door__track-two', drawnAt: 123, manifestVersion: 1 })
  })

  it('uses the final item for rng values at least one', () => {
    expect(pickWeighted(FIXTURE_MANIFEST.videos, () => 0.999999)).toBe(FIXTURE_MANIFEST.videos[1])
    expect(pickWeighted(FIXTURE_MANIFEST.videos, () => 1)).toBe(FIXTURE_MANIFEST.videos[1])
  })

  it('rejects empty and zero-weight lists', () => {
    expect(() => pickWeighted([], () => 0)).toThrow(RangeError)
    expect(() => pickWeighted([{ weight: 0 }], () => 0)).toThrow(RangeError)
  })

  it('keeps equal weighted combinations close to uniform', () => {
    const rng = mulberry32(42)
    const counts = new Map<string, number>()
    for (let index = 0; index < 20000; index += 1) {
      const result = drawInvitation(FIXTURE_MANIFEST, rng, index)
      counts.set(result.comboKey, (counts.get(result.comboKey) ?? 0) + 1)
    }
    for (const count of counts.values()) expect(count / 20000).toBeGreaterThanOrEqual(0.23)
    for (const count of counts.values()) expect(count / 20000).toBeLessThanOrEqual(0.27)
  })

  it('follows a 3:1 weight split', () => {
    const rng = mulberry32(7)
    const items = [{ id: 'heavy', weight: 3 }, { id: 'light', weight: 1 }]
    let heavy = 0
    for (let index = 0; index < 20000; index += 1) {
      if (pickWeighted(items, rng).id === 'heavy') heavy += 1
    }
    expect(heavy / 20000).toBeGreaterThanOrEqual(0.73)
    expect(heavy / 20000).toBeLessThanOrEqual(0.77)
  })
})
