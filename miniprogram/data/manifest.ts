import type { Manifest } from '../core/manifest-types'

export const MANIFEST: Manifest = {
  version: 0,
  generatedAt: '',
  base: '',
  album: { title: '', releaseDate: '' },
  copy: { inviteLine: '' },
  layout: { nameTopPct: 0, nameMaxRpx: 0, nameMinRpx: 0 },
  titleBaked: false,
  videos: [],
  audios: [],
  combos: {},
}
