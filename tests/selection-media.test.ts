import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveCloudUrls } from '../miniprogram/services/media'

afterEach(() => vi.unstubAllGlobals())

describe('selection poster URL resolution', () => {
  it('resolves four poster IDs in one cloud request and preserves the input order', async () => {
    const ids = ['cloud://env.bucket/p/a.jpg', 'cloud://env.bucket/p/b.jpg', 'cloud://env.bucket/p/c.jpg', 'cloud://env.bucket/p/d.jpg']
    const getTempFileURL = vi.fn().mockResolvedValue({
      fileList: [...ids].reverse().map((fileID) => ({ fileID, status: 0, tempFileURL: `https://cdn.example.com/${fileID.slice(-5)}`, errMsg: 'ok' })),
    })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })
    const result = await resolveCloudUrls(ids)
    expect(result).toHaveLength(4)
    expect(result).toEqual(ids.map((fileID) => `https://cdn.example.com/${fileID.slice(-5)}`))
    expect(getTempFileURL).toHaveBeenCalledTimes(1)
    expect(getTempFileURL).toHaveBeenCalledWith({ fileList: ids })
  })

  it('does not query CloudBase for already-HTTPS posters', async () => {
    expect(await resolveCloudUrls(['https://example.com/a.jpg', ''])).toEqual(['https://example.com/a.jpg', ''])
  })

  it('fails explicitly if one remote poster cannot be resolved', async () => {
    const getTempFileURL = vi.fn().mockResolvedValue({ fileList: [] })
    vi.stubGlobal('wx', { cloud: { getTempFileURL } })
    await expect(resolveCloudUrls(['cloud://env.bucket/p/a.jpg'])).rejects.toThrow('CloudBase media URL unavailable')
  })
})
