export interface MediaSources {
  videoUrl: string
  posterUrl: string
}

export async function resolveCloudUrls(urls: string[]): Promise<string[]> {
  const cloudFileIds = Array.from(new Set(urls.filter((url) => url.startsWith('cloud://'))))
  if (cloudFileIds.length === 0) return urls

  const response = await wx.cloud.getTempFileURL({ fileList: cloudFileIds })
  const byFileId = new Map(response.fileList.map((item) => [item.fileID, item]))

  return urls.map((url) => {
    if (!url.startsWith('cloud://')) return url
    const item = byFileId.get(url)
    if (item?.status !== 0 || !item.tempFileURL?.startsWith('https://')) {
      throw new Error(`CloudBase media URL unavailable: ${item?.errMsg ?? 'missing file'}`)
    }
    return item.tempFileURL
  })
}

export async function resolveMediaSources(videoUrl: string, posterUrl: string): Promise<MediaSources> {
  const [resolvedVideo, resolvedPoster] = await resolveCloudUrls([videoUrl, posterUrl])
  return { videoUrl: resolvedVideo, posterUrl: resolvedPoster }
}
