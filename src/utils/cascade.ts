import { compareCalendarDates } from '../stores/tickets'
import type { CalendarDate } from '../stores/tickets'

// A row-space occupant — anything with a date range and a row position. Used
// generically so cascade push can operate on tickets and vacations in the
// same row space (per the DRAG_DROP_SPEC: vacations live alongside tickets,
// no separate zone).
export interface CascadeItem {
  // Stable identity so the caller can match results back to source entities.
  // Use a string like 'ticket:42' or 'vacation:7' to disambiguate types.
  key: string
  startDate: CalendarDate
  endDate: CalendarDate
  row: number
}

function datesOverlap(a: CascadeItem, b: CascadeItem): boolean {
  return compareCalendarDates(a.startDate, b.endDate) <= 0 &&
         compareCalendarDates(a.endDate, b.startDate) >= 0
}

// Cascade-push collision resolution: place `target` at its (row, dates) and
// push any item it conflicts with down by one row. Repeat recursively for any
// further collisions until the layout settles.
//
// Always terminates: each pushed item moves to a higher row, and a row
// strictly greater than the current max row never conflicts with anything.
//
// `target` replaces any existing item with the same `key` (i.e. you're moving
// an existing item; pass its new desired position and the old one drops out).
export function cascadePush(items: CascadeItem[], target: CascadeItem): CascadeItem[] {
  const base = items.filter((i) => i.key !== target.key)

  function place(current: CascadeItem[], item: CascadeItem): CascadeItem[] {
    const conflicts = current.filter((c) => c.row === item.row && datesOverlap(c, item))
    let result = current.filter((c) => !conflicts.includes(c))
    for (const c of conflicts) {
      result = place(result, { ...c, row: c.row + 1 })
    }
    result.push(item)
    return result
  }

  return place(base, target)
}

// Compacts the layout by sliding each item down to the lowest row it can
// occupy without colliding. Lower-row items are tried first so they settle
// before higher ones get a chance.
//
// Each item's row is a single value shared across all weeks it spans, so a
// shift is only applied if it's collision-free globally (a multi-week pill
// can't drop into row N in one week if it would collide in another).
//
// This covers both vertical holes (an unused row index in a week) and
// horizontal gaps (an item sitting higher than necessary because the row
// below is only busy on days the item doesn't touch — e.g. after a resize
// contraction frees up space the cascade had previously pushed into).
//
// Terminates: each successful shift strictly decreases an item's row, so
// total row sum strictly decreases until no shift is safe.
export function shrinkRows(items: CascadeItem[]): CascadeItem[] {
  function hasCollision(list: CascadeItem[]): boolean {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i]!.row === list[j]!.row && datesOverlap(list[i]!, list[j]!)) return true
      }
    }
    return false
  }

  let current = items
  let changed = true
  while (changed) {
    changed = false
    const sorted = [...current].sort((a, b) => a.row - b.row)
    for (const item of sorted) {
      if (item.row === 0) continue
      const proposed = current.map((i) => (i === item ? { ...i, row: i.row - 1 } : i))
      if (!hasCollision(proposed)) {
        current = proposed
        changed = true
        break
      }
    }
  }
  return current
}
