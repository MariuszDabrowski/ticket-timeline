import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVacationsStore } from './vacations'
import type { CalendarDate } from './tickets'

const d = (year: number, month: number, day: number): CalendarDate => ({ year, month, day })

describe('vacations store: addVacation', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('creates an unplaced entry (null dates) tied to a person', () => {
    const vacations = useVacationsStore()
    const id = vacations.addVacation(1)
    expect(vacations.entries).toHaveLength(1)
    expect(vacations.entries[0]).toMatchObject({ id, personId: 1, startDate: null, endDate: null })
  })

  it('assigns monotonically increasing ids', () => {
    const vacations = useVacationsStore()
    const a = vacations.addVacation(1)
    const b = vacations.addVacation(2)
    expect(b).toBe(a + 1)
  })
})

describe('vacations store: unplacedVacations', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('lists only entries without dates', () => {
    const vacations = useVacationsStore()
    const a = vacations.addVacation(1)
    vacations.addVacation(2)
    vacations.placeVacation(a, d(2026, 4, 11), d(2026, 4, 13))
    expect(vacations.unplacedVacations).toHaveLength(1)
    expect(vacations.unplacedVacations[0]!.personId).toBe(2)
  })
})

describe('vacations store: placeVacation / moveVacation', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('placeVacation sets start and end dates', () => {
    const vacations = useVacationsStore()
    const id = vacations.addVacation(1)
    vacations.placeVacation(id, d(2026, 4, 11), d(2026, 4, 13))
    expect(vacations.entries[0]).toMatchObject({
      startDate: d(2026, 4, 11),
      endDate: d(2026, 4, 13),
    })
  })

  it('moveVacation overwrites the dates', () => {
    const vacations = useVacationsStore()
    const id = vacations.addVacation(1)
    vacations.placeVacation(id, d(2026, 4, 11), d(2026, 4, 13))
    vacations.moveVacation(id, d(2026, 4, 20), d(2026, 4, 22))
    expect(vacations.entries[0]).toMatchObject({
      startDate: d(2026, 4, 20),
      endDate: d(2026, 4, 22),
    })
  })

  it('placeVacation and moveVacation are no-ops for unknown ids', () => {
    const vacations = useVacationsStore()
    expect(() => vacations.placeVacation(999, d(2026, 4, 1), d(2026, 4, 2))).not.toThrow()
    expect(() => vacations.moveVacation(999, d(2026, 4, 1), d(2026, 4, 2))).not.toThrow()
    expect(vacations.entries).toHaveLength(0)
  })
})

describe('vacations store: removeVacation', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('removes the entry', () => {
    const vacations = useVacationsStore()
    const id = vacations.addVacation(1)
    vacations.removeVacation(id)
    expect(vacations.entries).toHaveLength(0)
  })

  it('does nothing for unknown ids', () => {
    const vacations = useVacationsStore()
    vacations.addVacation(1)
    vacations.removeVacation(999)
    expect(vacations.entries).toHaveLength(1)
  })
})

describe('vacations store: removeVacationsForPerson', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('drops all entries for the given personId', () => {
    const vacations = useVacationsStore()
    vacations.addVacation(1)
    vacations.addVacation(1)
    vacations.addVacation(2)
    vacations.removeVacationsForPerson(1)
    expect(vacations.entries).toHaveLength(1)
    expect(vacations.entries[0]!.personId).toBe(2)
  })
})

describe('vacations store: addVacations', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('appends new entries with fresh ids', () => {
    const vacations = useVacationsStore()
    vacations.addVacations([
      { personId: 1, startDate: d(2026, 4, 1), endDate: d(2026, 4, 2), row: 0 },
      { personId: 2, startDate: d(2026, 4, 3), endDate: d(2026, 4, 4), row: 0 },
    ])
    expect(vacations.entries).toHaveLength(2)
    expect(vacations.entries[0]!.id).not.toBe(vacations.entries[1]!.id)
  })

  it('replaces existing entries for any person mentioned in the incoming batch', () => {
    // HiBob re-sync pattern: importing fresh vacations for Alex should drop
    // Alex's previous vacations but leave Myra's alone.
    const vacations = useVacationsStore()
    const oldAlex = vacations.addVacation(1)
    vacations.placeVacation(oldAlex, d(2026, 3, 1), d(2026, 3, 5))
    const myra = vacations.addVacation(2)
    vacations.placeVacation(myra, d(2026, 4, 10), d(2026, 4, 12))

    vacations.addVacations([
      { personId: 1, startDate: d(2026, 4, 20), endDate: d(2026, 4, 22), row: 0 },
    ])

    expect(vacations.entries).toHaveLength(2)
    // Myra's vacation is untouched
    expect(vacations.entries.find((e) => e.personId === 2)?.startDate).toEqual(d(2026, 4, 10))
    // Alex's vacation is now the new one (old one was wiped)
    const alexEntries = vacations.entries.filter((e) => e.personId === 1)
    expect(alexEntries).toHaveLength(1)
    expect(alexEntries[0]!.startDate).toEqual(d(2026, 4, 20))
  })
})

describe('vacations store: getVacationsForMonth', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('returns vacations whose dates fall in the month', () => {
    const vacations = useVacationsStore()
    const id = vacations.addVacation(1)
    vacations.placeVacation(id, d(2026, 4, 11), d(2026, 4, 13))
    expect(vacations.getVacationsForMonth(2026, 4)).toHaveLength(1)
    expect(vacations.getVacationsForMonth(2026, 5)).toHaveLength(0)
  })

  it('skips unplaced vacations', () => {
    const vacations = useVacationsStore()
    vacations.addVacation(1)
    expect(vacations.getVacationsForMonth(2026, 4)).toHaveLength(0)
  })

  it('returns vacations that straddle the month boundary', () => {
    const vacations = useVacationsStore()
    const id = vacations.addVacation(1)
    vacations.placeVacation(id, d(2026, 4, 28), d(2026, 5, 3))
    expect(vacations.getVacationsForMonth(2026, 4)).toHaveLength(1)
    expect(vacations.getVacationsForMonth(2026, 5)).toHaveLength(1)
  })
})

describe('vacations store: loadData', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('replaces all entries and seeds nextId past the loaded max', () => {
    const vacations = useVacationsStore()
    vacations.addVacation(1) // gets id 0 — should be wiped
    vacations.loadData([
      { id: 10, personId: 5, startDate: d(2026, 4, 1), endDate: d(2026, 4, 2), row: 0 },
    ])
    expect(vacations.entries).toHaveLength(1)
    expect(vacations.entries[0]!.id).toBe(10)

    const newId = vacations.addVacation(99)
    expect(newId).toBeGreaterThan(10)
  })
})
