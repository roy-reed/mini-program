import { ENVELOPE_ANIM_MS, MEDIA_LOAD_TIMEOUT_MS, MEDIA_PLAY_FALLBACK_MS, MEDIA_SLOW_HINT_MS, SHARE_IMAGE } from '../../config'
import { COPY, t } from '../../core/copy'
import { fitFontRpx, buildInviteText } from '../../core/fit'
import { layoutFor } from '../../core/layout'
import { stateAt, buildTimeline, type Timeline } from '../../core/timeline'
import { MANIFEST } from '../../data/manifest'
import { currentEntry, goEntry, PAGES } from '../../services/nav'
import { loadInvitation, loadProfile } from '../../services/store'
import { resolveMediaSources } from '../../services/media'

type EnvelopeState = 'closed' | 'opening' | 'open' | 'closing'
type PlayerStatus = 'idle' | 'loading' | 'buffering' | 'playing' | 'error'
type InvitationData = {
  copy: typeof COPY
  ready: boolean
  env: EnvelopeState
  status: PlayerStatus
  showVideo: boolean
  slowLoading: boolean
  videoUrl: string
  posterUrl: string
  toText: string
  inviteText: string
  nameColor: string
  nameFontRpx: number
  nameTopPct: number
  nameOpacity: number
  playerWidthRpx: number
  playerHeightRpx: number
  showHeader: boolean
  albumTitle: string
  releaseText: string
  aiNotice: boolean
  envelopeMs: number
}
type PageQuery = Record<string, string | undefined>

