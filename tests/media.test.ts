import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveMediaSources } from '../miniprogram/services/media'

const videoFile = 'cloud://env.bucket/v1/combos/door__track01.mp4'
const posterFile = 'cloud://env.bucket/v1/posters/door__track01.jpg'

afterEach(() => vi.unstubAllGlobals())

describe('CloudBase media URLs', () => {
  it('keeps HTTPS sources without calling CloudBase', async () => {
    const actual = await resolveMediaSources('https://example.com/video.mp4', 'https://example.com/poster.jpg')
    expect(actual).toEqual({ videoUrl: 'https://example.com/video.mp4', posterUrl: 'https://example.com/poster.jpg' })
  })

  it('resolves video and poster together by file ID', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [
        { fileID: posterFile, status: 0, tempFileURL: 'https://cdn.example.com/poster.jpg', errMsg: 'ok' },
        { fileID: videoFile, status: 0, tempFileURL: 'https://cdn.example.com/video.mp4', errMsg: 'ok' },
      ],
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })

    expect(await resolveMediaSources(videoFile, posterFile)).toEqual({
      videoUrl: 'https://cdn.example.com/video.mp4',
      posterUrl: 'https://cdn.example.com/poster.jpg',
    })
    expect(getTempFileURL).toHaveBeenCalledTimes(1)
    expect(getTempFileURL).toHaveBeenCalledWith({ fileList: [videoFile, posterFile] })
  })

  it('rejects a missing or denied cloud file', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [
        { fileID: videoFile, status: 0, tempFileURL: 'https://cdn.example.com/video.mp4', errMsg: 'ok' },
        { fileID: posterFile, status: -1, tempFileURL: '', errMsg: 'access denied' },
      ],
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })
    await expect(resolveMediaSources(videoFile, posterFile)).rejects.toThrow('access denied')
  })

  it('rejects an invalid temporary URL and propagates API failures', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [{ fileID: videoFile, status: 0, tempFileURL: '', errMsg: 'ok' }],
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })
    await expect(resolveMediaSources(videoFile, 'https://example.com/poster.jpg')).rejects.toThrow('CloudBase media URL unavailable')

    getTempFileURL.mockRejectedValue(new Error('network error'))
    await expect(resolveMediaSources(videoFile, posterFile)).rejects.toThrow('network error')
  })
})
