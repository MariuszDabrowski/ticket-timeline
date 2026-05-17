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

// Add n calendar days (no weekend skipping). Negative values walk backward.
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = toDate(date)
  d.setDate(d.getDate() + days)
  return fromDate(d)
}

// Number of calendar days between start and end (inclusive of both endpoints
// when same day → 0). Mirrors what MonthCalendar uses for pill drag span.
export function spanInDays(start: CalendarDate, end: CalendarDate): number {
  return Math.round(
    (toDate(end).getTime() - toDate(start).getTime()) / 86_400_000,
  )
}

// Short calendar-date formatter: "Jan 5", "Dec 31". Used in tooltips.
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function fmtShortDate(d: CalendarDate): string {
  return `${MONTH_SHORT[d.month]} ${d.day}`
}

// "Jan 5, 2026, 2:30 PM" — used for save/load timestamps. Locale-aware.
export function fmtTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Count weekdays in [start, end] (inclusive on both ends). When isOnVacation
// is provided, days the person is on vacation don't count — used by the
// ticket tooltip's "duration" to subtract out vacation days.
export function workingDayCount(
  start: CalendarDate,
  end: CalendarDate,
  isOnVacation?: (date: CalendarDate) => boolean,
): number {
  let count = 0
  const d = toDate(start)
  const endD = toDate(end)
  while (d <= endD) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      if (isOnVacation) {
        const cd: CalendarDate = { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
        if (!isOnVacation(cd)) count++
      } else {
        count++
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return count
}
