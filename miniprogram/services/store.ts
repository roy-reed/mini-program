import type { DrawResult } from '../core/draw'
import { parseInvitation, parseProfile, toStoredInvitation, type Profile, type StoredInvitation } from '../core/schema'

export const PROFILE_KEY = 'sc.profile.v1'
export const INVITATION_KEY = 'sc.invitation.v1'

export function loadProfile(): Profile | null {
  try {
    return parseProfile(wx.getStorageSync(PROFILE_KEY))
  } catch (error) {
    console.warn('load profile failed', error)
    return null
  }
}

export function saveAgreement(now: number): Profile {
  const previous = loadProfile()
  const profile: Profile = { v: 1, agreedAt: now, name: previous?.name ?? '' }
  wx.setStorageSync(PROFILE_KEY, profile)
  return profile
}

export function saveName(name: string): Profile {
  const previous = loadProfile()
  if (previous === null || previous.agreedAt <= 0) throw new Error('cannot save name before agreement')
  const profile: Profile = { ...previous, name }
  wx.setStorageSync(PROFILE_KEY, profile)
  return profile
}

export function loadInvitation(): StoredInvitation | null {
  try {
    return parseInvitation(wx.getStorageSync(INVITATION_KEY))
  } catch (error) {
    console.warn('load invitation failed', error)
    return null
  }
}

export function saveInvitation(result: DrawResult): void {
  wx.setStorageSync(INVITATION_KEY, toStoredInvitation(result))
}

export function clearAll(): void {
  try {
    wx.removeStorageSync(PROFILE_KEY)
    wx.removeStorageSync(INVITATION_KEY)
  } catch (error) {
    console.warn('clear storage failed', error)
  }
}
