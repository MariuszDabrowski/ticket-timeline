import type { Person } from '../stores/people'

// Default pill color when there's no assignee / no person lookup. Used by
// the sidebar's unassigned-ticket placeholder and as the fallback for
// orphaned assignedTo refs (person was deleted but their id is still on a
// ticket). The two callers historically used slightly different greys —
// standardize on this one so the visual stays consistent.
const DEFAULT_COLOR = '#555'

export function colorForPerson(personId: number | null, people: Person[]): string {
  if (personId === null) return DEFAULT_COLOR
  return people.find((p) => p.id === personId)?.color ?? DEFAULT_COLOR
}

// Color used to render a ticket pill. Labels carry their own labelColor; real
// tickets inherit from their assignee.
export function colorForTicket(
  ticket: { assignedTo: number | null; isLabel?: boolean; labelColor?: string },
  people: Person[],
): string {
  if (ticket.isLabel) return ticket.labelColor ?? '#607d8b'
  return colorForPerson(ticket.assignedTo, people)
}

// Matches the visual treatment of single-segment calendar pills: full color
// on the left, 40% darker on the right, both at 0.75 alpha. Used in the
// sidebar list and the styleguide.
export function pillGradient(hex: string): string {
  let h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3) h = h[0]! + h[0] + h[1]! + h[1] + h[2]! + h[2]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const left = `rgba(${r}, ${g}, ${b}, 0.75)`
  const right = `rgba(${Math.round(r * 0.6)}, ${Math.round(g * 0.6)}, ${Math.round(b * 0.6)}, 0.75)`
  return `linear-gradient(to right, ${left}, ${right})`
}
