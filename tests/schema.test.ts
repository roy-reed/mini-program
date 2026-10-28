import { describe, expect, it } from 'vitest'
import { parseInvitation, parseProfile, toStoredInvitation } from '../miniprogram/core/schema'

describe('schema', () => {
  it('parses valid records and converts draw results', () => {
    expect(parseProfile({ v: 1, agreedAt: 1, name: '' })).toEqual({ v: 1, agreedAt: 1, name: '' })
    expect(parseInvitation({ v: 1, videoId: 'door', audioId: 'track-one', comboKey: 'door__track-one', drawnAt: 2, manifestVersion: 1 })).not.toBeNull()
    expect(toStoredInvitation({ videoId: 'door', audioId: 'track-one', comboKey: 'door__track-one', drawnAt: 2, manifestVersion: 1 })).toEqual({ v: 1, videoId: 'door', audioId: 'track-one', comboKey: 'door__track-one', drawnAt: 2, manifestVersion: 1 })
  })

  it.each([null, 'value', { v: 2, agreedAt: 1, name: '' }, { v: 1, agreedAt: 0, name: '' }, { v: 1, agreedAt: 1, name: 2 }])('rejects invalid profile %j', (value) => {
    expect(parseProfile(value)).toBeNull()
  })

  it.each([null, 'value', { v: 2 }, { v: 1, videoId: 'door' }, { v: 1, videoId: 'door', audioId: 'a', comboKey: 'k', drawnAt: 0, manifestVersion: 1 }])('rejects invalid invitation %j', (value) => {
    expect(parseInvitation(value)).toBeNull()
  })
})
