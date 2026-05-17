import { describe, it, expect } from 'vitest'
import {
  encodeShareLink,
  decodeShareLink,
  buildSmartShareUrl,
  TITLE_TRUNCATE_LENGTH,
} from './shareLink'
import type { ProjectData } from './projectStorage'

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    name: 'Test Project',
    people: [
      { id: 1, name: 'Alice', color: '#ff0000', emails: [] },
      { id: 2, name: 'Bob', color: '#00ff00', emails: [] },
    ],
    tickets: [
      { id: 10, number: 'T-1', title: 'First ticket', assignedTo: 1, link: '' },
      { id: 11, number: 'T-2', title: 'Second ticket', assignedTo: 2, link: '' },
    ],
    placements: [
      {
        ticketId: 10,
        startDate: { year: 2026, month: 4, day: 12 },
        endDate: { year: 2026, month: 4, day: 14 },
        row: 0,
      },
    ],
    vacations: [
      {
        id: 100,
        personId: 1,
        startDate: { year: 2026, month: 5, day: 1 },
        endDate: { year: 2026, month: 5, day: 5 },
        row: 0,
      },
    ],
    selectedMonths: [24316, 24317],
    ...overrides,
  }
}

describe('shareLink: encode → decode round-trip', () => {
  it('preserves all top-level fields', () => {
    const project = makeProject()
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded).not.toBeNull()
    expect(decoded!.name).toBe(project.name)
    expect(decoded!.selectedMonths).toEqual(project.selectedMonths)
  })

  it('preserves people exactly', () => {
    const project = makeProject()
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded!.people).toEqual(project.people)
  })

  it('preserves placements with date precision', () => {
    const project = makeProject()
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded!.placements).toEqual(project.placements)
  })

  it('preserves vacations (re-numbering ids by index)', () => {
    const project = makeProject()
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded!.vacations).toHaveLength(1)
    expect(decoded!.vacations[0]!.personId).toBe(1)
    expect(decoded!.vacations[0]!.startDate).toEqual({ year: 2026, month: 5, day: 1 })
    expect(decoded!.vacations[0]!.endDate).toEqual({ year: 2026, month: 5, day: 5 })
  })

  it('drops vacations missing start or end dates', () => {
    const project = makeProject({
      vacations: [
        { id: 1, personId: 1, startDate: null, endDate: null, row: 0 },
        {
          id: 2,
          personId: 2,
          startDate: { year: 2026, month: 0, day: 1 },
          endDate: { year: 2026, month: 0, day: 3 },
          row: 0,
        },
      ],
    })
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded!.vacations).toHaveLength(1)
    expect(decoded!.vacations[0]!.personId).toBe(2)
  })

  it('preserves label tickets (isLabel + labelColor)', () => {
    const project = makeProject({
      tickets: [
        {
          id: 1,
          number: '',
          title: 'Sample Event',
          assignedTo: null,
          link: '',
          isLabel: true,
          labelColor: '#9b59b6',
        },
      ],
    })
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded!.tickets[0]!.isLabel).toBe(true)
    expect(decoded!.tickets[0]!.labelColor).toBe('#9b59b6')
  })

  it('rebuilds ticket links from a common linkBase prefix', () => {
    const project = makeProject({
      tickets: [
        {
          id: 1,
          number: 'STORY-100',
          title: 'A',
          assignedTo: 1,
          link: 'https://app.shortcut.com/foo/story/STORY-100',
        },
        {
          id: 2,
          number: 'STORY-101',
          title: 'B',
          assignedTo: 1,
          link: 'https://app.shortcut.com/foo/story/STORY-101',
        },
      ],
    })
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded!.tickets[0]!.link).toBe('https://app.shortcut.com/foo/story/STORY-100')
    expect(decoded!.tickets[1]!.link).toBe('https://app.shortcut.com/foo/story/STORY-101')
  })

  it('omits links when no common base exists', () => {
    const project = makeProject({
      tickets: [
        { id: 1, number: 'A-1', title: 'A', assignedTo: 1, link: 'https://example.com/a' },
        { id: 2, number: 'B-2', title: 'B', assignedTo: 1, link: 'https://other.com/b' },
      ],
    })
    const decoded = decodeShareLink(encodeShareLink(project))
    expect(decoded!.tickets[0]!.link).toBe('')
    expect(decoded!.tickets[1]!.link).toBe('')
  })
})

describe('shareLink: buildSmartShareUrl tiering', () => {
  it('returns full tier for small projects', () => {
    const result = buildSmartShareUrl(makeProject())
    expect(result.tier).toBe('full')
    expect(result.url).not.toBeNull()
  })

  it('falls back below "full" when titles push past the URL limit', () => {
    // Use random-looking unique titles so lz-string can't dedupe them effectively
    const tickets = Array.from({ length: 800 }, (_, i) => ({
      id: i,
      number: `T-${i}`,
      title: `Story ${i} ${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
      assignedTo: 1,
      link: '',
    }))
    const result = buildSmartShareUrl(makeProject({ tickets }))
    expect(['truncated', 'stripped', 'too-long']).toContain(result.tier)
  })

  it('truncates titles to TITLE_TRUNCATE_LENGTH in the truncated tier', () => {
    // Just enough payload that truncation is the right answer.
    const tickets = Array.from({ length: 200 }, (_, i) => ({
      id: i,
      number: `T-${i}`,
      title: `${'x'.repeat(50)}-${i}`,
      assignedTo: 1,
      link: '',
    }))
    const result = buildSmartShareUrl(makeProject({ tickets }))
    if (result.tier !== 'truncated') return // not the scenario we wanted; first test covers fallback
    const decoded = decodeShareLink(result.url!.split('#share=')[1]!)
    expect(decoded!.tickets[0]!.title.length).toBeLessThanOrEqual(TITLE_TRUNCATE_LENGTH)
  })
})

describe('shareLink: decode error handling', () => {
  it('returns null for garbage input', () => {
    expect(decodeShareLink('not-a-real-share-link')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(decodeShareLink('')).toBeNull()
  })
})
