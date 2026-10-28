import { decideEntry, type EntryDecision } from '../core/route'
import { MANIFEST } from '../data/manifest'
import { needPrivacyAuthorization } from './privacy'
import { loadInvitation, loadProfile } from './store'

export const PAGES = {
  login: '/pages/login/index',
  draw: '/pages/draw/index',
  invitation: '/pages/invitation/index',
  legal: '/pages/legal/index',
} as const

export async function currentEntry(): Promise<EntryDecision> {
  return decideEntry({
    profile: loadProfile(),
    invitation: loadInvitation(),
    manifest: MANIFEST,
    needPrivacyAuth: await needPrivacyAuthorization(),
  })
}

export function urlForEntry(decision: EntryDecision, options: { autoOpen?: boolean } = {}): string {
  if (decision.entry === 'login' || decision.entry === 'name') return PAGES.login
  if (decision.entry === 'draw') return `${PAGES.draw}${decision.redraw ? '?redraw=1' : ''}`
  return `${PAGES.invitation}${options.autoOpen ? '?autoOpen=1' : ''}`
}

export function goEntry(decision: EntryDecision, options: { autoOpen?: boolean } = {}): void {
  wx.redirectTo({ url: urlForEntry(decision, options) })
}
