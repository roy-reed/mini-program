import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { posterArgs, renderArgs } from '../scripts/lib/ffmpeg-args'
import { probeVideo } from '../scripts/lib/probe'
import { hasFfmpeg, runFfmpeg } from '../scripts/lib/run'

const describeIfFfmpeg = hasFfmpeg() ? describe : describe.skip

describeIfFfmpeg('render integration', () => {
  it('loops a short video across a 32.4 second track plus a 3 second rest', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'shared-chord-render-'))
    try {
      const video = join(directory, 'video.mp4')
      const audio = join(directory, 'audio.m4a')
      const output = join(directory, 'combo.mp4')
      const poster = join(directory, 'poster.jpg')
      await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=720x960:rate=30:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
      await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=32.4', '-c:a', 'aac', '-ar', '44100', '-ac', '2', audio])
      await runFfmpeg(renderArgs({ videoPath: video, audioPath: audio, outputPath: output, playMs: 32400, loopMs: 2000 }))
      await runFfmpeg(posterArgs({ inputPath: output, outputPath: poster }))
      const result = await probeVideo(output)
      expect(result.durationMs).toBeGreaterThanOrEqual(35300)
      expect(result.durationMs).toBeLessThanOrEqual(35500)
      const black = await runFfmpeg(['-hide_banner', '-i', output, '-vf', 'blackdetect=d=2.5:pix_th=0.1', '-an', '-f', 'null', '-'])
      const blackMatch = black.stderr.match(/black_start:([\d.]+) black_end:([\d.]+)/)
      expect(blackMatch).not.toBeNull()
      expect(Number(blackMatch?.[1])).toBeGreaterThanOrEqual(31.3)
      expect(Number(blackMatch?.[1])).toBeLessThanOrEqual(32.5)
      expect(Number(blackMatch?.[2])).toBeGreaterThanOrEqual(35.3)
      const silence = await runFfmpeg(['-hide_banner', '-i', output, '-af', 'silencedetect=n=-50dB:d=2.5', '-vn', '-f', 'null', '-'])
      const silenceMatch = silence.stderr.match(/silence_start: ([\d.]+)/)
      expect(silenceMatch).not.toBeNull()
      expect(Number(silenceMatch?.[1])).toBeGreaterThanOrEqual(31.3)
      expect(Number(silenceMatch?.[1])).toBeLessThanOrEqual(32.6)
      expect(readFileSync(poster).byteLength).toBeGreaterThan(0)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 60000)
})
