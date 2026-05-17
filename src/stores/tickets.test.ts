import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTicketsStore, compareCalendarDates } from './tickets'
import type { CalendarDate } from './tickets'

const d = (year: number, month: number, day: number): CalendarDate => ({ year, month, day })

describe('tickets store: compareCalendarDates', () => {
  it('returns negative when a is before b', () => {
    expect(compareCalendarDates(d(2026, 4, 1), d(2026, 4, 2))).toBeLessThan(0)
    expect(compareCalendarDates(d(2026, 3, 30), d(2026, 4, 1))).toBeLessThan(0)
    expect(compareCalendarDates(d(2025, 11, 31), d(2026, 0, 1))).toBeLessThan(0)
  })

  it('returns zero for equal dates', () => {
    expect(compareCalendarDates(d(2026, 4, 11), d(2026, 4, 11))).toBe(0)
  })

  it('returns positive when a is after b', () => {
    expect(compareCalendarDates(d(2026, 4, 2), d(2026, 4, 1))).toBeGreaterThan(0)
    expect(compareCalendarDates(d(2026, 5, 1), d(2026, 4, 30))).toBeGreaterThan(0)
  })
})

describe('tickets store: addTicket', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('assigns monotonically increasing ids', () => {
    const tickets = useTicketsStore()
    const a = tickets.addTicket({ number: 'A', title: 'a', assignedTo: null, link: '' })
    const b = tickets.addTicket({ number: 'B', title: 'b', assignedTo: null, link: '' })
    const c = tickets.addTicket({ number: 'C', title: 'c', assignedTo: null, link: '' })
    expect(b).toBe(a + 1)
    expect(c).toBe(b + 1)
  })

  it('appends to tickets array', () => {
    const tickets = useTicketsStore()
    tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: 'url' })
    expect(tickets.tickets).toHaveLength(1)
    expect(tickets.tickets[0]).toMatchObject({ number: 'A', title: 'a', assignedTo: 1, link: 'url' })
  })
})

describe('tickets store: updateTicket', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('patches only the provided fields', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'old', assignedTo: 1, link: '' })
    tickets.updateTicket(id, { title: 'new' })
    expect(tickets.tickets[0]).toMatchObject({ number: 'A', title: 'new', assignedTo: 1 })
  })

  it('is a no-op for unknown ids', () => {
    const tickets = useTicketsStore()
    tickets.addTicket({ number: 'A', title: 'a', assignedTo: null, link: '' })
    expect(() => tickets.updateTicket(999, { title: 'x' })).not.toThrow()
    expect(tickets.tickets[0]!.title).toBe('a')
  })
})

describe('tickets store: deleteTicket', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('removes the ticket', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: null, link: '' })
    tickets.deleteTicket(id)
    expect(tickets.tickets).toHaveLength(0)
  })

  it('also removes any placement for the ticket', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 10))
    expect(tickets.placements).toHaveLength(1)
    tickets.deleteTicket(id)
    expect(tickets.placements).toHaveLength(0)
  })
})

describe('tickets store: placeTicket / moveTicket / removePlacement', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('placeTicket creates a single-day placement', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    expect(tickets.placements).toHaveLength(1)
    expect(tickets.placements[0]).toMatchObject({
      ticketId: id,
      startDate: d(2026, 4, 11),
      endDate: d(2026, 4, 11),
    })
  })

  it('placeTicket replaces an existing placement (no duplicates)', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.placeTicket(id, d(2026, 4, 20))
    expect(tickets.placements).toHaveLength(1)
    expect(tickets.placements[0]!.startDate).toEqual(d(2026, 4, 20))
  })

  it('moveTicket updates start and end dates', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.moveTicket(id, d(2026, 4, 12), d(2026, 4, 15))
    expect(tickets.placements[0]).toMatchObject({
      startDate: d(2026, 4, 12),
      endDate: d(2026, 4, 15),
    })
  })

  it('moveTicket is a no-op for unplaced tickets', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    expect(() => tickets.moveTicket(id, d(2026, 4, 12), d(2026, 4, 15))).not.toThrow()
    expect(tickets.placements).toHaveLength(0)
  })

  it('removePlacement leaves the ticket but drops the placement', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.removePlacement(id)
    expect(tickets.placements).toHaveLength(0)
    expect(tickets.tickets).toHaveLength(1)
  })
})

describe('tickets store: resizePlacement', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('extends the start backward when given an earlier date', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.moveTicket(id, d(2026, 4, 11), d(2026, 4, 15))
    tickets.resizePlacement(id, 'start', d(2026, 4, 8))
    expect(tickets.placements[0]!.startDate).toEqual(d(2026, 4, 8))
  })

  it('extends the end forward when given a later date', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.resizePlacement(id, 'end', d(2026, 4, 20))
    expect(tickets.placements[0]!.endDate).toEqual(d(2026, 4, 20))
  })

  it('refuses to drag start past end (would invert)', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.moveTicket(id, d(2026, 4, 11), d(2026, 4, 15))
    tickets.resizePlacement(id, 'start', d(2026, 4, 20)) // after end
    expect(tickets.placements[0]!.startDate).toEqual(d(2026, 4, 11)) // unchanged
  })

  it('refuses to drag end before start (would invert)', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.moveTicket(id, d(2026, 4, 11), d(2026, 4, 15))
    tickets.resizePlacement(id, 'end', d(2026, 4, 5)) // before start
    expect(tickets.placements[0]!.endDate).toEqual(d(2026, 4, 15)) // unchanged
  })
})

