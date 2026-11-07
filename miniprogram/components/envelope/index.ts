Component({
  properties: {
    state: { type: String, value: 'closed' },
    toText: { type: String, value: '' },
    openHint: { type: String, value: '' },
    closeHint: { type: String, value: '' },
    posterUrl: { type: String, value: '' },
    widthRpx: { type: Number, value: 520 },
    heightRpx: { type: Number, value: 693 },
    frontHeightRpx: { type: Number, value: 144 },
    durationMs: { type: Number, value: 900 },
  },
  data: {
    containerHeightRpx: 322,
  },
  observers: {
    state(state: string) {
      this.updateContainerHeight(state)
    },
    widthRpx() {
      this.updateContainerHeight(String(this.data.state))
    },
    heightRpx() {
      this.updateContainerHeight(String(this.data.state))
    },
    frontHeightRpx() {
      this.updateContainerHeight(String(this.data.state))
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
      const playerHeight = Math.max(1, Number(this.data.heightRpx) || 1)
      const flapHeight = Math.max(1, Number(this.data.frontHeightRpx) || 72)
      const width = Math.max(1, Number(this.data.widthRpx) || 1)
      const height = isOpenHeight ? playerHeight + flapHeight : width * 0.62
      this.setData({ containerHeightRpx: height })
    },
    onToggle() {
      this.triggerEvent('toggle')
    },
  },
})
