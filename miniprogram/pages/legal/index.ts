import { COPY, t } from '../../core/copy'
import { PRIVACY, TERMS, type LegalDoc } from '../../core/legal'
import { PAGES } from '../../services/nav'
import { clearAll } from '../../services/store'

type Tab = 'terms' | 'privacy'
type LegalData = { copy: typeof COPY; tab: Tab; terms: LegalDoc; privacy: LegalDoc }
type PageQuery = Record<string, string | undefined>

Page({
  data: { copy: COPY, tab: 'terms', terms: TERMS, privacy: PRIVACY } as LegalData,

  onLoad(query: PageQuery) { this.setData({ tab: query.tab === 'privacy' ? 'privacy' : 'terms' }) },
  onSelectTerms() { this.setData({ tab: 'terms' }) },
  onSelectPrivacy() { this.setData({ tab: 'privacy' }) },

  onOpenWechatPrivacy() {
    wx.openPrivacyContract({ fail: (error) => console.warn('open privacy contract failed', error) })
  },

  onDeleteData() {
    wx.showModal({
      title: COPY.legal.deleteData,
      content: COPY.legal.deleteConfirm,
      confirmText: COPY.common.confirm,
      cancelText: COPY.common.cancel,
      success: (result) => {
        if (!result.confirm) return
        clearAll()
        wx.showToast({ title: COPY.legal.deleteDone, icon: 'none' })
        setTimeout(() => wx.reLaunch({ url: PAGES.login }), 600)
      },
    })
  },

  formatUpdatedAt(date: string): string { return t('legal.updatedAt', { date }) },
})
