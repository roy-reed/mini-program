import { ENVELOPE_ANIM_MS } from '../../config'
import { COPY, t } from '../../core/copy'

type EnvelopeState = 'closed' | 'opening' | 'open' | 'closing'
type InvitationData = {
  copy: typeof COPY
  env: EnvelopeState
  toText: string
  openHint: string
  closeHint: string
  envelopeMs: number
}

Page({
  data: {
    copy: COPY,
    env: 'closed',
    toText: t('inv.to', { name: 'Demo Name' }),
    openHint: COPY.inv.tapToOpen,
    closeHint: COPY.inv.tapToClose,
    envelopeMs: ENVELOPE_ANIM_MS,
  } as InvitationData,

  transitionTimer: null as ReturnType<typeof setTimeout> | null,

  onToggleEnvelope() {
    if (this.data.env === 'closed') {
      this.setData({ env: 'opening' })
      this.transitionTimer = setTimeout(() => this.setData({ env: 'open' }), ENVELOPE_ANIM_MS)
    } else if (this.data.env === 'open') {
      this.setData({ env: 'closing' })
      this.transitionTimer = setTimeout(() => this.setData({ env: 'closed' }), ENVELOPE_ANIM_MS)
    }
  },

  onUnload() {
    if (this.transitionTimer !== null) clearTimeout(this.transitionTimer)
  },
})
