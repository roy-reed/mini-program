import { AUTO_OPEN_AFTER_DRAW, BURST_MS, SHARE_IMAGE, VIBRATE_ON_DRAW, ZOOM_MS } from '../../config'
import { COPY, t } from '../../core/copy'
import { drawInvitation, redrawInvitation, selectInvitation } from '../../core/draw'
import { MANIFEST } from '../../data/manifest'
import { resolveCloudUrls } from '../../services/media'
import { currentEntry, goEntry, PAGES } from '../../services/nav'
import { loadInvitation, saveInvitation } from '../../services/store'

type DrawPhase = 'idle' | 'zoom' | 'burst'
type ChoiceItem = { id: string; label: string; posterUrl: string }
type DrawData = {
  copy: typeof COPY
  phase: DrawPhase
  disabled: boolean
  burstMs: number
  choosing: boolean
  changingExisting: boolean
  selectedVideoId: string
  selectedAudioId: string
  backgrounds: ChoiceItem[]
  tracks: ChoiceItem[]
  posterError: boolean
}
type PageQuery = Record<string, string | undefined>
type ChoiceEvent = WechatMiniprogram.TouchEvent

function choiceLabel(id: string): string {
  const names: Record<string, string> = {
    door: COPY.select.door, swing: COPY.select.swing,
    carousel: COPY.select.carousel, ferris: COPY.select.ferris,
    track01: COPY.select.track01, track02: COPY.select.track02,
    track03: COPY.select.track03, track04: COPY.select.track04,
  }
  return names[id] ?? id
}

Page({
  data: {
    copy: COPY, phase: 'idle', disabled: false, burstMs: BURST_MS,
    choosing: false, changingExisting: false,
    selectedVideoId: '', selectedAudioId: '',
    backgrounds: [], tracks: [], posterError: false,
  } as DrawData,

  zoomTimer: null as ReturnType<typeof setTimeout> | null,
  redirectTimer: null as ReturnType<typeof setTimeout> | null,
  disposed: false,

  async onLoad(query: PageQuery) {
    const decision = await currentEntry()
    const choosingExisting = query.choose === '1' && decision.entry === 'invitation'
    if (decision.entry !== 'draw' && !choosingExisting) {
      goEntry(decision)
      return
    }

    const disabled = MANIFEST.videos.length === 0 || MANIFEST.audios.length === 0
    if (disabled) console.error('draw is disabled because the manifest has no videos or audios')
    if (query.redraw === '1') wx.showToast({ title: COPY.draw.redrawNotice, icon: 'none', duration: 2500 })

    const firstAudioId = MANIFEST.audios[0]?.id ?? ''
    const backgrounds = MANIFEST.videos.map((video) => ({
      id: video.id,
      label: choiceLabel(video.id),
      posterUrl: MANIFEST.combos[`${video.id}__${firstAudioId}`]?.posterUrl ?? '',
    }))
    const tracks = MANIFEST.audios.map((audio) => ({
      id: audio.id, label: choiceLabel(audio.id), posterUrl: '',
    }))
    const previous = loadInvitation()
    const selectedVideoId = choosingExisting && MANIFEST.videos.some((video) => video.id === previous?.videoId)
      ? String(previous?.videoId) : (MANIFEST.videos[0]?.id ?? '')
    const selectedAudioId = choosingExisting && MANIFEST.audios.some((audio) => audio.id === previous?.audioId)
      ? String(previous?.audioId) : firstAudioId

    this.setData({
      disabled, choosing: choosingExisting, changingExisting: choosingExisting,
      backgrounds, tracks, selectedVideoId, selectedAudioId,
    })
    void this.loadPosters(backgrounds)
  },

  async loadPosters(backgrounds: ChoiceItem[]) {
    try {
      const posters = await resolveCloudUrls(backgrounds.map((item) => item.posterUrl))
      if (this.disposed) return
      this.setData({ backgrounds: backgrounds.map((item, index) => ({ ...item, posterUrl: posters[index] })) })
    } catch (error) {
      if (this.disposed) return
      console.warn('style poster loading failed', error instanceof Error ? error.message : String(error))
      this.setData({ posterError: true })
    }
  },

  onShowChoices() {
    if (this.data.disabled || this.data.phase !== 'idle') return
    this.setData({ choosing: true })
  },

  onSelectBackground(event: ChoiceEvent) {
    this.setData({ selectedVideoId: String(event.currentTarget.dataset.id ?? '') })
  },

  onSelectTrack(event: ChoiceEvent) {
    this.setData({ selectedAudioId: String(event.currentTarget.dataset.id ?? '') })
  },

  onConfirmChoice() {
    if (this.data.disabled || !this.data.choosing || this.data.phase !== 'idle') return
    try {
      const chosen = selectInvitation(MANIFEST, this.data.selectedVideoId, this.data.selectedAudioId, Date.now())
      saveInvitation(chosen)
      goEntry({ entry: 'invitation', redraw: false }, { autoOpen: AUTO_OPEN_AFTER_DRAW })
    } catch (error) {
      console.error('style selection failed', error)
      wx.showToast({ title: COPY.select.chooseError, icon: 'none' })
    }
  },

  onCancelChoice() {
    if (this.data.changingExisting) {
      wx.redirectTo({ url: PAGES.invitation })
      return
    }
    this.setData({ choosing: false })
  },

  onDraw() {
    if (this.data.phase !== 'idle' || this.data.disabled) return
    this.setData({ phase: 'zoom', choosing: false })
    this.zoomTimer = setTimeout(() => {
      try {
        const previous = loadInvitation()?.comboKey ?? null
        const result = previous === null
          ? drawInvitation(MANIFEST, Math.random, Date.now())
          : redrawInvitation(MANIFEST, Math.random, Date.now(), previous)
        saveInvitation(result)
        if (VIBRATE_ON_DRAW) wx.vibrateShort({ type: 'light' })
        this.setData({ phase: 'burst' })
        this.redirectTimer = setTimeout(
          () => goEntry({ entry: 'invitation', redraw: false }, { autoOpen: AUTO_OPEN_AFTER_DRAW }),
          BURST_MS,
        )
      } catch (error) {
        console.error('draw failed', error)
        this.setData({ phase: 'idle' })
      }
    }, ZOOM_MS)
  },

  onRules() {
    wx.showModal({
      title: COPY.draw.rules,
      content: t('draw.rulesBody', { videos: MANIFEST.videos.length, audios: MANIFEST.audios.length }),
      showCancel: false, confirmText: COPY.common.ok,
    })
  },

  onUnload() {
    this.disposed = true
    if (this.zoomTimer !== null) clearTimeout(this.zoomTimer)
    if (this.redirectTimer !== null) clearTimeout(this.redirectTimer)
  },

  onShareAppMessage() {
    return { title: COPY.share.title, path: PAGES.login, imageUrl: SHARE_IMAGE }
  },
})
