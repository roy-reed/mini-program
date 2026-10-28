import { ENVELOPE_ANIM_MS, SHARE_IMAGE } from '../../config'
import { COPY, t } from '../../core/copy'
import { fitFontRpx, buildInviteText } from '../../core/fit'
import { layoutFor } from '../../core/layout'
import { stateAt, buildTimeline, type Timeline } from '../../core/timeline'
import { MANIFEST } from '../../data/manifest'
import { currentEntry, goEntry, PAGES } from '../../services/nav'
import { loadInvitation, loadProfile } from '../../services/store'

type EnvelopeState = 'closed' | 'opening' | 'open' | 'closing'
type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error'
type InvitationData = {
  copy: typeof COPY
  ready: boolean
  env: EnvelopeState
  status: PlayerStatus
  showVideo: boolean
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
    this.setData({
      ready: true,
      videoUrl: combo.url,
      posterUrl: combo.posterUrl,
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

  open() {
    if (this.data.env !== 'closed') return
    this.setData({ env: 'opening' })
    this.openTimer = setTimeout(() => {
      this.setData({ env: 'open', showVideo: true, status: 'loading', nameOpacity: 0 }, () => {
        this.videoCtx = wx.createVideoContext('player', this)
        this.videoCtx.play()
      })
    }, ENVELOPE_ANIM_MS)
  },

  close() {
    if (this.videoCtx !== null) this.videoCtx.stop()
    this.setData({ showVideo: false, status: 'idle', nameOpacity: 0, env: 'closing' })
    this.closeTimer = setTimeout(() => this.setData({ env: 'closed' }), ENVELOPE_ANIM_MS)
  },

  onToggleEnvelope() {
    if (this.data.env === 'closed') this.open()
    else if (this.data.env === 'open') this.close()
  },

  onVideoPlay() {
    this.setData({ status: 'playing' })
  },

  onVideoWaiting() {
    this.setData({ status: 'loading' })
  },

  onVideoError(event: WechatMiniprogram.VideoError) {
    console.error('invitation video error', event.detail)
    this.setData({ status: 'error' })
  },

  onTimeUpdate(event: WechatMiniprogram.VideoTimeUpdate) {
    if (this.timeline === null) return
    const state = stateAt(this.timeline, event.detail.currentTime * 1000)
    const opacity = Math.round(state.opacity * 50) / 50
    if (Math.abs(opacity - this.data.nameOpacity) >= 0.02 || this.data.status !== 'playing') {
      this.setData({ status: 'playing', nameOpacity: opacity })
    }
  },

  onRetry() {
    this.setData({ showVideo: false }, () => {
      this.setData({ showVideo: true, status: 'loading' }, () => {
        this.videoCtx = wx.createVideoContext('player', this)
        this.videoCtx.play()
      })
    })
  },

  onChangeName() {
    wx.navigateTo({ url: `${PAGES.login}?edit=1` })
  },

  onLegal() {
    wx.navigateTo({ url: PAGES.legal })
  },

  onShow() {
    if (!this.data.ready) return
    this.refreshName()
    if (this.data.env === 'open' && this.wasPlaying && this.videoCtx !== null) this.videoCtx.play()
  },

  onHide() {
    if (this.data.env === 'open' && this.videoCtx !== null) {
      this.wasPlaying = this.data.status === 'playing'
      this.videoCtx.pause()
    }
  },

  onUnload() {
    if (this.openTimer !== null) clearTimeout(this.openTimer)
    if (this.closeTimer !== null) clearTimeout(this.closeTimer)
    if (this.videoCtx !== null) this.videoCtx.stop()
  },

  onShareAppMessage() {
    return { title: COPY.share.title, path: PAGES.login, imageUrl: SHARE_IMAGE }
  },
})
