import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Ticket {
  id: number
  number: string
  title: string
  assignedTo: number | null
  link: string
}

export interface Placement {
  ticketId: number
  year: number
  month: number
  startDay: number
  endDay: number
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

  function placeTicket(ticketId: number, year: number, month: number, day: number) {
    const existing = placements.value.findIndex((p) => p.ticketId === ticketId)
    if (existing !== -1) placements.value.splice(existing, 1)
    placements.value.push({ ticketId, year, month, startDay: day, endDay: day })
  }

  function moveTicket(ticketId: number, newStartDay: number) {
    const placement = placements.value.find((p) => p.ticketId === ticketId)
    if (!placement) return
    const span = placement.endDay - placement.startDay
    placement.startDay = newStartDay
    placement.endDay = newStartDay + span
  }

  function resizePlacement(ticketId: number, side: 'start' | 'end', day: number) {
    const placement = placements.value.find((p) => p.ticketId === ticketId)
    if (!placement) return
    if (side === 'start' && day <= placement.endDay) placement.startDay = day
    if (side === 'end' && day >= placement.startDay) placement.endDay = day
  }

  function getPlacementsForDay(year: number, month: number, day: number): Placement[] {
    return placements.value.filter(
      (p) => p.year === year && p.month === month && p.startDay <= day && day <= p.endDay,
    )
  }

  return { tickets, placements, addTicket, placeTicket, moveTicket, resizePlacement, getPlacementsForDay }
})
