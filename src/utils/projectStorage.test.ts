import { describe, it, expect, beforeEach } from 'vitest'
import { getSavedProjects, setSavedProjects, STORAGE_KEY } from './projectStorage'
import type { SavedProject } from './projectStorage'

function makeProject(name: string): SavedProject {
  return {
    id: `id-${name}`,
    name,
    savedAt: '2026-01-01T00:00:00.000Z',
    data: {
      tickets: [],
      placements: [],
      people: [],
      vacations: [],
      selectedMonths: [],
    },
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('projectStorage', () => {
  it('returns empty array when nothing is stored', () => {
    expect(getSavedProjects()).toEqual([])
  })

  it('round-trips projects through set → get', () => {
    const projects = [makeProject('Alpha'), makeProject('Beta')]
    setSavedProjects(projects)
    expect(getSavedProjects()).toEqual(projects)
  })

  it('writes a versioned envelope (not a raw array)', () => {
    setSavedProjects([makeProject('Alpha')])
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(raw).toMatchObject({ version: expect.any(Number), projects: expect.any(Array) })
  })

  it('migrates a legacy raw-array payload (pre-versioning)', () => {
    const legacyProjects = [makeProject('Legacy')]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyProjects))
    expect(getSavedProjects()).toEqual(legacyProjects)
  })

  it('returns empty array on malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json {{')
    expect(getSavedProjects()).toEqual([])
  })

  it('returns empty array on a versioned envelope with non-array projects', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, projects: 'oops' }))
    expect(getSavedProjects()).toEqual([])
  })

  it('returns empty array on an unrecognized object shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    expect(getSavedProjects()).toEqual([])
  })
})
