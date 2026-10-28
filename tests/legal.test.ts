import { describe, expect, it } from 'vitest'
import { PRIVACY, TERMS } from '../miniprogram/core/legal'

describe('legal documents', () => {
  it.each([TERMS, PRIVACY])('has a title, date, and complete sections', (document) => {
    expect(document.title.length).toBeGreaterThan(0)
    expect(document.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
    expect(document.sections.length).toBeGreaterThanOrEqual(3)
    expect(document.sections.every((section) => section.heading.length > 0 && section.paragraphs.length > 0)).toBe(true)
  })
})
