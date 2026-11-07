export interface MediaSources {
  videoUrl: string
  posterUrl: string
  videoError?: string
}

type CloudFileResult = {
  fileID: string
  status: number
  tempFileURL: string
  errMsg: string
}

async function cloudFileResults(urls: string[]): Promise<Map<string, CloudFileResult>> {
  const cloudFileIds = Array.from(new Set(urls.filter((url) => url.startsWith('cloud://'))))
  if (cloudFileIds.length === 0) return new Map()

  const response = await wx.cloud.getTempFileURL({ fileList: cloudFileIds })
  return new Map(response.fileList.map((item) => [item.fileID, item]))
}

function resolveOneCloudUrl(url: string, results: Map<string, CloudFileResult>): string | null {
  if (!url.startsWith('cloud://')) return url || null
  const item = results.get(url)
  if (item?.status !== 0 || !item.tempFileURL?.startsWith('https://')) return null
  return item.tempFileURL
}

export async function resolveCloudUrls(urls: string[]): Promise<string[]> {
  const results = await cloudFileResults(urls)
  return urls.map((url) => {
    const resolved = resolveOneCloudUrl(url, results)
    if (resolved === null) {
      const item = results.get(url)
      throw new Error(`CloudBase media URL unavailable: ${item?.errMsg ?? 'missing file'}`)
    }
    return resolved
  })
}

export async function resolveMediaSources(videoUrl: string, posterUrl: string): Promise<MediaSources> {
  if (!videoUrl) return { videoUrl: '', posterUrl: posterUrl.startsWith('https://') ? posterUrl : '', videoError: 'video source is empty' }

  const results = await cloudFileResults([videoUrl, posterUrl])
  const resolvedVideo = resolveOneCloudUrl(videoUrl, results)
  const resolvedPoster = resolveOneCloudUrl(posterUrl, results)
  const videoError = resolvedVideo === null
    ? `CloudBase video URL unavailable: ${results.get(videoUrl)?.errMsg ?? 'missing file'}`
    : undefined

  // A poster is decorative fallback content. Its failure must never block video playback.
  if (posterUrl.startsWith('cloud://') && resolvedPoster === null) {
    console.warn('CloudBase poster URL unavailable; using the built-in player background')
  }

  return {
    videoUrl: resolvedVideo ?? '',
    posterUrl: resolvedPoster ?? '',
    ...(videoError === undefined ? {} : { videoError }),
  }
}
