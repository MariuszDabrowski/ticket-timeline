import type { CalendarDate } from '../stores/tickets'

function toDate(d: CalendarDate): Date {
  return new Date(d.year, d.month, d.day)
}

function fromDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

// Snap a weekend date to the nearest weekday. Weekday dates are returned unchanged.
export function snapToWeekday(date: CalendarDate, prefer: 'forward' | 'backward'): CalendarDate {
  const d = toDate(date)
  const dow = d.getDay()
  if (dow === 0) d.setDate(d.getDate() + (prefer === 'forward' ? 1 : -2))
  else if (dow === 6) d.setDate(d.getDate() + (prefer === 'forward' ? 2 : -1))
  return fromDate(d)
}

// Number of working-day steps from start to end (exclusive of start, inclusive of end).
export function workingDaysBetween(start: CalendarDate, end: CalendarDate): number {
  const d = toDate(start)
  const endD = toDate(end)
  let count = 0
  while (d < endD) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

// Add n working days to a date, skipping Saturdays and Sundays.
export function addWorkingDays(start: CalendarDate, n: number): CalendarDate {
  const d = toDate(start)
  let remaining = n
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) remaining--
  }
  return fromDate(d)
}
