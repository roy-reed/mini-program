import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { validateManifest } from '../miniprogram/core/manifest-check'
import { buildTimeline } from '../miniprogram/core/timeline'
import { inputHash, readCache, writeCache } from './lib/cache'
import { loadLibrary, type Library } from './lib/library'
import { normalizeAudioArgs, normalizeVideoArgs, posterArgs, renderArgs } from './lib/ffmpeg-args'
import { probeAudio, probeImage, probeVideo, type AudioProbe, type VideoProbe } from './lib/probe'
import { hasFfmpeg, runFfmpeg } from './lib/run'

const ROOT = process.cwd()
const DEFAULT_LIBRARY = join(ROOT, 'assets-src/library.json')
const PROBE_FILE = join(ROOT, 'work/probe.json')

interface ProbeStore {
  videos: Record<string, VideoProbe>
  audios: Record<string, AudioProbe>
}

interface Context {
  libraryPath: string
  sourceRoot: string
  workRoot: string
  distRoot: string
}

function ensureDir(path: string): void { mkdirSync(path, { recursive: true }) }
function sourcePath(context: Context, relativePath: string): string { return resolve(context.sourceRoot, relativePath) }
function loadContext(libraryPath = DEFAULT_LIBRARY, versionOverride?: number): { context: Context; library: Library } {
  const loaded = loadLibrary(libraryPath)
  if (!loaded.value) throw new Error(loaded.problems.join('\n'))
  const version = versionOverride ?? loaded.value.version
  return {
    library: { ...loaded.value, version },
    context: { libraryPath, sourceRoot: dirname(libraryPath), workRoot: join(ROOT, 'work'), distRoot: join(ROOT, `dist-assets/v${version}`) },
  }
}

function parseOptions(args: string[]): { command: string; base?: string; libraryPath: string; sourceRoot?: string } {
  const command = args[0] ?? 'check'
  let base: string | undefined
  let libraryPath = DEFAULT_LIBRARY
  let sourceRoot: string | undefined
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--base') base = args[++index]
    else if (arg === '--library') libraryPath = resolve(args[++index])
    else if (arg === '--source-root') sourceRoot = resolve(args[++index])
  }
  return { command, base, libraryPath, sourceRoot }
}

function requireBase(base: string | undefined): string {
  if (!base || !base.startsWith('https://') || base.endsWith('/')) throw new Error('--base must start with https:// and must not end with /')
  return base
}

function readProbeStore(): ProbeStore {
  if (!existsSync(PROBE_FILE)) return { videos: {}, audios: {} }
  try { return JSON.parse(readFileSync(PROBE_FILE, 'utf8')) as ProbeStore } catch { return { videos: {}, audios: {} } }
}

function writeProbeStore(store: ProbeStore): void {
  ensureDir(dirname(PROBE_FILE))
  writeFileSync(PROBE_FILE, `${JSON.stringify(store, null, 2)}\n`)
}

function reportProblems(problems: string[]): never {
  console.error(problems.map((problem) => `✗ ${problem}`).join('\n'))
  throw new Error(`assets check failed with ${problems.length} problem(s)`)
}

