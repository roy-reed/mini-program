export const FADE_IN_MS = 1000
export const FADE_OUT_MS = 1000
export const REST_MS = 3000
export const MIN_AUDIO_MS = 10000
export const MAX_AUDIO_MS = 90000
export const MIN_LOOP_MS = 500
export const MAX_LOOP_MS = 10000

export type LoopMode = 'ceil' | 'floor'
export const DEFAULT_LOOP_MODE: LoopMode = 'ceil'

export type Phase = 'fadeIn' | 'main' | 'fadeOut' | 'rest'

export interface Segment {
  phase: Phase
  startMs: number
  endMs: number
}

export interface Timeline {
  audioMs: number
  loopMs: number
  mode: LoopMode
  playMs: number
  loopCopies: number
  loopTrackMs: number
  cycleMs: number
  segments: Segment[]
}

export interface TimelineInput {
  audioMs: number
  loopMs: number
  mode?: LoopMode
}

function assertIntegerInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in the range ${min}–${max} ms`)
  }
}

export function buildTimeline(input: TimelineInput): Timeline {
  const mode = input.mode ?? DEFAULT_LOOP_MODE
  assertIntegerInRange('audioMs', input.audioMs, MIN_AUDIO_MS, MAX_AUDIO_MS)
  assertIntegerInRange('loopMs', input.loopMs, MIN_LOOP_MS, MAX_LOOP_MS)
  if (mode !== 'ceil' && mode !== 'floor') {
    throw new RangeError("mode must be 'ceil' or 'floor'")
  }

  const loopCopies = mode === 'ceil'
    ? Math.ceil(input.audioMs / input.loopMs)
    : Math.floor(input.audioMs / input.loopMs)
  const playMs = mode === 'ceil' ? input.audioMs : loopCopies * input.loopMs
  if (playMs < MIN_AUDIO_MS) {
    throw new RangeError(`floor mode produces playMs ${playMs} ms, which must be at least ${MIN_AUDIO_MS} ms`)
  }

  const cycleMs = playMs + REST_MS
  return {
    audioMs: input.audioMs,
    loopMs: input.loopMs,
    mode,
    playMs,
    loopCopies,
    loopTrackMs: loopCopies * input.loopMs,
    cycleMs,
    segments: [
      { phase: 'fadeIn', startMs: 0, endMs: FADE_IN_MS },
      { phase: 'main', startMs: FADE_IN_MS, endMs: playMs - FADE_OUT_MS },
      { phase: 'fadeOut', startMs: playMs - FADE_OUT_MS, endMs: playMs },
      { phase: 'rest', startMs: playMs, endMs: cycleMs },
    ],
  }
}

export interface PlayState {
  phase: Phase
  opacity: number
  volume: number
  cycleIndex: number
  tInCycleMs: number
}

export function stateAt(tl: Timeline, tMs: number): PlayState {
  if (!Number.isFinite(tMs)) {
    throw new RangeError('tMs must be a finite number')
  }
  const normalizedMs = Math.max(0, tMs)
  const cycleIndex = Math.floor(normalizedMs / tl.cycleMs)
  const tInCycleMs = normalizedMs % tl.cycleMs

  let phase: Phase
  let opacity: number
  if (tInCycleMs < FADE_IN_MS) {
    phase = 'fadeIn'
    opacity = tInCycleMs / FADE_IN_MS
  } else if (tInCycleMs < tl.playMs - FADE_OUT_MS) {
    phase = 'main'
    opacity = 1
  } else if (tInCycleMs < tl.playMs) {
    phase = 'fadeOut'
    opacity = (tl.playMs - tInCycleMs) / FADE_OUT_MS
  } else {
    phase = 'rest'
    opacity = 0
  }

  return { phase, opacity, volume: opacity, cycleIndex, tInCycleMs }
}
