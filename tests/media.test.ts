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

  it('does not block video playback when the optional poster is missing or denied', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [
        { fileID: videoFile, status: 0, tempFileURL: 'https://cdn.example.com/video.mp4', errMsg: 'ok' },
        { fileID: posterFile, status: -1, tempFileURL: '', errMsg: 'access denied' },
      ],
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })

    expect(await resolveMediaSources(videoFile, posterFile)).toEqual({
      videoUrl: 'https://cdn.example.com/video.mp4',
      posterUrl: '',
    })
  })

  it('keeps a working poster visible when the required video file is unavailable', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [
        { fileID: videoFile, status: -1, tempFileURL: '', errMsg: 'video access denied' },
        { fileID: posterFile, status: 0, tempFileURL: 'https://cdn.example.com/poster.jpg', errMsg: 'ok' },
      ],
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })

    expect(await resolveMediaSources(videoFile, posterFile)).toEqual({
      videoUrl: '',
      posterUrl: 'https://cdn.example.com/poster.jpg',
      videoError: 'CloudBase video URL unavailable: video access denied',
    })
  })

  it('returns a player error for an invalid video URL and propagates CloudBase API failures', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [{ fileID: videoFile, status: 0, tempFileURL: '', errMsg: 'ok' }],
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })

    const invalid = await resolveMediaSources(videoFile, 'https://example.com/poster.jpg')
    expect(invalid.videoUrl).toBe('')
    expect(invalid.videoError).toContain('CloudBase video URL unavailable')

    getTempFileURL.mockRejectedValue(new Error('network error'))
    const failed = await resolveMediaSources(videoFile, posterFile)
    expect(failed.videoUrl).toBe('')
    expect(failed.videoError).toContain('network error')
  })

  it('does not block a direct HTTPS video when only the optional poster lookup fails', async () => {
    const getTempFileURL = vi.fn().mockRejectedValue(new Error('poster lookup failed'))
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })

    await expect(resolveMediaSources('https://cdn.example.com/video.mp4', posterFile)).resolves.toEqual({
      videoUrl: 'https://cdn.example.com/video.mp4',
      posterUrl: '',
    })
  })

  it('shows an HTTPS poster even when the video source is missing', async () => {
    await expect(resolveMediaSources('', 'https://example.com/poster.jpg')).resolves.toEqual({
      videoUrl: '',
      posterUrl: 'https://example.com/poster.jpg',
      videoError: 'video source is empty',
    })
  })

  it('still resolves a cloud poster when the video source is missing', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [{ fileID: posterFile, status: 0, tempFileURL: 'https://cdn.example.com/poster.jpg', errMsg: 'ok' }],
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })

    await expect(resolveMediaSources('', posterFile)).resolves.toEqual({
      videoUrl: '',
      posterUrl: 'https://cdn.example.com/poster.jpg',
      videoError: 'video source is empty',
    })
  })
})
