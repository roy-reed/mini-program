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

export function selectInvitation(manifest: Manifest, videoId: string, audioId: string, now: number): DrawResult {
  if (!manifest.videos.some((item) => item.id === videoId)) throw new Error(`unknown background: ${videoId}`)
  if (!manifest.audios.some((item) => item.id === audioId)) throw new Error(`unknown music: ${audioId}`)
  const comboKey = comboKeyOf(videoId, audioId)
  if (manifest.combos[comboKey] === undefined) throw new Error(`combo is missing from manifest: ${comboKey}`)
  return { videoId, audioId, comboKey, drawnAt: now, manifestVersion: manifest.version }
}

export function redrawInvitation(manifest: Manifest, rng: Rng, now: number, previousKey: string | null): DrawResult {
  const choices = manifest.videos.flatMap((video) => manifest.audios
    .filter((audio) => manifest.combos[comboKeyOf(video.id, audio.id)] !== undefined)
    .map((audio) => ({ videoId: video.id, audioId: audio.id, key: comboKeyOf(video.id, audio.id), weight: video.weight * audio.weight })))
  if (choices.length === 0) throw new Error('no valid invitation combinations')
  const different = choices.filter((choice) => choice.key !== previousKey)
  const selected = pickWeighted(different.length > 0 ? different : choices, rng)
  return selectInvitation(manifest, selected.videoId, selected.audioId, now)
}
