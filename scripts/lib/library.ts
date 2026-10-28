import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { findForbidden, parseWords } from '../check-words'

export interface Clip {
  start: number
  duration: number
}

export interface LibraryVideo {
  id: string
  name: string
  file: string
  clip: Clip | null
  pingpong: boolean
  textColor: string
  aiGenerated: boolean
  weight: number
  enabled: boolean
}

export interface LibraryAudio {
  id: string
  name: string
  file: string
  clip: Clip | null
  weight: number
  enabled: boolean
}

export interface Library {
  version: number
  album: { title: string; releaseDate: string }
  copy: { inviteLine: string }
  timeline: { loopMode: 'ceil' | 'floor' }
  layout: { nameTopPct: number; nameMaxRpx: number; nameMinRpx: number }
  overlays: { title: string | null; aiLabel: string | null }
  allowUnequalWeights: boolean
  videos: LibraryVideo[]
  audios: LibraryAudio[]
}

export interface LibraryResult {
  value: Library | null
  problems: string[]
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/u

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(value: unknown, name: string, problems: string[]): string {
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${name} must be a non-empty string`)
    return ''
  }
  return value
}

function numberField(value: unknown, name: string, problems: string[], fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    problems.push(`${name} must be a finite number`)
    return fallback ?? 0
  }
  return value
}

function parseClip(value: unknown, name: string, problems: string[]): Clip | null {
  if (value === null || value === undefined) return null
  if (!record(value)) {
    problems.push(`${name} must be null or an object`)
    return null
  }
  const start = numberField(value.start, `${name}.start`, problems)
  const duration = numberField(value.duration, `${name}.duration`, problems)
  if (start < 0 || duration <= 0) problems.push(`${name} must have start >= 0 and duration > 0`)
  return { start, duration }
}

function parseVideo(value: unknown, index: number, problems: string[]): LibraryVideo | null {
  if (!record(value)) { problems.push(`videos[${index}] must be an object`); return null }
  const prefix = `videos[${index}]`
  const id = stringField(value.id, `${prefix}.id`, problems)
  if (!ID_RE.test(id)) problems.push(`${prefix}.id must match ${ID_RE}`)
  const textColor = stringField(value.textColor, `${prefix}.textColor`, problems)
  if (!COLOR_RE.test(textColor)) problems.push(`${prefix}.textColor must match #RRGGBB`)
  const aiGenerated = value.aiGenerated
  if (typeof aiGenerated !== 'boolean') problems.push(`${prefix}.aiGenerated must be boolean`)
  return {
    id, name: stringField(value.name, `${prefix}.name`, problems), file: stringField(value.file, `${prefix}.file`, problems),
    clip: parseClip(value.clip, `${prefix}.clip`, problems), pingpong: value.pingpong === true, textColor,
    aiGenerated: aiGenerated === true, weight: numberField(value.weight, `${prefix}.weight`, problems, 1),
    enabled: value.enabled !== false,
  }
}

function parseAudio(value: unknown, index: number, problems: string[]): LibraryAudio | null {
  if (!record(value)) { problems.push(`audios[${index}] must be an object`); return null }
  const prefix = `audios[${index}]`
  const id = stringField(value.id, `${prefix}.id`, problems)
  if (!ID_RE.test(id)) problems.push(`${prefix}.id must match ${ID_RE}`)
  return {
    id, name: stringField(value.name, `${prefix}.name`, problems), file: stringField(value.file, `${prefix}.file`, problems),
    clip: parseClip(value.clip, `${prefix}.clip`, problems), weight: numberField(value.weight, `${prefix}.weight`, problems, 1),
    enabled: value.enabled !== false,
  }
}

function duplicateIds(items: Array<{ id: string }>, label: string, problems: string[]): void {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) problems.push(`${label} id duplicated: ${item.id}`)
    seen.add(item.id)
  }
}

function equalEnabledWeights(items: Array<{ id: string; weight: number; enabled: boolean }>, label: string, problems: string[]): void {
  const enabled = items.filter((item) => item.enabled)
  if (enabled.length < 2) return
  const first = enabled[0].weight
  if (enabled.some((item) => item.weight !== first)) problems.push(`${label} enabled weights must be equal when allowUnequalWeights is false`)
}

