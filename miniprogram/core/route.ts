import type { Manifest } from './manifest-types'
import type { Profile, StoredInvitation } from './schema'

export type Entry = 'login' | 'name' | 'draw' | 'invitation'

export interface EntryInput {
  profile: Profile | null
  invitation: StoredInvitation | null
  manifest: Manifest
  needPrivacyAuth: boolean
}

export interface EntryDecision {
  entry: Entry
  redraw: boolean
}

export function decideEntry(input: EntryInput): EntryDecision {
  if (input.profile === null) return { entry: 'login', redraw: false }
  if (input.needPrivacyAuth) return { entry: 'login', redraw: false }
  if (input.profile.name === '') return { entry: 'name', redraw: false }
  if (input.invitation === null) return { entry: 'draw', redraw: false }
  const combo = input.manifest.combos[input.invitation.comboKey]
  if (combo === undefined || combo.videoId !== input.invitation.videoId || combo.audioId !== input.invitation.audioId) {
    return { entry: 'draw', redraw: true }
  }
  return { entry: 'invitation', redraw: false }
}
