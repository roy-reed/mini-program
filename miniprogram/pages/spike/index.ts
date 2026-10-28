import { OBEY_MUTE_SWITCH } from '../../config'
import { MANIFEST } from '../../data/manifest'
import { stateAt, type Timeline, buildTimeline } from '../../core/timeline'

type SpikeData = {
  videoUrl: string
  posterUrl: string
  comboKey: string
  currentTime: number
  phase: string
  opacity: number
  loopCount: number
  events: string[]
  obeyMuteSwitch: boolean
  ready: boolean
}

type PageQuery = Record<string, string | undefined>

Page({
  data: {
    videoUrl: '',
    posterUrl: '',
    comboKey: '',
    currentTime: 0,
    phase: 'fadeIn',
    opacity: 0,
    loopCount: 0,
    events: [],
    obeyMuteSwitch: OBEY_MUTE_SWITCH,
    ready: false,
  } as SpikeData,

  timeline: null as Timeline | null,
  videoCtx: null as WechatMiniprogram.VideoContext | null,
  lastCurrentTime: 0,
  hasTimeUpdate: false,

  onLoad(query: PageQuery) {
    const keys = Object.keys(MANIFEST.combos)
    const comboKey = query.key && MANIFEST.combos[query.key] ? query.key : keys[0]
    if (!comboKey) {
      console.error('No manifest combo is available')
      this.addEvent('error')
      return
    }
    const combo = MANIFEST.combos[comboKey]
    this.timeline = buildTimeline({ audioMs: combo.playMs, loopMs: combo.loopMs })
    this.setData({
      videoUrl: combo.url,
      posterUrl: combo.posterUrl,
      comboKey,
      ready: true,
    })
  },

  onReady() {
    this.videoCtx = wx.createVideoContext('spike-video', this)
  },

  addEvent(name: string, time?: number): void {
    const entry = `${name} @ ${(time ?? this.data.currentTime).toFixed(2)}s`
    this.setData({ events: [entry, ...this.data.events].slice(0, 8) })
  },

  getVideoContext(): WechatMiniprogram.VideoContext {
    if (this.videoCtx === null) this.videoCtx = wx.createVideoContext('spike-video', this)
    return this.videoCtx
  },

  onPlay() {
    this.addEvent('play')
  },

  onPause() {
    this.addEvent('pause')
  },

  onWaiting() {
    this.addEvent('waiting')
  },

  onError(event: WechatMiniprogram.VideoError) {
    console.error('video error', event.detail)
    this.addEvent('error')
  },

  onEnded() {
    this.addEvent('ended')
  },

  onTimeUpdate(event: WechatMiniprogram.VideoTimeUpdate) {
    const currentTime = event.detail.currentTime
    if (!this.hasTimeUpdate) {
      this.hasTimeUpdate = true
      this.addEvent('first timeupdate', currentTime)
    }
    if (this.lastCurrentTime - currentTime > 1) {
      this.setData({ loopCount: this.data.loopCount + 1 })
    }
    this.lastCurrentTime = currentTime
    const timeline = this.timeline
    if (timeline === null) return
    const state = stateAt(timeline, currentTime * 1000)
    this.setData({ currentTime, phase: state.phase, opacity: state.opacity })
  },

  onPlayButton() {
    this.getVideoContext().play()
  },

  onPauseButton() {
    this.getVideoContext().pause()
  },

  onStopButton() {
    this.getVideoContext().stop()
    this.lastCurrentTime = 0
    this.setData({ currentTime: 0, phase: 'fadeIn', opacity: 0, loopCount: 0 })
  },

  onToggleMute() {
    const obeyMuteSwitch = !this.data.obeyMuteSwitch
    wx.setInnerAudioOption({ obeyMuteSwitch })
    this.setData({ obeyMuteSwitch })
  },
})