describe('tickets store: getPlacementsForMonth', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('returns placements whose dates fall in the given month', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    expect(tickets.getPlacementsForMonth(2026, 4)).toHaveLength(1)
    expect(tickets.getPlacementsForMonth(2026, 5)).toHaveLength(0)
  })

  it('returns placements that straddle the month boundary', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'A', title: 'a', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 28))
    tickets.moveTicket(id, d(2026, 4, 28), d(2026, 5, 3))
    expect(tickets.getPlacementsForMonth(2026, 4)).toHaveLength(1)
    expect(tickets.getPlacementsForMonth(2026, 5)).toHaveLength(1)
  })
})

describe('tickets store: loadData', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('replaces tickets and placements', () => {
    const tickets = useTicketsStore()
    tickets.addTicket({ number: 'OLD', title: 'old', assignedTo: 1, link: '' })
    tickets.loadData({
      tickets: [{ id: 100, number: 'NEW', title: 'new', assignedTo: 2, link: '' }],
      placements: [{ ticketId: 100, startDate: d(2026, 4, 11), endDate: d(2026, 4, 12) }],
    })
    expect(tickets.tickets).toHaveLength(1)
    expect(tickets.tickets[0]!.number).toBe('NEW')
    expect(tickets.placements).toHaveLength(1)
  })

  it('seeds nextId past the loaded max so subsequent addTicket ids do not collide', () => {
    const tickets = useTicketsStore()
    tickets.loadData({
      tickets: [{ id: 50, number: 'A', title: 'a', assignedTo: null, link: '' }],
      placements: [],
    })
    const newId = tickets.addTicket({ number: 'B', title: 'b', assignedTo: null, link: '' })
    expect(newId).toBeGreaterThan(50)
  })
})

describe('tickets store: hasTicketOverlappingRange', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns false when the person has no tickets', () => {
    const tickets = useTicketsStore()
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 12))).toBe(false)
  })

  it('returns true when a single-day ticket falls inside the range', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 12))).toBe(true)
  })

  it('returns true when the ticket spans the range (no endpoint inside it)', () => {
    // This is the regression: Mon–Fri ticket vs Wed–Thu vacation. Neither
    // endpoint of the ticket is inside the range, but it clearly overlaps.
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    tickets.moveTicket(id, d(2026, 4, 11), d(2026, 4, 15)) // Mon–Fri
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 13), d(2026, 4, 14))).toBe(true)
  })

  it('returns true when only the ticket end falls inside the range', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 8))
    tickets.moveTicket(id, d(2026, 4, 8), d(2026, 4, 11))
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 13))).toBe(true)
  })

  it('returns true when only the ticket start falls inside the range', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 12))
    tickets.moveTicket(id, d(2026, 4, 12), d(2026, 4, 15))
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 13))).toBe(true)
  })

  it('returns false when the ticket is entirely before the range', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 5))
    tickets.moveTicket(id, d(2026, 4, 5), d(2026, 4, 8))
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 13))).toBe(false)
  })

  it('returns false when the ticket is entirely after the range', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 20))
    tickets.moveTicket(id, d(2026, 4, 20), d(2026, 4, 22))
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 13))).toBe(false)
  })

  it('ignores tickets assigned to a different person', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 2, link: '' })
    tickets.placeTicket(id, d(2026, 4, 11))
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 12))).toBe(false)
  })

  it('ignores label tickets (events), not just person-assigned ones', () => {
    // Events aren't owned by a person; they should never block vacation assignment.
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: '', title: 'Beta release', assignedTo: null, link: '', isLabel: true })
    tickets.placeTicket(id, d(2026, 4, 11))
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 12))).toBe(false)
  })

  it('ignores unplaced tickets', () => {
    const tickets = useTicketsStore()
    tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 12))).toBe(false)
  })

  it('handles range and ticket touching at exactly one day (inclusive boundaries)', () => {
    const tickets = useTicketsStore()
    const id = tickets.addTicket({ number: 'T-1', title: 't', assignedTo: 1, link: '' })
    tickets.placeTicket(id, d(2026, 4, 13))
    tickets.moveTicket(id, d(2026, 4, 13), d(2026, 4, 13))
    // Range ends exactly where ticket starts — single-day overlap counts.
    expect(tickets.hasTicketOverlappingRange(1, d(2026, 4, 10), d(2026, 4, 13))).toBe(true)
  })
})
