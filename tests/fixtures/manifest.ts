import type { Manifest } from '../../miniprogram/core/manifest-types'

export const FIXTURE_MANIFEST: Manifest = {
  version: 1,
  generatedAt: '2026-10-28T00:00:00.000Z',
  base: 'https://example.invalid/shared-chord',
  album: { title: 'Demo Album', releaseDate: '2026.10' },
  copy: { inviteLine: '诚邀 {name} 收听' },
  layout: { nameTopPct: 0.7, nameMaxRpx: 44, nameMinRpx: 28 },
  titleBaked: false,
  videos: [
    { id: 'door', textColor: '#FFFFFF', aiGenerated: true, weight: 1 },
    { id: 'swing', textColor: '#3B2A1A', aiGenerated: false, weight: 1 },
  ],
  audios: [
    { id: 'track-one', weight: 1 },
    { id: 'track-two', weight: 1 },
  ],
  combos: Object.fromEntries(['door', 'swing'].flatMap((videoId) => ['track-one', 'track-two'].map((audioId) => {
    const key = `${videoId}__${audioId}`
    return [key, { key, videoId, audioId, url: `https://example.invalid/shared-chord/v1/combos/${key}.mp4`, posterUrl: `https://example.invalid/shared-chord/v1/posters/${key}.jpg`, playMs: 12000, loopMs: 4000, durationMs: 15000, sizeBytes: 1000 }]
  }))),
}
