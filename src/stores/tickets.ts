import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Ticket {
  id: number
  number: string
  title: string
  assignedTo: number | null
  link: string
}

export const useTicketsStore = defineStore('tickets', () => {
  const tickets = ref<Ticket[]>([])
  let nextId = 0

  function addTicket(ticket: Omit<Ticket, 'id'>) {
    tickets.value.push({ id: nextId++, ...ticket })
  }

  return { tickets, addTicket }
})
