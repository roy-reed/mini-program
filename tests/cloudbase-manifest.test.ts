import { describe, expect, it } from 'vitest'
import { checkManifest, checkOnlineAssets } from '../scripts/precheck'
import { FIXTURE_MANIFEST } from './fixtures/manifest'
import type { Manifest } from '../miniprogram/core/manifest-types'

function manifestWithBase(base: string): Manifest {
  const combos = Object.fromEntries(Object.entries(FIXTURE_MANIFEST.combos).map(([key, combo]) => [key, {
    ...combo,
    url: combo.url.replace(FIXTURE_MANIFEST.base, base),
    posterUrl: combo.posterUrl.replace(FIXTURE_MANIFEST.base, base),
  }]))
  return { ...FIXTURE_MANIFEST, base, combos }
}

describe('CloudBase manifest support', () => {
  it('accepts a cloud:// base without a trailing slash', () => {
    const manifest = manifestWithBase('cloud://dtsharedchord-d3gz0n9ft379ec6f2.test-bucket')

    expect(checkManifest(manifest).ok).toBe(true)
    expect(checkManifest(manifestWithBase(`${manifest.base}/`)).ok).toBe(false)
  })

  it('validates cloud file ID shape and explicitly skips HEAD requests', async () => {
    const manifest = manifestWithBase('cloud://dtsharedchord-d3gz0n9ft379ec6f2.test-bucket')
    let fetchCalls = 0
    const fetcher: typeof fetch = async () => {
      fetchCalls += 1
      return new Response(null, { status: 200 })
    }

    const result = await checkOnlineAssets(manifest, fetcher)

    expect(result.ok).toBe(true)
    expect(fetchCalls).toBe(0)
    expect(result.message).toContain('skipped HEAD')
    expect(result.warnings?.join(' ')).toContain('file ID format was checked only')
  })

  it('rejects malformed cloud file IDs instead of silently skipping them', async () => {
    const manifest = manifestWithBase('cloud://dtsharedchord-d3gz0n9ft379ec6f2.test-bucket')
    const firstEntry = Object.entries(manifest.combos)[0]
    const key = firstEntry[0]
    const combo = firstEntry[1]
    const malformed: Manifest = {
      ...manifest,
      combos: {
        ...manifest.combos,
        [key]: { ...combo, url: 'cloud://missing-bucket-and-path' },
      },
    }

    const result = await checkOnlineAssets(malformed, async () => new Response(null, { status: 200 }))

    expect(result.ok).toBe(false)
    expect(result.message).toContain('invalid CloudBase file ID')
  })
})
