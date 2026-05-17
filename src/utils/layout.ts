import type { useTicketsStore } from '../stores/tickets'
import type { useVacationsStore } from '../stores/vacations'
import { shrinkRows, type CascadeItem } from './cascade'

// Compacts the calendar after a removal so empty rows close up. The drag
// preview already shrinks (via previewItems) but those changes are scoped
// to the in-flight drag and never commit to the store. Direct deletes
// (delete ticket, delete vacation, remove placement) bypass the drag
// pipeline entirely, so we have to run shrinkRows + commit manually here.
//
// Run this immediately after any delete that could leave a hole in the
// row layout.
export function compactCalendarLayout(
  ticketsStore: ReturnType<typeof useTicketsStore>,
  vacationsStore: ReturnType<typeof useVacationsStore>,
): void {
  const items: CascadeItem[] = []
  for (const p of ticketsStore.placements) {
    items.push({
      key: `ticket:${p.ticketId}`,
      startDate: p.startDate,
      endDate: p.endDate,
      row: p.row,
    })
  }
  for (const v of vacationsStore.entries) {
    if (v.startDate === null || v.endDate === null) continue
    items.push({
      key: `vacation:${v.id}`,
      startDate: v.startDate,
      endDate: v.endDate,
      row: v.row,
    })
  }

  const shrunk = shrinkRows(items)

  // Write back only the items whose row changed — moveTicket / placeVacation
  // both trigger reactivity, so skipping no-ops keeps the change set small.
  for (const item of shrunk) {
    if (item.key.startsWith('ticket:')) {
      const id = Number(item.key.slice('ticket:'.length))
      const existing = ticketsStore.placements.find((p) => p.ticketId === id)
      if (existing && existing.row !== item.row) {
        ticketsStore.moveTicket(id, item.startDate, item.endDate, item.row)
      }
    } else if (item.key.startsWith('vacation:')) {
      const id = Number(item.key.slice('vacation:'.length))
      const existing = vacationsStore.entries.find((e) => e.id === id)
      if (existing && existing.row !== item.row) {
        vacationsStore.placeVacation(id, item.startDate, item.endDate, item.row)
      }
    }
  }
}
