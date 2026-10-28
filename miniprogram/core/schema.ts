import type { DrawResult } from './draw'

export interface Profile {
  v: 1
  agreedAt: number
  name: string
}

export interface StoredInvitation {
  v: 1
  videoId: string
  audioId: string
  comboKey: string
  drawnAt: number
  manifestVersion: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseProfile(raw: unknown): Profile | null {
  if (!isRecord(raw) || raw.v !== 1 || typeof raw.agreedAt !== 'number' || !Number.isFinite(raw.agreedAt) || raw.agreedAt <= 0 || typeof raw.name !== 'string') {
    return null
  }
  return { v: 1, agreedAt: raw.agreedAt, name: raw.name }
}

export function parseInvitation(raw: unknown): StoredInvitation | null {
  if (!isRecord(raw) || raw.v !== 1 || typeof raw.videoId !== 'string' || typeof raw.audioId !== 'string' || typeof raw.comboKey !== 'string' || typeof raw.drawnAt !== 'number' || !Number.isFinite(raw.drawnAt) || raw.drawnAt <= 0 || typeof raw.manifestVersion !== 'number' || !Number.isInteger(raw.manifestVersion) || raw.manifestVersion < 0) {
    return null
  }
  return {
    v: 1,
    videoId: raw.videoId,
    audioId: raw.audioId,
    comboKey: raw.comboKey,
    drawnAt: raw.drawnAt,
    manifestVersion: raw.manifestVersion,
  }
}

export function toStoredInvitation(result: DrawResult): StoredInvitation {
  return { v: 1, ...result }
}
