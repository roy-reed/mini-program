import { runFfprobe } from './run'

export interface VideoProbe { durationMs: number; width: number; height: number; pixFmt: string }
export interface AudioProbe { durationMs: number }
export interface ImageProbe { width: number; height: number; pixFmt: string }

function parseJson(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>
}

export async function probeVideo(filePath: string): Promise<VideoProbe> {
  const result = await runFfprobe(['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,width,height,pix_fmt,duration', '-of', 'json', filePath])
  const stream = ((parseJson(result.stdout).streams as unknown[] | undefined)?.[0] ?? {}) as Record<string, unknown>
  const frames = Number(stream.nb_read_frames)
  const durationMs = Number.isFinite(frames) && frames > 0 ? Math.round(frames / 30 * 1000) : Math.round(Number(stream.duration) * 1000)
  return { durationMs, width: Number(stream.width), height: Number(stream.height), pixFmt: String(stream.pix_fmt ?? '') }
}

export async function probeAudio(filePath: string): Promise<AudioProbe> {
  const result = await runFfprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filePath])
  const format = parseJson(result.stdout).format as Record<string, unknown>
  return { durationMs: Math.round(Number(format.duration) * 1000) }
}

export async function probeImage(filePath: string): Promise<ImageProbe> {
  const result = await runFfprobe(['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', filePath])
  const stream = ((parseJson(result.stdout).streams as unknown[] | undefined)?.[0] ?? {}) as Record<string, unknown>
  return { width: Number(stream.width), height: Number(stream.height), pixFmt: String(stream.pix_fmt ?? '') }
}
