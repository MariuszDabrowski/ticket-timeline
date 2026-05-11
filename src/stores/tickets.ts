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
  day: number
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
    placements.value.push({ ticketId, year, month, day })
  }

  function getPlacementsForDay(year: number, month: number, day: number): Placement[] {
    return placements.value.filter(
      (p) => p.year === year && p.month === month && p.day === day,
    )
  }

  return { tickets, placements, addTicket, placeTicket, getPlacementsForDay }
})
