import { NAME_REVIEW_WAIT_MS } from '../../config'
import { COPY, t } from '../../core/copy'
import { NAME_ERROR_KEYS, validateName, type NameError } from '../../core/name'
import { currentEntry, goEntry, PAGES } from '../../services/nav'
import { loadProfile, saveAgreement, saveName } from '../../services/store'

type Step = 'loading' | 'agree' | 'name'
type ReviewState = 'unknown' | 'pass' | 'fail'
type LoginData = {
  copy: typeof COPY
  step: Step
  agreed: boolean
  edit: boolean
  nameValue: string
  nameError: string
  submitting: boolean
}

type PageQuery = Record<string, string | undefined>
type NicknameReviewEvent = WechatMiniprogram.CustomEvent<{ pass?: boolean; timeout?: boolean }>

Page({
  data: {
    copy: COPY,
    step: 'loading',
    agreed: false,
    edit: false,
    nameValue: '',
    nameError: '',
    submitting: false,
  } as LoginData,

  reviewState: 'unknown' as ReviewState,

  async onLoad(query: PageQuery) {
    const edit = query.edit === '1'
    const profile = loadProfile()
    if (edit) {
      if (profile !== null && profile.agreedAt > 0) {
        this.setData({ edit: true, step: 'name', nameValue: profile.name })
      } else {
        this.setData({ edit: true, step: 'agree' })
      }
      return
    }
    const decision = await currentEntry()
    if (decision.entry === 'login') this.setData({ step: 'agree' })
    else if (decision.entry === 'name') this.setData({ step: 'name', nameValue: profile?.name ?? '' })
    else goEntry(decision)
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  onNeedAgree() {
    wx.showToast({ title: COPY.login.needAgree, icon: 'none' })
  },

  onAgreePrivacy() {
    saveAgreement(Date.now())
    this.setData({ step: 'name', agreed: true })
  },

  onOpenTerms() {
    wx.navigateTo({ url: `${PAGES.legal}?tab=terms` })
  },

  onOpenPrivacy() {
    wx.navigateTo({ url: `${PAGES.legal}?tab=privacy` })
  },

  onNameInput() {
    this.reviewState = 'unknown'
    this.setData({ nameError: '' })
  },

  onNicknameReview(event: NicknameReviewEvent) {
    this.reviewState = event.detail.pass === true || event.detail.timeout === true ? 'pass' : 'fail'
  },

  async waitForReview(): Promise<ReviewState> {
    const startedAt = Date.now()
    while (this.reviewState === 'unknown' && Date.now() - startedAt < NAME_REVIEW_WAIT_MS) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
    return this.reviewState
  },

  setNameError(error: NameError): void {
    this.setData({ nameError: t(NAME_ERROR_KEYS[error]) })
  },

  async onSubmit(event: WechatMiniprogram.FormSubmit) {
    if (this.data.submitting) return
    this.setData({ submitting: true, nameError: '' })
    const formName = typeof event.detail.value.nickname === 'string' ? event.detail.value.nickname : ''
    const review = await this.waitForReview()
    if (review === 'fail') {
      this.setData({ submitting: false, nameError: COPY.name.errReview })
      return
    }
    const result = validateName(formName)
    if (!result.ok) {
      this.setNameError(result.error)
      this.setData({ submitting: false })
      return
    }
    saveName(result.name)
    if (this.data.edit) {
      wx.navigateBack()
      return
    }
    goEntry(await currentEntry())
  },

  onShareAppMessage() {
    return { title: COPY.share.title, path: PAGES.login }
  },
})
