export interface ManifestVideo {
  id: string
  textColor: string
  aiGenerated: boolean
  weight: number
}

export interface ManifestAudio {
  id: string
  weight: number
}

export interface ManifestCombo {
  key: string
  videoId: string
  audioId: string
  url: string
  posterUrl: string
  playMs: number
  loopMs: number
  durationMs: number
  sizeBytes: number
}

export interface Manifest {
  version: number
  generatedAt: string
  base: string
  album: { title: string; releaseDate: string }
  copy: { inviteLine: string }
  layout: { nameTopPct: number; nameMaxRpx: number; nameMinRpx: number }
  titleBaked: boolean
  videos: ManifestVideo[]
  audios: ManifestAudio[]
  combos: Record<string, ManifestCombo>
}
