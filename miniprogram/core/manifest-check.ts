import { buildTimeline } from './timeline'
import type { Manifest } from './manifest-types'

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/u

function checkIds(ids: string[], label: string, problems: string[]): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (!ID_RE.test(id)) problems.push(`${label} id is invalid: ${id}`)
    if (seen.has(id)) problems.push(`${label} id is duplicated: ${id}`)
    seen.add(id)
  }
}

export function validateManifest(manifest: Manifest): string[] {
  const problems: string[] = []
  if (!Number.isInteger(manifest.version) || manifest.version < 0) problems.push('version must be a non-negative integer')
  if (typeof manifest.base !== 'string' || manifest.base === '') problems.push('base must be non-empty')
  if (manifest.videos.length < 1) problems.push('at least one video is required')
  if (manifest.audios.length < 1) problems.push('at least one audio is required')
  checkIds(manifest.videos.map((video) => video.id), 'video', problems)
  checkIds(manifest.audios.map((audio) => audio.id), 'audio', problems)

  for (const video of manifest.videos) {
    if (!COLOR_RE.test(video.textColor)) problems.push(`video ${video.id} textColor is invalid`)
    if (!(video.weight > 0) || !Number.isFinite(video.weight)) problems.push(`video ${video.id} weight must be greater than 0`)
  }
  for (const audio of manifest.audios) {
    if (!(audio.weight > 0) || !Number.isFinite(audio.weight)) problems.push(`audio ${audio.id} weight must be greater than 0`)
  }
  if (!manifest.copy.inviteLine.includes('{name}')) problems.push('copy.inviteLine must contain {name}')
  if (manifest.layout.nameTopPct < 0.5 || manifest.layout.nameTopPct > 0.9) problems.push('layout.nameTopPct must be between 0.5 and 0.9')
  if (manifest.layout.nameMinRpx < 20 || manifest.layout.nameMinRpx > manifest.layout.nameMaxRpx || manifest.layout.nameMaxRpx > 64) problems.push('layout name sizes must satisfy 20 <= min <= max <= 64')

  const expected = new Set<string>()
  for (const video of manifest.videos) {
    for (const audio of manifest.audios) expected.add(`${video.id}__${audio.id}`)
  }
  const combos = manifest.combos
  for (const key of expected) {
    const combo = combos[key]
    if (combo === undefined) {
      problems.push(`missing combo: ${key}`)
      continue
    }
    if (combo.key !== key || combo.videoId !== key.split('__')[0] || combo.audioId !== key.split('__')[1]) problems.push(`combo ${key} has mismatched identifiers`)
    if (!combo.url.startsWith(`${manifest.base}/`)) problems.push(`combo ${key} url must start with base`)
    if (!combo.posterUrl.startsWith(`${manifest.base}/`)) problems.push(`combo ${key} posterUrl must start with base`)
    try {
      const timeline = buildTimeline({ audioMs: combo.playMs, loopMs: combo.loopMs })
      if (Math.abs(combo.durationMs - timeline.cycleMs) > 150) problems.push(`combo ${key} durationMs is out of range`)
    } catch {
      problems.push(`combo ${key} has invalid playMs or loopMs`)
    }
  }
  for (const key of Object.keys(combos)) if (!expected.has(key)) problems.push(`extra combo: ${key}`)
  return problems
}
