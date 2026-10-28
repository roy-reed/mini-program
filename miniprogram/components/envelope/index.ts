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
  methods: {
    onToggle() {
      this.triggerEvent('toggle')
    },
  },
})
