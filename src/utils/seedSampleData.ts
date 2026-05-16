import type { usePeopleStore } from '../stores/people'
import type { useTicketsStore } from '../stores/tickets'
import type { CalendarDate } from '../stores/tickets'

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
) {
  const now = new Date()

  // Find the second full week of the current month for ticket/event placement
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDow = firstOfMonth.getDay()
  const monday1 = calAddDays(firstOfMonth, (8 - firstDow) % 7)
  const monday2 = calAddDays(monday1, 7)

  // Sample Ticket 1: Tue–Thu of week 2
  const t1Start = toCalDate(calAddDays(monday2, 1))
  const t1End = toCalDate(calAddDays(monday2, 3))

  // Sample Event 1: last 2 days of ticket 1 (Wed–Thu of week 2)
  const e1Start = toCalDate(calAddDays(monday2, 2))
  const e1End = toCalDate(calAddDays(monday2, 3))

  const user1Id = people.addPerson('Sample User 1', '#3498db')
  const user2Id = people.addPerson('Sample User 2', '#e91e63')

  const t1Id = tickets.addTicket({ number: 'Sample Ticket 1', title: 'Sample Ticket 1', assignedTo: user1Id, link: '' })
  tickets.placeTicket(t1Id, t1Start)
  tickets.moveTicket(t1Id, t1Start, t1End)

  tickets.addTicket({ number: 'Sample Ticket 2', title: 'Sample Ticket 2', assignedTo: user2Id, link: '' })

  const e1Id = tickets.addTicket({ number: '', title: 'Sample Event 1', assignedTo: null, link: '', isLabel: true, labelColor: '#9b59b6' })
  tickets.placeTicket(e1Id, e1Start)
  tickets.moveTicket(e1Id, e1Start, e1End)

  tickets.addTicket({ number: '', title: 'Sample Event 2', assignedTo: null, link: '', isLabel: true, labelColor: '#148a72' })
}
