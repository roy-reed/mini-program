import { OBEY_MUTE_SWITCH } from './config'
import { COPY } from './core/copy'

App({
  onLaunch() {
    const env = 'dtsharedchord-d3gz0n9ft379ec6f2'
    wx.cloud.init({ env })
    wx.setInnerAudioOption({ obeyMuteSwitch: OBEY_MUTE_SWITCH })
    const updateManager = wx.getUpdateManager()
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: COPY.update.title,
        content: COPY.update.body,
        confirmText: COPY.update.restart,
        showCancel: false,
        success: () => updateManager.applyUpdate(),
      })
    })
  },
})