Page({
  data: {
    copy: COPY,
    ready: false,
    env: 'closed',
    status: 'idle',
    showVideo: false,
    slowLoading: false,
    videoUrl: '',
    posterUrl: '',
    toText: '',
    inviteText: '',
    nameColor: '#FFFFFF',
    nameFontRpx: 44,
    nameTopPct: 0.7,
    nameOpacity: 0,
    playerWidthRpx: 600,
    playerHeightRpx: 800,
    showHeader: true,
    albumTitle: '',
    releaseText: '',
    aiNotice: false,
    envelopeMs: ENVELOPE_ANIM_MS,
  } as InvitationData,

  timeline: null as Timeline | null,
  videoCtx: null as WechatMiniprogram.VideoContext | null,
  wasPlaying: false,
  openTimer: null as ReturnType<typeof setTimeout> | null,
  closeTimer: null as ReturnType<typeof setTimeout> | null,
  playTimer: null as ReturnType<typeof setTimeout> | null,
  loadTimer: null as ReturnType<typeof setTimeout> | null,
  hintTimer: null as ReturnType<typeof setTimeout> | null,
  sourceVideoUrl: '',
  sourcePosterUrl: '',
  mediaRequestId: 0,
  mediaError: false,
  playRequested: false,
  hasStarted: false,
  disposed: false,
  visible: true,

  async onLoad(query: PageQuery) {
    const decision = await currentEntry()
    if (decision.entry !== 'invitation') { goEntry(decision); return }
    const stored = loadInvitation()
    const combo = stored === null ? undefined : MANIFEST.combos[stored.comboKey]
    const video = combo === undefined ? undefined : MANIFEST.videos.find((item) => item.id === combo.videoId)
    if (stored === null || combo === undefined || video === undefined) {
      goEntry({ entry: 'draw', redraw: true })
      return
    }
    const windowInfo = wx.getWindowInfo()
    const playerLayout = layoutFor(windowInfo.windowWidth, windowInfo.windowHeight)
    this.timeline = buildTimeline({ audioMs: combo.playMs, loopMs: combo.loopMs })
    this.sourceVideoUrl = combo.url
    this.sourcePosterUrl = combo.posterUrl
    this.setData({
      ready: true,
      videoUrl: '',
      posterUrl: '',
      nameColor: video.textColor,
      nameTopPct: MANIFEST.layout.nameTopPct,
      playerWidthRpx: playerLayout.playerWidthRpx,
      playerHeightRpx: playerLayout.playerHeightRpx,
      showHeader: !MANIFEST.titleBaked,
      albumTitle: MANIFEST.album.title,
      releaseText: t('inv.release', { date: MANIFEST.album.releaseDate }),
      aiNotice: video.aiGenerated,
    }, () => {
      this.refreshName()
      void this.prepareMedia()
      if (query.autoOpen === '1') this.open()
    })
  },

  refreshName() {
    const profile = loadProfile()
    const name = profile?.name ?? ''
    const inviteText = buildInviteText(MANIFEST.copy.inviteLine, name)
    this.setData({
      inviteText,
      toText: t('inv.to', { name }),
      nameFontRpx: fitFontRpx(inviteText, this.data.playerWidthRpx - 80, MANIFEST.layout.nameMaxRpx, MANIFEST.layout.nameMinRpx),
    })
  },

  async prepareMedia() {
    const requestId = ++this.mediaRequestId
    try {
      const sources = await resolveMediaSources(this.sourceVideoUrl, this.sourcePosterUrl)
      if (this.disposed || requestId !== this.mediaRequestId) return
      if (this.data.status === 'error' && this.data.env === 'open') return
      this.mediaError = false
      this.setData({ videoUrl: sources.videoUrl, posterUrl: sources.posterUrl }, () => {
        this.schedulePlay()
      })
    } catch (error) {
      if (this.disposed || requestId !== this.mediaRequestId) return
      console.error('invitation media resolution failed', error instanceof Error ? error.message : String(error))
      this.mediaError = true
      this.clearPlayerTimers()
      this.setData({ status: 'error' })
    }
  },

  clearPlayerTimers() {
    if (this.playTimer !== null) clearTimeout(this.playTimer)
    if (this.loadTimer !== null) clearTimeout(this.loadTimer)
    if (this.hintTimer !== null) clearTimeout(this.hintTimer)
    this.playTimer = null
    this.loadTimer = null
    this.hintTimer = null
  },

  startSlowHint() {
    if (this.hintTimer !== null || !this.visible || this.data.status !== 'loading') return
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null
      if (this.visible && this.data.env === 'open' && this.data.status === 'loading') {
        this.setData({ slowLoading: true })
      }
    }, MEDIA_SLOW_HINT_MS)
  },

  showLoadError(reason: string) {
    if (this.data.env !== 'open' || this.data.status === 'error') return
    console.error('invitation media playback failed', reason)
    this.mediaRequestId += 1
    this.mediaError = true
    this.playRequested = false
    this.clearPlayerTimers()
    if (this.videoCtx !== null) this.videoCtx.stop()
    this.videoCtx = null
    this.setData({ showVideo: false, status: 'error', slowLoading: false })
  },

  startLoadTimer() {
    if (this.loadTimer !== null || !this.visible) return
    this.loadTimer = setTimeout(() => {
      this.loadTimer = null
      if (this.visible && this.data.env === 'open' && (this.data.status === 'loading' || this.data.status === 'buffering')) {
        this.showLoadError('loading timed out')
      }
    }, MEDIA_LOAD_TIMEOUT_MS)
  },

  requestPlay(force = false) {
    if ((this.playRequested && !force) || !this.visible || this.data.env !== 'open' || !this.data.showVideo || !this.data.videoUrl || this.mediaError || this.data.status === 'error') return
    if (this.playTimer !== null) clearTimeout(this.playTimer)
    this.playTimer = null
    this.playRequested = true
    if (this.videoCtx === null) this.videoCtx = wx.createVideoContext('player', this)
    this.videoCtx.play()
  },

  schedulePlay() {
    if (this.playRequested || !this.visible || this.data.env !== 'open' || !this.data.showVideo || !this.data.videoUrl || this.mediaError || this.data.status === 'error') return
    if (this.playTimer !== null) clearTimeout(this.playTimer)
    this.playTimer = setTimeout(() => this.requestPlay(), MEDIA_PLAY_FALLBACK_MS)
  },

  open() {
    if (this.data.env !== 'closed') return
    this.setData({ env: 'opening' })
    this.openTimer = setTimeout(() => {
      this.playRequested = false
      this.hasStarted = false
      this.setData({ env: 'open', showVideo: true, status: this.mediaError ? 'error' : 'loading', slowLoading: false, nameOpacity: 0 }, () => {
        if (!this.mediaError) {
          this.startLoadTimer()
          this.startSlowHint()
          this.schedulePlay()
        }
      })
    }, ENVELOPE_ANIM_MS)
  },

  close() {
    this.clearPlayerTimers()
    this.playRequested = false
    this.hasStarted = false
    this.wasPlaying = false
    if (this.videoCtx !== null) this.videoCtx.stop()
    this.videoCtx = null
    this.setData({ showVideo: false, status: 'idle', slowLoading: false, nameOpacity: 0, env: 'closing' })
    this.closeTimer = setTimeout(() => this.setData({ env: 'closed' }), ENVELOPE_ANIM_MS)
  },

  onToggleEnvelope() {
    if (this.data.env === 'closed') this.open()
    else if (this.data.env === 'open') this.close()
  },

  onVideoLoaded() {
    if (this.data.status === 'loading' && !this.mediaError) this.requestPlay(true)
  },

  onTapPlay() {
    if (this.data.status !== 'loading' || !this.data.videoUrl || this.mediaError) return
    this.requestPlay(true)
  },

  onVideoPlay() {
    if (this.data.env !== 'open' || this.mediaError || this.data.status === 'error') return
    this.clearPlayerTimers()
    this.hasStarted = true
    this.wasPlaying = true
    this.setData({ status: 'playing', slowLoading: false })
  },

  onVideoWaiting() {
    if (this.data.env !== 'open' || !this.visible || this.mediaError || this.data.status === 'error') return
    const status = this.hasStarted ? 'buffering' : 'loading'
    this.setData({ status })
    this.startLoadTimer()
    if (status === 'loading') this.startSlowHint()
  },

  onVideoError(event: WechatMiniprogram.VideoError) {
    if (this.data.env !== 'open' || !this.data.showVideo || this.mediaError) return
    this.showLoadError(JSON.stringify(event.detail))
  },

  onTimeUpdate(event: WechatMiniprogram.VideoTimeUpdate) {
    if (this.timeline === null || this.data.env !== 'open' || this.mediaError || this.data.status === 'error') return
    this.clearPlayerTimers()
    this.hasStarted = true
    const state = stateAt(this.timeline, event.detail.currentTime * 1000)
    const opacity = Math.round(state.opacity * 50) / 50
    if (Math.abs(opacity - this.data.nameOpacity) >= 0.02 || this.data.status !== 'playing') {
      this.setData({ status: 'playing', slowLoading: false, nameOpacity: opacity })
    }
  },

  onRetry() {
    if (this.data.env !== 'open') return
    this.mediaRequestId += 1
    this.clearPlayerTimers()
    this.playRequested = false
    this.hasStarted = false
    this.mediaError = true
    if (this.videoCtx !== null) this.videoCtx.stop()
    this.videoCtx = null
    this.setData({ showVideo: false, videoUrl: '', status: 'loading', slowLoading: false, nameOpacity: 0 }, () => {
      this.mediaError = false
      this.setData({ showVideo: true }, () => {
        this.startLoadTimer()
        this.startSlowHint()
        void this.prepareMedia()
      })
    })
  },

  onChangeInvitation() {
    wx.redirectTo({ url: `${PAGES.draw}?choose=1` })
  },

  onChangeName() {
    wx.navigateTo({ url: `${PAGES.login}?edit=1` })
  },

  onLegal() {
    wx.navigateTo({ url: PAGES.legal })
  },

  onShow() {
    this.visible = true
    if (!this.data.ready) return
    this.refreshName()
    if (this.data.env === 'open' && this.data.status !== 'error') {
      if (this.wasPlaying && this.videoCtx !== null) {
        this.videoCtx.play()
      } else {
        this.playRequested = false
        this.schedulePlay()
      }
      if (this.data.status === 'loading' || this.data.status === 'buffering') {
        this.startLoadTimer()
        this.startSlowHint()
      }
    }
  },

  onHide() {
    this.visible = false
    this.clearPlayerTimers()
    if (this.data.env === 'open' && this.videoCtx !== null) {
      this.wasPlaying = this.data.status === 'playing'
      this.videoCtx.pause()
    }
  },

  onUnload() {
    this.disposed = true
    this.mediaRequestId += 1
    this.clearPlayerTimers()
    if (this.openTimer !== null) clearTimeout(this.openTimer)
    if (this.closeTimer !== null) clearTimeout(this.closeTimer)
    if (this.videoCtx !== null) this.videoCtx.stop()
  },

  onShareAppMessage() {
    return { title: COPY.share.title, path: PAGES.login, imageUrl: SHARE_IMAGE }
  },
})
