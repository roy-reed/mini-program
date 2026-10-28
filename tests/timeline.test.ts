import { describe, expect, it } from 'vitest'
import {
  buildTimeline,
  stateAt,
} from '../miniprogram/core/timeline'

describe('buildTimeline', () => {
  it.each([
    [32400, 4000, 'ceil', 9, 32400, 35400],
    [30000, 3000, 'ceil', 10, 30000, 33000],
    [12000, 7000, 'ceil', 2, 12000, 15000],
    [32400, 4000, 'floor', 8, 32000, 35000],
  ] as const)('%i ms audio, %i ms loop, %s mode', (audioMs, loopMs, mode, loopCopies, playMs, cycleMs) => {
    const timeline = buildTimeline({ audioMs, loopMs, mode })
    expect(timeline.loopCopies).toBe(loopCopies)
    expect(timeline.playMs).toBe(playMs)
    expect(timeline.cycleMs).toBe(cycleMs)
    expect(timeline.loopTrackMs).toBe(loopCopies * loopMs)
    expect(timeline.segments).toEqual([
      { phase: 'fadeIn', startMs: 0, endMs: 1000 },
      { phase: 'main', startMs: 1000, endMs: playMs - 1000 },
      { phase: 'fadeOut', startMs: playMs - 1000, endMs: playMs },
      { phase: 'rest', startMs: playMs, endMs: cycleMs },
    ])
  })

  it('rejects a floor timeline shorter than the minimum audio duration', () => {
    expect(() => buildTimeline({ audioMs: 12000, loopMs: 7000, mode: 'floor' })).toThrow(RangeError)
  })

  it.each([
    ['audioMs', 9999, 4000],
    ['audioMs', 90001, 4000],
    ['audioMs', 12000.5, 4000],
    ['audioMs', Number.NaN, 4000],
    ['loopMs', 12000, 12000],
    ['loopMs', 12000, 499],
    ['loopMs', 12000, 10001],
  ] as const)('rejects invalid %s', (_name, audioMs, loopMs) => {
    expect(() => buildTimeline({ audioMs, loopMs })).toThrow(RangeError)
  })
})

describe('stateAt', () => {
  const timeline = buildTimeline({ audioMs: 12000, loopMs: 4000 })

  it.each([
    [-5, 'fadeIn', 0, 0, 0],
    [0, 'fadeIn', 0, 0, 0],
    [500, 'fadeIn', 0.5, 0, 500],
    [1000, 'main', 1, 0, 1000],
    [10999, 'main', 1, 0, 10999],
    [11000, 'fadeOut', 1, 0, 11000],
    [11500, 'fadeOut', 0.5, 0, 11500],
    [12000, 'rest', 0, 0, 12000],
    [14999, 'rest', 0, 0, 14999],
    [15000, 'fadeIn', 0, 1, 0],
    [15500, 'fadeIn', 0.5, 1, 500],
  ] as const)('at %i ms returns %s with opacity %f', (time, phase, opacity, cycleIndex, tInCycleMs) => {
    expect(stateAt(timeline, time)).toEqual({ phase, opacity, volume: opacity, cycleIndex, tInCycleMs })
  })

  it('keeps opacity within [0, 1] over two cycles', () => {
    for (let time = 0; time <= timeline.cycleMs * 2; time += 50) {
      const state = stateAt(timeline, time)
      expect(state.opacity).toBeGreaterThanOrEqual(0)
      expect(state.opacity).toBeLessThanOrEqual(1)
      expect(state.volume).toBe(state.opacity)
    }
  })
})
