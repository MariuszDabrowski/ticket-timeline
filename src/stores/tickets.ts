import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Ticket {
  id: number
  number: string
  title: string
  assignedTo: number | null
  link: string
  isLabel?: boolean
  labelColor?: string
}

export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface Placement {
  ticketId: number
  startDate: CalendarDate
  endDate: CalendarDate
  row: number
}


export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

// Lowest row that doesn't overlap any occupant on any day in [startDate, endDate].
// Used for first-time placement (sample seed, CSV import, ICS import) where the
// user hasn't explicitly picked a row. Accepts a generic occupant shape so it
// can fold tickets + vacations together (both share the row space).
export interface RowOccupant {
  startDate: CalendarDate
  endDate: CalendarDate
  row: number
}
export function findFirstFreeRow(
  occupants: RowOccupant[],
  startDate: CalendarDate,
  endDate: CalendarDate,
): number {
  for (let row = 0; ; row++) {
    const conflict = occupants.some((o) =>
      o.row === row &&
      compareCalendarDates(o.startDate, endDate) <= 0 &&
      compareCalendarDates(o.endDate, startDate) >= 0,
    )
    if (!conflict) return row
  }
}

// Merge ticket placements + placed vacations into a single occupant list so
// findFirstFreeRow considers the shared row space (per the drag/drop spec).
// Caller passes the raw store collections — kept generic so this util doesn't
// need to import the vacations store directly.
export function combineRowOccupants(
  ticketPlacements: Placement[],
  vacationEntries: Array<{ startDate: CalendarDate | null; endDate: CalendarDate | null; row: number }>,
): RowOccupant[] {
  const occupants: RowOccupant[] = [...ticketPlacements]
  for (const v of vacationEntries) {
    if (v.startDate === null || v.endDate === null) continue
    occupants.push({ startDate: v.startDate, endDate: v.endDate, row: v.row })
  }
  return occupants
}


export const useTicketsStore = defineStore('tickets', () => {
  const tickets = ref<Ticket[]>([])
  const placements = ref<Placement[]>([])
  let nextId = 0

  function addTicket(ticket: Omit<Ticket, 'id'>): number {
    const id = nextId++
    tickets.value.push({ id, ...ticket })
    return id
  }

  function placeTicket(ticketId: number, date: CalendarDate, row: number) {
    const existing = placements.value.findIndex((p) => p.ticketId === ticketId)
    if (existing !== -1) placements.value.splice(existing, 1)
    placements.value.push({ ticketId, startDate: date, endDate: date, row })
  }

  function moveTicket(ticketId: number, newStartDate: CalendarDate, newEndDate: CalendarDate, row?: number) {
    const placement = placements.value.find((p) => p.ticketId === ticketId)
    if (!placement) return
    placement.startDate = newStartDate
    placement.endDate = newEndDate
    if (row !== undefined) placement.row = row
  }

  function updateTicket(id: number, data: Partial<Omit<Ticket, 'id'>>) {
    const ticket = tickets.value.find((t) => t.id === id)
    if (ticket) Object.assign(ticket, data)
  }

  function deleteTicket(id: number) {
    const idx = tickets.value.findIndex((t) => t.id === id)
    if (idx !== -1) tickets.value.splice(idx, 1)
    const pIdx = placements.value.findIndex((p) => p.ticketId === id)
    if (pIdx !== -1) placements.value.splice(pIdx, 1)
  }

  function removePlacement(ticketId: number) {
    const idx = placements.value.findIndex((p) => p.ticketId === ticketId)
    if (idx !== -1) placements.value.splice(idx, 1)
  }

  function resizePlacement(ticketId: number, side: 'start' | 'end', date: CalendarDate) {
    const placement = placements.value.find((p) => p.ticketId === ticketId)
    if (!placement) return
    if (side === 'start' && compareCalendarDates(date, placement.endDate) <= 0)
      placement.startDate = date
    if (side === 'end' && compareCalendarDates(date, placement.startDate) >= 0)
      placement.endDate = date
  }

  function getPlacementsForMonth(year: number, month: number): Placement[] {
    const monthStart: CalendarDate = { year, month, day: 1 }
    const monthEnd: CalendarDate = { year, month, day: new Date(year, month + 1, 0).getDate() }
    return placements.value.filter(
      (p) =>
        compareCalendarDates(p.startDate, monthEnd) <= 0 &&
        compareCalendarDates(p.endDate, monthStart) >= 0,
    )
  }

  // True overlap (not just endpoint hits): catches multi-day tickets that span
  // the given range even when neither endpoint falls inside it (e.g. a Mon–Fri
  // ticket vs a Wed–Thu vacation). Used by vacation conflict validation.
  function hasTicketOverlappingRange(personId: number, start: CalendarDate, end: CalendarDate): boolean {
    return placements.value.some((p) => {
      const ticket = tickets.value.find((t) => t.id === p.ticketId)
      if (!ticket || ticket.isLabel || ticket.assignedTo !== personId) return false
      return compareCalendarDates(p.startDate, end) <= 0 &&
             compareCalendarDates(p.endDate, start) >= 0
    })
  }

  function loadData(data: { tickets: Ticket[]; placements: Placement[] }) {
    tickets.value = data.tickets
    placements.value = data.placements
    nextId = data.tickets.length > 0 ? Math.max(...data.tickets.map((t) => t.id)) + 1 : 0
  }

  return { tickets, placements, addTicket, updateTicket, deleteTicket, placeTicket, moveTicket, removePlacement, resizePlacement, getPlacementsForMonth, hasTicketOverlappingRange, loadData }
})
