import type { CalendarDate } from '../stores/tickets'

export interface ICSVacationEvent {
  personName: string
  startDate: CalendarDate
  endDate: CalendarDate
}

function parseICSDate(raw: string): CalendarDate | null {
  const m = raw.match(/(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) }
}

function subtractOneDay(date: CalendarDate): CalendarDate {
  const d = new Date(date.year, date.month, date.day - 1)
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

export function parseICS(content: string): ICSVacationEvent[] {
  const events: ICSVacationEvent[] = []
  const blocks = content.split('BEGIN:VEVENT')
  for (const block of blocks.slice(1)) {
    const summary = block.match(/SUMMARY:([^\r\n]+)/)?.[1]?.trim() ?? ''
    if (!summary.includes('Out of Office')) continue

    const personName = summary.split(' - Out of Office')[0]!.trim()
    if (!personName) continue

    const dtstart = block.match(/DTSTART(?:[^:]*):([^\r\n]+)/)?.[1]?.trim() ?? ''
    const dtend = block.match(/DTEND(?:[^:]*):([^\r\n]+)/)?.[1]?.trim() ?? ''

    const startDate = parseICSDate(dtstart)
    const rawEnd = parseICSDate(dtend)
    if (!startDate || !rawEnd) continue

    // ICS DTEND is exclusive for all-day events
    const endDate = subtractOneDay(rawEnd)

    events.push({ personName, startDate, endDate })
  }
  return events
}

export interface ICSPersonGroup {
  personName: string
  events: ICSVacationEvent[]
}

export function groupByPerson(events: ICSVacationEvent[]): ICSPersonGroup[] {
  const map = new Map<string, ICSVacationEvent[]>()
  for (const ev of events) {
    const existing = map.get(ev.personName)
    if (existing) existing.push(ev)
    else map.set(ev.personName, [ev])
  }
  return Array.from(map.entries()).map(([personName, evs]) => ({ personName, events: evs }))
}
