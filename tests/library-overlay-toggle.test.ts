import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseLibrary } from '../scripts/lib/library'

describe('optional AI overlay', () => {
  const source = JSON.parse(readFileSync(resolve('assets-src/library.json'), 'utf8')) as Record<string, unknown>

  it('allows AI-generated video metadata while overlay rendering is disabled', () => {
    const copy = structuredClone(source) as Record<string, unknown> & {
      overlays: { title: string | null; aiLabel: string | null }
    }
    copy.overlays.aiLabel = null
    const parsed = parseLibrary(copy)
    expect(parsed.problems).toEqual([])
    expect(parsed.value?.overlays.aiLabel).toBeNull()
    expect(parsed.value?.videos.some((video) => video.aiGenerated)).toBe(true)
  })

  it('preserves a configurable overlay filename for a later release', () => {
    const copy = structuredClone(source) as Record<string, unknown> & {
      overlays: { title: string | null; aiLabel: string | null }
    }
    copy.overlays.aiLabel = 'overlays/ai-label.png'
    const parsed = parseLibrary(copy)
    expect(parsed.problems).toEqual([])
    expect(parsed.value?.overlays.aiLabel).toBe('overlays/ai-label.png')
  })
})
