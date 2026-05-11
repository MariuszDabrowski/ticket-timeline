import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Ticket {
  id: number
  number: string
  title: string
  assignedTo: number | null
  link: string
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
}

function toDate(d: CalendarDate): Date {
  return new Date(d.year, d.month, d.day)
}

function fromDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = toDate(date)
  d.setDate(d.getDate() + days)
  return fromDate(d)
}

function daysBetween(start: CalendarDate, end: CalendarDate): number {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / 86_400_000)
}

export const useTicketsStore = defineStore('tickets', () => {
  const tickets = ref<Ticket[]>([
    { id: 0, number: 'TT-1', title: 'Set up project scaffolding', assignedTo: 0, link: '' },
    { id: 1, number: 'TT-2', title: 'Implement sidebar layout', assignedTo: 0, link: '' },
    { id: 2, number: 'TT-3', title: 'Add drag and drop support', assignedTo: 1, link: '' },
  ])
  const placements = ref<Placement[]>([])
  let nextId = 3

  function addTicket(ticket: Omit<Ticket, 'id'>) {
    tickets.value.push({ id: nextId++, ...ticket })
  }

  function placeTicket(ticketId: number, date: CalendarDate) {
    const existing = placements.value.findIndex((p) => p.ticketId === ticketId)
    if (existing !== -1) placements.value.splice(existing, 1)
    placements.value.push({ ticketId, startDate: date, endDate: date })
  }

  function moveTicket(ticketId: number, newStartDate: CalendarDate) {
    const placement = placements.value.find((p) => p.ticketId === ticketId)
    if (!placement) return
    const span = daysBetween(placement.startDate, placement.endDate)
    placement.startDate = newStartDate
    placement.endDate = addDays(newStartDate, span)
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

  return { tickets, placements, addTicket, placeTicket, moveTicket, resizePlacement, getPlacementsForMonth }
})
