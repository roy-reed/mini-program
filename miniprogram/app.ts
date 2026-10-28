import { OBEY_MUTE_SWITCH } from './config'

App({
  onLaunch() {
    wx.setInnerAudioOption({ obeyMuteSwitch: OBEY_MUTE_SWITCH })
  },
})
