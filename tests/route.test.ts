import { describe, expect, it } from 'vitest'
import { decideEntry } from '../miniprogram/core/route'
import { FIXTURE_MANIFEST } from './fixtures/manifest'

const profile = { v: 1 as const, agreedAt: 1, name: '小明' }
const invitation = { v: 1 as const, videoId: 'door', audioId: 'track-one', comboKey: 'door__track-one', drawnAt: 2, manifestVersion: 1 }

describe('route', () => {
  it.each([
    [null, null, false, { entry: 'login', redraw: false }],
    [profile, null, true, { entry: 'login', redraw: false }],
    [{ ...profile, name: '' }, null, false, { entry: 'name', redraw: false }],
    [profile, null, false, { entry: 'draw', redraw: false }],
    [profile, { ...invitation, comboKey: 'missing' }, false, { entry: 'draw', redraw: true }],
    [profile, invitation, false, { entry: 'invitation', redraw: false }],
  ] as const)('follows rule %j', (storedProfile, storedInvitation, needPrivacyAuth, expected) => {
    expect(decideEntry({ profile: storedProfile, invitation: storedInvitation, manifest: FIXTURE_MANIFEST, needPrivacyAuth })).toEqual(expected)
  })

  it('prioritizes missing agreement over an existing invitation', () => {
    expect(decideEntry({ profile: null, invitation, manifest: FIXTURE_MANIFEST, needPrivacyAuth: false })).toEqual({ entry: 'login', redraw: false })
  })
})
