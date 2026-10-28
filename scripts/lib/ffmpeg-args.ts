import { FADE_IN_MS, FADE_OUT_MS, REST_MS, buildTimeline, type LoopMode } from '../../miniprogram/core/timeline'

const seconds = (milliseconds: number): string => (milliseconds / 1000).toFixed(3)

export interface NormalizeVideoInput {
  inputPath: string
  outputPath: string
  clip?: { start: number; duration: number } | null
  pingpong?: boolean
}

export interface NormalizeAudioInput {
  inputPath: string
  outputPath: string
  clip?: { start: number; duration: number } | null
}

export interface RenderArgsInput {
  videoPath: string
  audioPath: string
  outputPath: string
  playMs: number
  loopMs: number
  mode?: LoopMode
  titlePath?: string | null
  aiLabelPath?: string | null
}

export interface PosterArgsInput {
  inputPath: string
  outputPath: string
}

export function normalizeVideoArgs(input: NormalizeVideoInput): string[] {
  const args = ['-y', '-hide_banner', '-loglevel', 'error']
  if (input.clip) args.push('-ss', seconds(input.clip.start * 1000), '-t', seconds(input.clip.duration * 1000))
  args.push('-i', input.inputPath, '-an')
  const base = '[0:v]fps=30,scale=720:960:force_original_aspect_ratio=increase,crop=720:960,setsar=1'
  const filter = input.pingpong
    ? `${base},format=yuv420p,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]`
    : `${base},format=yuv420p[v]`
  args.push('-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-g', '30', '-bf', '0', '-movflags', '+faststart', input.outputPath)
  return args
}

export function normalizeAudioArgs(input: NormalizeAudioInput): string[] {
  const args = ['-y', '-hide_banner', '-loglevel', 'error']
  if (input.clip) args.push('-ss', seconds(input.clip.start * 1000), '-t', seconds(input.clip.duration * 1000))
  args.push('-i', input.inputPath, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_rates=44100:channel_layouts=stereo', '-c:a', 'aac', '-b:a', '192k', input.outputPath)
  return args
}

export function renderArgs(input: RenderArgsInput): string[] {
  const timeline = buildTimeline({ audioMs: input.playMs, loopMs: input.loopMs, mode: input.mode })
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', input.videoPath, '-i', input.audioPath]
  const filters = [`[0:v]trim=duration=${seconds(timeline.playMs)},setpts=PTS-STARTPTS,fps=30[base]`]
  let videoLabel = 'base'
  let nextInput = 2
  if (input.titlePath) {
    filters.push(`[${nextInput}:v]scale=720:960[title]`, `[${videoLabel}][title]overlay=0:0[titled]`)
    videoLabel = 'titled'
    nextInput += 1
  }
  if (input.aiLabelPath) {
    filters.push(`[${nextInput}:v]format=rgba[ai]`, `[${videoLabel}][ai]overlay=W-w-24:H-h-24[marked]`)
    videoLabel = 'marked'
    nextInput += 1
  }
  const fadeOutStart = seconds(timeline.playMs - FADE_OUT_MS)
  filters.push(`[${videoLabel}]fade=t=in:st=0:d=${seconds(FADE_IN_MS)},fade=t=out:st=${fadeOutStart}:d=${seconds(FADE_OUT_MS)},tpad=stop_mode=add:stop_duration=${seconds(REST_MS)}:color=black,format=yuv420p[v]`)
  filters.push(`[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=duration=${seconds(timeline.playMs)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${seconds(FADE_IN_MS)},afade=t=out:st=${fadeOutStart}:d=${seconds(FADE_OUT_MS)},apad=pad_dur=${seconds(REST_MS)}[a]`)
  if (input.titlePath) args.push('-i', input.titlePath)
  if (input.aiLabelPath) args.push('-i', input.aiLabelPath)
  args.push('-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]', '-t', seconds(timeline.cycleMs), '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '23', '-maxrate', '1800k', '-bufsize', '3600k', '-g', '60', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', input.outputPath)
  return args
}

export function posterArgs(input: PosterArgsInput): string[] {
  return ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '2', '-i', input.inputPath, '-frames:v', '1', '-q:v', '3', input.outputPath]
}