export function parseLibrary(input: unknown): LibraryResult {
  const problems: string[] = []
  if (!record(input)) return { value: null, problems: ['library must be an object'] }
  const version = numberField(input.version, 'version', problems)
  if (!Number.isInteger(version) || version < 0) problems.push('version must be a non-negative integer')
  const album = record(input.album) ? { title: stringField(input.album.title, 'album.title', problems), releaseDate: stringField(input.album.releaseDate, 'album.releaseDate', problems) } : (problems.push('album must be an object'), { title: '', releaseDate: '' })
  const copy = record(input.copy) ? { inviteLine: stringField(input.copy.inviteLine, 'copy.inviteLine', problems) } : (problems.push('copy must be an object'), { inviteLine: '' })
  if (!copy.inviteLine.includes('{name}')) problems.push('copy.inviteLine must contain {name}')
  const timelineInput = record(input.timeline) ? input.timeline.loopMode : undefined
  const loopMode: 'ceil' | 'floor' = timelineInput === 'floor' ? 'floor' : 'ceil'
  if (loopMode !== 'ceil' && loopMode !== 'floor') problems.push('timeline.loopMode must be ceil or floor')
  const layoutInput = record(input.layout) ? input.layout : {}
  const layout = {
    nameTopPct: numberField(layoutInput.nameTopPct, 'layout.nameTopPct', problems, 0.7),
    nameMaxRpx: numberField(layoutInput.nameMaxRpx, 'layout.nameMaxRpx', problems, 44),
    nameMinRpx: numberField(layoutInput.nameMinRpx, 'layout.nameMinRpx', problems, 28),
  }
  if (layout.nameTopPct < 0.5 || layout.nameTopPct > 0.9) problems.push('layout.nameTopPct must be between 0.5 and 0.9')
  if (layout.nameMinRpx < 20 || layout.nameMinRpx > layout.nameMaxRpx || layout.nameMaxRpx > 64) problems.push('layout name sizes must satisfy 20 <= min <= max <= 64')
  const overlaysInput = record(input.overlays) ? input.overlays : {}
  const title = overlaysInput.title === null || overlaysInput.title === undefined ? null : stringField(overlaysInput.title, 'overlays.title', problems)
  const aiLabel = overlaysInput.aiLabel === null || overlaysInput.aiLabel === undefined ? null : stringField(overlaysInput.aiLabel, 'overlays.aiLabel', problems)
  const videos = Array.isArray(input.videos) ? input.videos.map((item, index) => parseVideo(item, index, problems)).filter((item): item is LibraryVideo => item !== null) : (problems.push('videos must be an array'), [])
  const audios = Array.isArray(input.audios) ? input.audios.map((item, index) => parseAudio(item, index, problems)).filter((item): item is LibraryAudio => item !== null) : (problems.push('audios must be an array'), [])
  if (videos.length === 0) problems.push('at least one video is required')
  if (audios.length === 0) problems.push('at least one audio is required')
  duplicateIds(videos, 'video', problems)
  duplicateIds(audios, 'audio', problems)
  for (const item of [...videos, ...audios]) if (!(item.weight > 0) || !Number.isFinite(item.weight)) problems.push(`${item.id} weight must be greater than 0`)
  const allowUnequalWeights = input.allowUnequalWeights === true
  if (!allowUnequalWeights) { equalEnabledWeights(videos, 'video', problems); equalEnabledWeights(audios, 'audio', problems) }
  if (videos.some((item) => item.aiGenerated) && aiLabel === null) problems.push('overlays.aiLabel is required when a video is AI generated')

  const wordsPath = resolve(new URL('.', import.meta.url).pathname, '../forbidden-words.txt')
  try {
    const words = parseWords(readFileSync(wordsPath, 'utf8'))
    for (const hit of findForbidden(`${album.title}\n${copy.inviteLine}`, words)) problems.push(`forbidden word in ${hit.text}: ${hit.word}`)
  } catch {
    problems.push('unable to read scripts/forbidden-words.txt')
  }
  if (problems.length > 0) return { value: null, problems }
  return { value: { version, album, copy, timeline: { loopMode }, layout, overlays: { title, aiLabel }, allowUnequalWeights, videos, audios }, problems: [] }
}

export function loadLibrary(filePath: string): LibraryResult {
  try {
    return parseLibrary(JSON.parse(readFileSync(filePath, 'utf8')) as unknown)
  } catch (error) {
    return { value: null, problems: [`cannot read library: ${error instanceof Error ? error.message : String(error)}`] }
  }
}
