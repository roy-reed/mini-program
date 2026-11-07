import { describe, expect, it } from 'vitest'
import { redrawInvitation, selectInvitation } from '../miniprogram/core/draw'
import { FIXTURE_MANIFEST } from './fixtures/manifest'

describe('invitation selection and repeat draws', () => {
  const videoId = FIXTURE_MANIFEST.videos[0].id
  const audioId = FIXTURE_MANIFEST.audios[0].id
  const firstKey = `${videoId}__${audioId}`

  it('selects an explicit combination from the manifest', () => {
    expect(selectInvitation(FIXTURE_MANIFEST, videoId, audioId, 100)).toEqual({
      videoId, audioId, comboKey: firstKey, drawnAt: 100, manifestVersion: FIXTURE_MANIFEST.version,
    })
  })

  it('rejects unknown or missing combinations', () => {
    expect(() => selectInvitation(FIXTURE_MANIFEST, 'absent', audioId, 100)).toThrow('unknown background')
    expect(() => selectInvitation(FIXTURE_MANIFEST, videoId, 'absent', 100)).toThrow('unknown music')
    expect(() => selectInvitation({
      ...FIXTURE_MANIFEST,
      combos: { ...FIXTURE_MANIFEST.combos, [firstKey]: undefined } as typeof FIXTURE_MANIFEST.combos,
    }, videoId, audioId, 100)).toThrow('combo is missing')
  })

  it('does not repeat the previous combo when other choices exist', () => {
    for (const random of [0, 0.1, 0.5, 0.999999]) {
      const picked = redrawInvitation(FIXTURE_MANIFEST, () => random, 200, firstKey)
      expect(picked.comboKey).not.toBe(firstKey)
      expect(FIXTURE_MANIFEST.combos[picked.comboKey]).toBeDefined()
    }
  })

  it('allows the only available combo when no alternative exists', () => {
    const one = { ...FIXTURE_MANIFEST,
      videos: FIXTURE_MANIFEST.videos.slice(0, 1),
      audios: FIXTURE_MANIFEST.audios.slice(0, 1),
      combos: { [firstKey]: FIXTURE_MANIFEST.combos[firstKey] },
    }
    expect(redrawInvitation(one, () => 0.7, 200, firstKey).comboKey).toBe(firstKey)
  })
})
