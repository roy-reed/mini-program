import { AUTO_OPEN_AFTER_DRAW, BURST_MS, SHARE_IMAGE, VIBRATE_ON_DRAW, ZOOM_MS } from '../../config'
import { COPY, t } from '../../core/copy'
import { drawInvitation } from '../../core/draw'
import { MANIFEST } from '../../data/manifest'
import { currentEntry, goEntry } from '../../services/nav'
import { saveInvitation } from '../../services/store'

type DrawPhase = 'idle' | 'zoom' | 'burst'
type DrawData = { copy: typeof COPY; phase: DrawPhase; disabled: boolean; burstMs: number }
type PageQuery = Record<string, string | undefined>

Page({
  data: { copy: COPY, phase: 'idle', disabled: false, burstMs: BURST_MS } as DrawData,
  zoomTimer: null as ReturnType<typeof setTimeout> | null,
  redirectTimer: null as ReturnType<typeof setTimeout> | null,

  async onLoad(query: PageQuery) {
    const decision = await currentEntry()
    if (decision.entry !== 'draw') { goEntry(decision); return }
    if (query.redraw === '1') wx.showToast({ title: COPY.draw.redrawNotice, icon: 'none', duration: 2500 })
    const disabled = MANIFEST.videos.length === 0 || MANIFEST.audios.length === 0
    if (disabled) console.error('draw is disabled because the manifest has no videos or audios')
    this.setData({ disabled })
  },

  onDraw() {
    if (this.data.phase !== 'idle' || this.data.disabled) return
    this.setData({ phase: 'zoom' })
    this.zoomTimer = setTimeout(() => {
      try {
        const result = drawInvitation(MANIFEST, Math.random, Date.now())
        saveInvitation(result)
        if (VIBRATE_ON_DRAW) wx.vibrateShort({ type: 'light' })
        this.setData({ phase: 'burst' })
        this.redirectTimer = setTimeout(() => goEntry({ entry: 'invitation', redraw: false }, { autoOpen: AUTO_OPEN_AFTER_DRAW }), BURST_MS)
      } catch (error) {
        console.error('draw failed', error)
        this.setData({ phase: 'idle' })
      }
    }, ZOOM_MS)
  },

  onRules() {
    wx.showModal({ title: COPY.draw.rules, content: t('draw.rulesBody', { videos: MANIFEST.videos.length, audios: MANIFEST.audios.length }), showCancel: false, confirmText: COPY.common.ok })
  },

  onUnload() {
    if (this.zoomTimer !== null) clearTimeout(this.zoomTimer)
    if (this.redirectTimer !== null) clearTimeout(this.redirectTimer)
  },

  onShareAppMessage() {
    return { title: COPY.share.title, path: '/pages/login/index', imageUrl: SHARE_IMAGE }
  },
})
