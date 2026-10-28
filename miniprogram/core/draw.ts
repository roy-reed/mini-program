import type { Manifest } from './manifest-types'

export type Rng = () => number

export interface DrawResult {
  videoId: string
  audioId: string
  comboKey: string
  drawnAt: number
  manifestVersion: number
}

export function comboKeyOf(videoId: string, audioId: string): string {
  return `${videoId}__${audioId}`
}

export function pickWeighted<T extends { weight: number }>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new RangeError('items must not be empty')
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) throw new RangeError('total weight must be greater than 0')
  const random = rng()
  if (random >= 1) return items[items.length - 1]
  const target = random * totalWeight
  let cumulative = 0
  for (const item of items) {
    cumulative += item.weight
    if (target < cumulative) return item
  }
  return items[items.length - 1]
}

export function drawInvitation(manifest: Manifest, rng: Rng, now: number): DrawResult {
  const video = pickWeighted(manifest.videos, rng)
  const audio = pickWeighted(manifest.audios, rng)
  const comboKey = comboKeyOf(video.id, audio.id)
  if (manifest.combos[comboKey] === undefined) throw new Error(`combo is missing from manifest: ${comboKey}`)
  return { videoId: video.id, audioId: audio.id, comboKey, drawnAt: now, manifestVersion: manifest.version }
}
