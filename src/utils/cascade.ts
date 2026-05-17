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

// Maintains the no-holes invariant after a removal or move-out:
// For each week (passed in as an array of CalendarDates), find any empty row
// between occupied rows in that week and shift everything above it down by 1.
//
// Shifts apply globally to a placement (a multi-week pill is one stored row,
// shifting it changes its row in every week it touches). So a candidate shift
// is only applied if it doesn't create collisions elsewhere — if shifting
// would collide, the gap stays.
//
// Repeats until no safe shift is available, so multiple gaps close in one call.
export function shrinkRows(items: CascadeItem[], weeks: CalendarDate[][]): CascadeItem[] {
  function touchesWeek(item: CascadeItem, weekDays: CalendarDate[]): boolean {
    return weekDays.some(
      (d) =>
        compareCalendarDates(item.startDate, d) <= 0 &&
        compareCalendarDates(item.endDate, d) >= 0,
    )
  }

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
    for (const weekDays of weeks) {
      const occupiedRows = new Set<number>()
      for (const item of current) {
        if (touchesWeek(item, weekDays)) occupiedRows.add(item.row)
      }
      const sorted = [...occupiedRows].sort((a, b) => a - b)

      // Two kinds of gap to close: (1) the lowest row > 0 (everything can slide
      // down by 1) and (2) any gap between two occupied rows in this week.
      const gapTargets: number[] = []
      if (sorted.length > 0 && sorted[0]! > 0) gapTargets.push(sorted[0]! - 1)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1]! - sorted[i]! > 1) gapTargets.push(sorted[i + 1]! - 1)
      }

      for (const gap of gapTargets) {
        const proposed = current.map((item) =>
          touchesWeek(item, weekDays) && item.row > gap ? { ...item, row: item.row - 1 } : item,
        )
        if (!hasCollision(proposed)) {
          current = proposed
          changed = true
          break // restart the outer loop so the new sorted-rows for this week is re-evaluated
        }
      }
      if (changed) break
    }
  }
  return current
}
