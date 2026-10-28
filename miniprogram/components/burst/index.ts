type Particle = { style: string }

Component({
  properties: {
    active: { type: Boolean, value: false },
    durationMs: { type: Number, value: 400 },
  },
  data: { particles: [] as Particle[] },
  lifetimes: {
    attached() {
      const particles: Particle[] = []
      for (let index = 0; index < 16; index += 1) {
        const angle = index * 22.5
        const distance = index % 2 === 0 ? 260 : 340
        const color = `var(--sc-burst-${index % 4 + 1})`
        particles.push({ style: `--burst-angle:${angle}deg;--burst-distance:${distance}rpx;--burst-color:${color};` })
      }
      this.setData({ particles })
    },
  },
})
