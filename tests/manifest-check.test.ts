import { describe, expect, it } from 'vitest'
import { validateManifest } from '../miniprogram/core/manifest-check'
import { FIXTURE_MANIFEST } from './fixtures/manifest'

describe('manifest-check', () => {
  it('accepts the complete fixture', () => {
    expect(validateManifest(FIXTURE_MANIFEST)).toEqual([])
  })

  it.each([
    ['missing combo', (manifest: typeof FIXTURE_MANIFEST) => { const copy = structuredClone(manifest); delete copy.combos['door__track-one']; return copy }, 'missing combo'],
    ['invalid id', (manifest: typeof FIXTURE_MANIFEST) => { const copy = structuredClone(manifest); copy.videos[0].id = 'door_bad'; return copy }, 'id is invalid'],
    ['invalid color', (manifest: typeof FIXTURE_MANIFEST) => { const copy = structuredClone(manifest); copy.videos[0].textColor = 'red'; return copy }, 'textColor is invalid'],
    ['missing name variable', (manifest: typeof FIXTURE_MANIFEST) => { const copy = structuredClone(manifest); copy.copy.inviteLine = '诚邀收听'; return copy }, 'copy.inviteLine must contain {name}'],
    ['invalid duration', (manifest: typeof FIXTURE_MANIFEST) => { const copy = structuredClone(manifest); copy.combos['door__track-one'].durationMs = 100; return copy }, 'durationMs is out of range'],
    ['invalid url', (manifest: typeof FIXTURE_MANIFEST) => { const copy = structuredClone(manifest); copy.combos['door__track-one'].url = 'https://other.invalid/file.mp4'; return copy }, 'url must start with base'],
  ] as const)('reports %s', (_name, mutate, expected) => {
    expect(validateManifest(mutate(FIXTURE_MANIFEST)).some((problem) => problem.includes(expected))).toBe(true)
  })
})
