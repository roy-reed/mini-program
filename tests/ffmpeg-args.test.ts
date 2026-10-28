import { describe, expect, it } from 'vitest'
import { normalizeVideoArgs, renderArgs } from '../scripts/lib/ffmpeg-args'

describe('ffmpeg args', () => {
  it('builds the required render timeline and overlays', () => {
    const args = renderArgs({ videoPath: 'loop.mp4', audioPath: 'audio.m4a', outputPath: 'out.mp4', playMs: 32400, loopMs: 4000, titlePath: 'title.png', aiLabelPath: 'ai-label.png' })
    const filter = args[args.indexOf('-filter_complex') + 1]
    expect(filter).toContain('setpts=PTS-STARTPTS,fps=30')
    expect(filter).toContain('fade=t=out:st=31.400')
    expect(filter).toContain('tpad=stop_mode=add:stop_duration=3.000')
    expect(filter).toContain('apad=pad_dur=3.000')
    expect(args).toContain('-t')
    expect(args[args.indexOf('-t') + 1]).toBe('35.400')
    expect(args).toContain('+faststart')
  })

  it('omits title and AI overlays when absent', () => {
    const args = renderArgs({ videoPath: 'loop.mp4', audioPath: 'audio.m4a', outputPath: 'out.mp4', playMs: 32400, loopMs: 4000 })
    const filter = args[args.indexOf('-filter_complex') + 1]
    expect(filter).not.toContain('[title]')
    expect(filter).not.toContain('[ai]')
    expect(args.indexOf('-i')).toBe(6)
  })

  it('adds pingpong normalization filters', () => {
    const args = normalizeVideoArgs({ inputPath: 'input.mp4', outputPath: 'output.mp4', pingpong: true })
    expect(args.join(' ')).toContain('reverse')
    expect(args.join(' ')).toContain('concat=n=2')
  })
})
