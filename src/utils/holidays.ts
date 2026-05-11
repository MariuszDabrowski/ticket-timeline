import type { CalendarDate } from '../stores/tickets'

export interface Holiday {
  date: CalendarDate
  name: string
}

function easter(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function offset(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// n: 1=first, 2=second, -1=last; weekday: 0=Sun … 6=Sat
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month, 1)
    const diff = (weekday - first.getDay() + 7) % 7
    return new Date(year, month, 1 + diff + (n - 1) * 7)
  }
  const last = new Date(year, month + 1, 0)
  const diff = (last.getDay() - weekday + 7) % 7
  return new Date(year, month + 1, -diff)
}

function cal(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

function fixed(year: number, month: number, day: number): CalendarDate {
  return { year, month, day }
}

export function getCanadianHolidays(year: number): Holiday[] {
  const easterSunday = easter(year)

  // Victoria Day: Monday on or before May 24
  const may24 = new Date(year, 4, 24)
  const dow = may24.getDay()
  const victoriaDay = new Date(year, 4, 24 - (dow === 0 ? 6 : dow - 1))

  // Canada Day: Jul 1, observed Mon if Sun
  const canadaDay = new Date(year, 6, 1).getDay() === 0 ? new Date(year, 6, 2) : new Date(year, 6, 1)

  return [
    { date: fixed(year, 0, 1),                           name: "New Year's Day" },
    { date: cal(offset(easterSunday, -2)),                name: 'Good Friday' },
    { date: cal(victoriaDay),                             name: 'Victoria Day' },
    { date: cal(canadaDay),                               name: 'Canada Day' },
    { date: cal(nthWeekday(year, 8, 1, 1)),               name: 'Labour Day' },
    { date: fixed(year, 8, 30),                           name: 'Truth & Reconciliation Day' },
    { date: cal(nthWeekday(year, 9, 1, 2)),               name: 'Thanksgiving' },
    { date: fixed(year, 10, 11),                          name: 'Remembrance Day' },
    { date: fixed(year, 11, 25),                          name: 'Christmas Day' },
    { date: fixed(year, 11, 26),                          name: 'Boxing Day' },
  ]
}

export function getAmericanHolidays(year: number): Holiday[] {
  // Independence Day: Jul 4, observed Fri if Sat, Mon if Sun
  const jul4dow = new Date(year, 6, 4).getDay()
  const independenceDay =
    jul4dow === 6 ? new Date(year, 6, 3) :
    jul4dow === 0 ? new Date(year, 6, 5) :
    new Date(year, 6, 4)

  // Juneteenth: Jun 19, same observed rule
  const jun19dow = new Date(year, 5, 19).getDay()
  const juneteenth =
    jun19dow === 6 ? new Date(year, 5, 18) :
    jun19dow === 0 ? new Date(year, 5, 20) :
    new Date(year, 5, 19)

  return [
    { date: fixed(year, 0, 1),                            name: "New Year's Day" },
    { date: cal(nthWeekday(year, 0, 1, 3)),               name: 'MLK Day' },
    { date: cal(nthWeekday(year, 1, 1, 3)),               name: "Presidents' Day" },
    { date: cal(nthWeekday(year, 4, 1, -1)),              name: 'Memorial Day' },
    { date: cal(juneteenth),                              name: 'Juneteenth' },
    { date: cal(independenceDay),                         name: 'Independence Day' },
    { date: cal(nthWeekday(year, 8, 1, 1)),               name: 'Labor Day' },
    { date: cal(nthWeekday(year, 9, 1, 2)),               name: 'Columbus Day' },
    { date: fixed(year, 10, 11),                          name: 'Veterans Day' },
    { date: cal(nthWeekday(year, 10, 4, 4)),              name: 'Thanksgiving' },
    { date: fixed(year, 11, 25),                          name: 'Christmas Day' },
  ]
}
