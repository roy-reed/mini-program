import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseLibrary } from '../scripts/lib/library'

const template = JSON.parse(readFileSync(new URL('../plan/templates/library.example.json', import.meta.url), 'utf8')) as unknown

describe('library', () => {
  it('accepts the template structure', () => {
    const result = parseLibrary(template)
    expect(result.problems).toEqual([])
    expect(result.value?.videos).toHaveLength(2)
    expect(result.value?.audios).toHaveLength(2)
  })

  it.each([
    ['id with underscore', (value: Record<string, unknown>) => { (value.videos as Array<Record<string, unknown>>)[0].id = 'bad_id' }],
    ['missing name', (value: Record<string, unknown>) => { delete (value.videos as Array<Record<string, unknown>>)[0].name }],
    ['unequal weights', (value: Record<string, unknown>) => { (value.videos as Array<Record<string, unknown>>)[1].weight = 2 }],
    ['invalid color', (value: Record<string, unknown>) => { (value.videos as Array<Record<string, unknown>>)[0].textColor = 'red' }],
  ] as const)('rejects %s', (_label, mutate) => {
    const copy = structuredClone(template) as Record<string, unknown>
    mutate(copy)
    expect(parseLibrary(copy).problems.length).toBeGreaterThan(0)
  })
})
