Component({
  properties: {
    state: { type: String, value: 'closed' },
    toText: { type: String, value: '' },
    openHint: { type: String, value: '' },
    closeHint: { type: String, value: '' },
    posterUrl: { type: String, value: '' },
    widthRpx: { type: Number, value: 520 },
    heightRpx: { type: Number, value: 693 },
    durationMs: { type: Number, value: 900 },
  },
  data: {
    containerHeightRpx: 322,
  },
  observers: {
    state(state: string) {
      this.updateContainerHeight(state)
    },
  },
  lifetimes: {
    attached() {
      this.updateContainerHeight(String(this.data.state))
    },
  },
  methods: {
    updateContainerHeight(state: string) {
      const isOpenHeight = state === 'opening' || state === 'open' || state === 'closing'
      const height = isOpenHeight ? Number(this.data.heightRpx) + 160 : Number(this.data.widthRpx) * 0.62
      this.setData({ containerHeightRpx: height })
    },
    onToggle() {
      this.triggerEvent('toggle')
    },
  },
})
