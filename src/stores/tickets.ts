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


export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}


export const useTicketsStore = defineStore('tickets', () => {
  const tickets = ref<Ticket[]>([])
  const placements = ref<Placement[]>([])
  let nextId = 0

  function addTicket(ticket: Omit<Ticket, 'id'>) {
    tickets.value.push({ id: nextId++, ...ticket })
  }

  function placeTicket(ticketId: number, date: CalendarDate) {
    const existing = placements.value.findIndex((p) => p.ticketId === ticketId)
    if (existing !== -1) placements.value.splice(existing, 1)
    placements.value.push({ ticketId, startDate: date, endDate: date })
  }

  function moveTicket(ticketId: number, newStartDate: CalendarDate, newEndDate: CalendarDate) {
    const placement = placements.value.find((p) => p.ticketId === ticketId)
    if (!placement) return
    placement.startDate = newStartDate
    placement.endDate = newEndDate
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

  function removePlacementsForMonth(year: number, month: number) {
    const monthStart: CalendarDate = { year, month, day: 1 }
    const monthEnd: CalendarDate = { year, month, day: new Date(year, month + 1, 0).getDate() }
    placements.value = placements.value.filter(
      (p) =>
        compareCalendarDates(p.startDate, monthEnd) > 0 ||
        compareCalendarDates(p.endDate, monthStart) < 0,
    )
  }

  return { tickets, placements, addTicket, updateTicket, deleteTicket, placeTicket, moveTicket, removePlacement, resizePlacement, getPlacementsForMonth, removePlacementsForMonth }
})
