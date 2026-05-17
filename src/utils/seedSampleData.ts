import type { usePeopleStore } from '../stores/people'
import type { useTicketsStore } from '../stores/tickets'
import type { useVacationsStore } from '../stores/vacations'
import type { CalendarDate } from '../stores/tickets'
import { findFirstFreeRow, combineRowOccupants } from '../stores/tickets'

function toCalDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

function calAddDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function seedSampleData(
  people: ReturnType<typeof usePeopleStore>,
  tickets: ReturnType<typeof useTicketsStore>,
  vacations: ReturnType<typeof useVacationsStore>,
) {
  const now = new Date()

  // Anchor on the first Monday of the current month so the demo always lands on
  // a clean week boundary regardless of when someone visits.
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDow = firstOfMonth.getDay()
  const monday1 = calAddDays(firstOfMonth, (8 - firstDow) % 7)
  const monday2 = calAddDays(monday1, 7)

  // People
  const alexId = people.addPerson('Alex', '#3498db')
  const myraId = people.addPerson('Myra', '#e91e63')

  // Helper: place a ticket spanning [startOffset, endOffset] days from the given Monday
  function placeFor(weekStart: Date, ticketId: number, startOffset: number, endOffset: number) {
    const start = toCalDate(calAddDays(weekStart, startOffset))
    const end = toCalDate(calAddDays(weekStart, endOffset))
    const row = findFirstFreeRow(combineRowOccupants(tickets.placements, vacations.entries), start, end)
    tickets.placeTicket(ticketId, start, row)
    tickets.moveTicket(ticketId, start, end)
  }

  // Week 1 — looks like a real busy planning week
  const t1 = tickets.addTicket({ number: 'PROJ-142', title: 'Migrate user permissions table', assignedTo: myraId, link: '' })
  placeFor(monday1, t1, 0, 1)

  const t2 = tickets.addTicket({ number: 'PROJ-148', title: 'Refactor auth middleware', assignedTo: alexId, link: '' })
  placeFor(monday1, t2, 1, 3)

  const t3 = tickets.addTicket({ number: 'PROJ-153', title: 'Update API rate limits', assignedTo: myraId, link: '' })
  placeFor(monday1, t3, 2, 3)

  const bufferId = tickets.addTicket({ number: '', title: 'Buffer', assignedTo: null, link: '', isLabel: true, labelColor: '#c47f10' })
  placeFor(monday1, bufferId, 3, 4)

  // Week 2
  const t4 = tickets.addTicket({ number: 'PROJ-156', title: 'Frontend pagination fix', assignedTo: alexId, link: '' })
  placeFor(monday2, t4, 0, 2)

  const releaseId = tickets.addTicket({ number: '', title: 'Beta release', assignedTo: null, link: '', isLabel: true, labelColor: '#148a72' })
  placeFor(monday2, releaseId, 3, 3)

  // Myra is out for the back half of week 2 — shows the vacation pill in context
  // without overlapping any of her assigned work (which would look like a planning error).
  // Compute the row against tickets + earlier-placed vacations so the vacation
  // lands at the lowest free row (and doesn't collide with PROJ-156 on Wed).
  const vacStart = toCalDate(calAddDays(monday2, 2))
  const vacEnd = toCalDate(calAddDays(monday2, 4))
  const vacRow = findFirstFreeRow(
    combineRowOccupants(tickets.placements, vacations.entries),
    vacStart,
    vacEnd,
  )
  const vacId = vacations.addVacation(myraId)
  vacations.placeVacation(vacId, vacStart, vacEnd, vacRow)

  // Backlog — gives a first-time visitor something to drag onto the calendar
  tickets.addTicket({ number: 'PROJ-161', title: 'Add audit logging', assignedTo: alexId, link: '' })
  tickets.addTicket({ number: '', title: 'Code freeze', assignedTo: null, link: '', isLabel: true, labelColor: '#5d4037' })
}
