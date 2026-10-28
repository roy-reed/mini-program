export function needPrivacyAuthorization(): Promise<boolean> {
  try {
    if (!wx.canIUse('getPrivacySetting')) return Promise.resolve(false)
  } catch (error) {
    console.warn('privacy capability check failed', error)
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    wx.getPrivacySetting({
      success: (result) => resolve(result.needAuthorization === true),
      fail: () => resolve(false),
    })
  })
}
