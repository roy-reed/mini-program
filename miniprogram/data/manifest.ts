// 此文件由 npm run assets -- manifest 生成，请勿手改
import type { Manifest } from '../core/manifest-types'

export const MANIFEST: Manifest = {
  "version": 0,
  "generatedAt": "2026-10-28T18:00:41.085Z",
  "base": "https://example.invalid/shared-chord",
  "album": {
    "title": "Sample Album",
    "releaseDate": "2026.10"
  },
  "copy": {
    "inviteLine": "Invite {name} to listen"
  },
  "layout": {
    "nameTopPct": 0.7,
    "nameMaxRpx": 44,
    "nameMinRpx": 28
  },
  "titleBaked": false,
  "videos": [
    {
      "id": "sample-a",
      "textColor": "#FFFFFF",
      "aiGenerated": true,
      "weight": 1
    },
    {
      "id": "sample-b",
      "textColor": "#3B2A1A",
      "aiGenerated": false,
      "weight": 1
    }
  ],
  "audios": [
    {
      "id": "sample-a",
      "weight": 1
    },
    {
      "id": "sample-b",
      "weight": 1
    }
  ],
  "combos": {
    "sample-a__sample-a": {
      "key": "sample-a__sample-a",
      "videoId": "sample-a",
      "audioId": "sample-a",
      "url": "https://example.invalid/shared-chord/v0/combos/sample-a__sample-a.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v0/posters/sample-a__sample-a.jpg",
      "playMs": 12000,
      "loopMs": 2000,
      "durationMs": 15000,
      "sizeBytes": 2920610
    },
    "sample-a__sample-b": {
      "key": "sample-a__sample-b",
      "videoId": "sample-a",
      "audioId": "sample-b",
      "url": "https://example.invalid/shared-chord/v0/combos/sample-a__sample-b.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v0/posters/sample-a__sample-b.jpg",
      "playMs": 15000,
      "loopMs": 2000,
      "durationMs": 18000,
      "sizeBytes": 3693872
    },
    "sample-b__sample-a": {
      "key": "sample-b__sample-a",
      "videoId": "sample-b",
      "audioId": "sample-a",
      "url": "https://example.invalid/shared-chord/v0/combos/sample-b__sample-a.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v0/posters/sample-b__sample-a.jpg",
      "playMs": 12000,
      "loopMs": 3000,
      "durationMs": 15000,
      "sizeBytes": 424182
    },
    "sample-b__sample-b": {
      "key": "sample-b__sample-b",
      "videoId": "sample-b",
      "audioId": "sample-b",
      "url": "https://example.invalid/shared-chord/v0/combos/sample-b__sample-b.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v0/posters/sample-b__sample-b.jpg",
      "playMs": 15000,
      "loopMs": 3000,
      "durationMs": 18000,
      "sizeBytes": 522787
    }
  }
}