async function check(context: Context, library: Library): Promise<void> {
  const problems: string[] = []
  for (const item of library.videos) {
    const filePath = sourcePath(context, item.file)
    if (!existsSync(filePath)) { problems.push(`missing video file: ${item.file}`); continue }
    try {
      const probe = await probeVideo(filePath)
      const duration = item.clip?.duration ?? probe.durationMs / 1000
      const effective = item.pingpong ? duration * 2 : duration
      if (effective < 0.5 || effective > 10) problems.push(`video ${item.id} duration must be between 0.5 and 10 seconds`)
    } catch (error) { problems.push(`cannot probe video ${item.id}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  for (const item of library.audios) {
    const filePath = sourcePath(context, item.file)
    if (!existsSync(filePath)) { problems.push(`missing audio file: ${item.file}`); continue }
    try {
      const probe = await probeAudio(filePath)
      const duration = item.clip?.duration ?? probe.durationMs / 1000
      if (duration < 10 || duration > 90) problems.push(`audio ${item.id} duration must be between 10 and 90 seconds`)
    } catch (error) { problems.push(`cannot probe audio ${item.id}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  const titlePath = library.overlays.title ? sourcePath(context, library.overlays.title) : null
  if (titlePath) {
    if (!existsSync(titlePath)) problems.push(`missing title overlay: ${library.overlays.title}`)
    else {
      const image = await probeImage(titlePath)
      if (image.width !== 720 || image.height !== 960) problems.push('title.png must be 720x960')
      if (!['rgba', 'rgba64be', 'ya8', 'ya16be'].includes(image.pixFmt)) problems.push('title overlay must be exported as 32-bit RGBA PNG')
    }
  }
  const aiPath = library.overlays.aiLabel ? sourcePath(context, library.overlays.aiLabel) : null
  if (aiPath && !existsSync(aiPath)) problems.push(`missing AI label overlay: ${library.overlays.aiLabel}`)
  if (problems.length > 0) reportProblems(problems)
  console.log(`✓ library and source files valid (${library.videos.length} videos, ${library.audios.length} audios)`)
}

async function normalize(context: Context, library: Library): Promise<void> {
  const loopsDir = join(context.workRoot, 'loops')
  const audiosDir = join(context.workRoot, 'audios')
  ensureDir(loopsDir); ensureDir(audiosDir)
  const probes: ProbeStore = { videos: {}, audios: {} }
  for (const item of library.videos) {
    const output = join(loopsDir, `${item.id}.mp4`)
    await runFfmpeg(normalizeVideoArgs({ inputPath: sourcePath(context, item.file), outputPath: output, clip: item.clip, pingpong: item.pingpong }))
    probes.videos[item.id] = await probeVideo(output)
  }
  for (const item of library.audios) {
    const output = join(audiosDir, `${item.id}.m4a`)
    await runFfmpeg(normalizeAudioArgs({ inputPath: sourcePath(context, item.file), outputPath: output, clip: item.clip }))
    probes.audios[item.id] = await probeAudio(output)
  }
  writeProbeStore(probes)
  console.log(`normalized ${library.videos.length} videos and ${library.audios.length} audios`)
}

function fileIfSet(context: Context, relativePath: string | null): string | null {
  return relativePath === null ? null : sourcePath(context, relativePath)
}

async function render(context: Context, library: Library): Promise<void> {
  const probes = readProbeStore()
  const combosDir = join(context.distRoot, 'combos')
  const postersDir = join(context.distRoot, 'posters')
  ensureDir(combosDir); ensureDir(postersDir)
  const cachePath = join(context.workRoot, 'cache.json')
  const cache = readCache(cachePath)
  const rows: Array<{ combo: string; duration: number; size: number; copies: number }> = []
  for (const video of library.videos.filter((item) => item.enabled)) {
    for (const audio of library.audios.filter((item) => item.enabled)) {
      const key = `${video.id}__${audio.id}`
      const videoPath = join(context.workRoot, 'loops', `${video.id}.mp4`)
      const audioPath = join(context.workRoot, 'audios', `${audio.id}.m4a`)
      const playMs = probes.audios[audio.id]?.durationMs ?? 0
      const loopMs = probes.videos[video.id]?.durationMs ?? 0
      const timeline = buildTimeline({ audioMs: playMs, loopMs, mode: library.timeline.loopMode })
      const titlePath = fileIfSet(context, library.overlays.title)
      const aiLabelPath = video.aiGenerated ? fileIfSet(context, library.overlays.aiLabel) : null
      const output = join(combosDir, `${key}.mp4`)
      const hash = inputHash([videoPath, audioPath, ...(titlePath ? [titlePath] : []), ...(aiLabelPath ? [aiLabelPath] : [])], { playMs, loopMs, titlePath, aiLabelPath, mode: library.timeline.loopMode })
      if (cache[key]?.hash !== hash || !existsSync(output)) {
        await runFfmpeg(renderArgs({ videoPath, audioPath, outputPath: output, playMs, loopMs, mode: library.timeline.loopMode, titlePath, aiLabelPath }))
        cache[key] = { hash, output }
      }
      const poster = join(postersDir, `${key}.jpg`)
      await runFfmpeg(posterArgs({ inputPath: output, outputPath: poster }))
      const finalProbe = await probeVideo(output)
      rows.push({ combo: key, duration: finalProbe.durationMs, size: readFileSync(output).byteLength, copies: timeline.loopCopies })
    }
  }
  writeCache(cachePath, cache)
  writeFileSync(join(context.distRoot, 'report.json'), `${JSON.stringify(rows, null, 2)}\n`)
  console.table(rows)
  console.log(`把 dist-assets/v${library.version} 上传到 COS 的 shared-chord/ 目录`)
}

function buildManifest(library: Library, base: string): void {
  const probes = readProbeStore()
  const videos = library.videos.filter((item) => item.enabled).map((item) => ({ id: item.id, textColor: item.textColor, aiGenerated: item.aiGenerated, weight: item.weight }))
  const audios = library.audios.filter((item) => item.enabled).map((item) => ({ id: item.id, weight: item.weight }))
  const combos: Record<string, unknown> = {}
  for (const video of videos) for (const audio of audios) {
    const key = `${video.id}__${audio.id}`
    const playMs = probes.audios[audio.id]?.durationMs ?? 0
    const loopMs = probes.videos[video.id]?.durationMs ?? 0
    const timeline = buildTimeline({ audioMs: playMs, loopMs, mode: library.timeline.loopMode })
    const output = join(ROOT, `dist-assets/v${library.version}/combos/${key}.mp4`)
    combos[key] = { key, videoId: video.id, audioId: audio.id, url: `${base}/v${library.version}/combos/${key}.mp4`, posterUrl: `${base}/v${library.version}/posters/${key}.jpg`, playMs: timeline.playMs, loopMs, durationMs: timeline.cycleMs, sizeBytes: existsSync(output) ? readFileSync(output).byteLength : 0 }
  }
  const manifest = { version: library.version, generatedAt: new Date().toISOString(), base, album: library.album, copy: library.copy, layout: library.layout, titleBaked: library.overlays.title !== null, videos, audios, combos }
  const problems = validateManifest(manifest as never)
  if (problems.length > 0) reportProblems(problems)
  const target = join(ROOT, 'miniprogram/data/manifest.ts')
  writeFileSync(target, `// 此文件由 npm run assets -- manifest 生成，请勿手改\nimport type { Manifest } from '../core/manifest-types'\n\nexport const MANIFEST: Manifest = ${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote ${target}`)
}

async function createSample(): Promise<void> {
  if (!hasFfmpeg()) throw new Error('ffmpeg is required for sample')
  const root = join(ROOT, 'work/sample')
  const videosDir = join(root, 'videos'); const audiosDir = join(root, 'audios'); const overlaysDir = join(root, 'overlays')
  ensureDir(videosDir); ensureDir(audiosDir); ensureDir(overlaysDir)
  await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=720x960:rate=30:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(videosDir, 'sample-a.mp4')])
  await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=720x960:rate=30:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(videosDir, 'sample-b.mp4')])
  await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12', '-c:a', 'pcm_s16le', join(audiosDir, 'sample-a.wav')])
  await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=15', '-c:a', 'pcm_s16le', join(audiosDir, 'sample-b.wav')])
  await runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=160x48,format=rgba,drawbox=x=0:y=0:w=160:h=48:color=black@0.55:t=fill:replace=1', '-frames:v', '1', join(overlaysDir, 'ai-label.png')])
  const library = { version: 0, album: { title: 'Sample Album', releaseDate: '2026.10' }, copy: { inviteLine: 'Invite {name} to listen' }, timeline: { loopMode: 'ceil' }, layout: { nameTopPct: 0.7, nameMaxRpx: 44, nameMinRpx: 28 }, overlays: { title: null, aiLabel: 'overlays/ai-label.png' }, allowUnequalWeights: false, videos: [{ id: 'sample-a', name: 'Sample A', file: 'videos/sample-a.mp4', clip: null, pingpong: false, textColor: '#FFFFFF', aiGenerated: true, weight: 1, enabled: true }, { id: 'sample-b', name: 'Sample B', file: 'videos/sample-b.mp4', clip: null, pingpong: false, textColor: '#3B2A1A', aiGenerated: false, weight: 1, enabled: true }], audios: [{ id: 'sample-a', name: 'Sample A', file: 'audios/sample-a.wav', clip: null, weight: 1, enabled: true }, { id: 'sample-b', name: 'Sample B', file: 'audios/sample-b.wav', clip: null, weight: 1, enabled: true }] }
  const libraryPath = join(root, 'library.json'); writeFileSync(libraryPath, `${JSON.stringify(library, null, 2)}\n`)
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  if (options.command === 'sample') {
    const base = requireBase(options.base)
    await createSample()
    const loaded = loadContext(join(ROOT, 'work/sample/library.json'), 0)
    await check(loaded.context, loaded.library); await normalize(loaded.context, loaded.library); await render(loaded.context, loaded.library); buildManifest(loaded.library, base); return
  }
  const loaded = loadContext(options.libraryPath)
  const context = options.sourceRoot ? { ...loaded.context, sourceRoot: options.sourceRoot } : loaded.context
  if (options.command === 'check') await check(context, loaded.library)
  else if (options.command === 'normalize') await normalize(context, loaded.library)
  else if (options.command === 'render') await render(context, loaded.library)
  else if (options.command === 'manifest') buildManifest(loaded.library, requireBase(options.base))
  else if (options.command === 'all') { await check(context, loaded.library); await normalize(context, loaded.library); await render(context, loaded.library); buildManifest(loaded.library, requireBase(options.base)) }
  else throw new Error(`unknown assets command: ${options.command}`)
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
