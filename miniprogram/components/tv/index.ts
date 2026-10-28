Component({
  properties: {
    phase: { type: String, value: 'idle' },
    label: { type: String, value: '' },
    disabled: { type: Boolean, value: false },
  },
  methods: {
    onTap() {
      if (this.data.disabled || this.data.phase !== 'idle') return
      this.triggerEvent('draw')
    },
  },
})
