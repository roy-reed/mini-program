// 此文件由 npm run assets -- manifest 生成，请勿手改
import type { Manifest } from '../core/manifest-types'

export const MANIFEST: Manifest = {
  "version": 1,
  "generatedAt": "2026-10-28T23:08:16.953Z",
  "base": "https://example.invalid/shared-chord",
  "album": {
    "title": "【待填】专辑名",
    "releaseDate": "【待填】2026.11"
  },
  "copy": {
    "inviteLine": "诚邀 {name} 收听"
  },
  "layout": {
    "nameTopPct": 0.7,
    "nameMaxRpx": 44,
    "nameMinRpx": 28
  },
  "titleBaked": false,
  "videos": [
    {
      "id": "door",
      "textColor": "#FFFFFF",
      "aiGenerated": true,
      "weight": 1
    },
    {
      "id": "swing",
      "textColor": "#3B2A1A",
      "aiGenerated": true,
      "weight": 1
    }
  ],
  "audios": [
    {
      "id": "track01",
      "weight": 1
    },
    {
      "id": "track02",
      "weight": 1
    },
    {
      "id": "track03",
      "weight": 1
    },
    {
      "id": "track04",
      "weight": 1
    }
  ],
  "combos": {
    "door__track01": {
      "key": "door__track01",
      "videoId": "door",
      "audioId": "track01",
      "url": "https://example.invalid/shared-chord/v1/combos/door__track01.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/door__track01.jpg",
      "playMs": 34400,
      "loopMs": 2000,
      "durationMs": 37400,
      "sizeBytes": 8435378
    },
    "door__track02": {
      "key": "door__track02",
      "videoId": "door",
      "audioId": "track02",
      "url": "https://example.invalid/shared-chord/v1/combos/door__track02.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/door__track02.jpg",
      "playMs": 37100,
      "loopMs": 2000,
      "durationMs": 40100,
      "sizeBytes": 9072805
    },
    "door__track03": {
      "key": "door__track03",
      "videoId": "door",
      "audioId": "track03",
      "url": "https://example.invalid/shared-chord/v1/combos/door__track03.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/door__track03.jpg",
      "playMs": 35100,
      "loopMs": 2000,
      "durationMs": 38100,
      "sizeBytes": 8590446
    },
    "door__track04": {
      "key": "door__track04",
      "videoId": "door",
      "audioId": "track04",
      "url": "https://example.invalid/shared-chord/v1/combos/door__track04.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/door__track04.jpg",
      "playMs": 34100,
      "loopMs": 2000,
      "durationMs": 37100,
      "sizeBytes": 8353677
    },
    "swing__track01": {
      "key": "swing__track01",
      "videoId": "swing",
      "audioId": "track01",
      "url": "https://example.invalid/shared-chord/v1/combos/swing__track01.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/swing__track01.jpg",
      "playMs": 34400,
      "loopMs": 5000,
      "durationMs": 37400,
      "sizeBytes": 1173081
    },
    "swing__track02": {
      "key": "swing__track02",
      "videoId": "swing",
      "audioId": "track02",
      "url": "https://example.invalid/shared-chord/v1/combos/swing__track02.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/swing__track02.jpg",
      "playMs": 37100,
      "loopMs": 5000,
      "durationMs": 40100,
      "sizeBytes": 1258773
    },
    "swing__track03": {
      "key": "swing__track03",
      "videoId": "swing",
      "audioId": "track03",
      "url": "https://example.invalid/shared-chord/v1/combos/swing__track03.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/swing__track03.jpg",
      "playMs": 35100,
      "loopMs": 5000,
      "durationMs": 38100,
      "sizeBytes": 1192870
    },
    "swing__track04": {
      "key": "swing__track04",
      "videoId": "swing",
      "audioId": "track04",
      "url": "https://example.invalid/shared-chord/v1/combos/swing__track04.mp4",
      "posterUrl": "https://example.invalid/shared-chord/v1/posters/swing__track04.jpg",
      "playMs": 34100,
      "loopMs": 5000,
      "durationMs": 37100,
      "sizeBytes": 1159030
    }
  }
}
