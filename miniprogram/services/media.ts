export interface MediaSources {
  videoUrl: string
  posterUrl: string
}

export async function resolveMediaSources(videoUrl: string, posterUrl: string): Promise<MediaSources> {
  const cloudFileIds = Array.from(new Set([videoUrl, posterUrl].filter((url) => url.startsWith('cloud://'))))
  if (cloudFileIds.length === 0) return { videoUrl, posterUrl }

  const response = await wx.cloud.getTempFileURL({ fileList: cloudFileIds })
  const byFileId = new Map(response.fileList.map((item) => [item.fileID, item]))

  function resolved(url: string): string {
    if (!url.startsWith('cloud://')) return url
    const item = byFileId.get(url)
    if (item?.status !== 0 || !item.tempFileURL?.startsWith('https://')) {
      throw new Error(`CloudBase media URL unavailable: ${item?.errMsg ?? 'missing file'}`)
    }
    return item.tempFileURL
  }

  return { videoUrl: resolved(videoUrl), posterUrl: resolved(posterUrl) }
}
