import LZString from 'lz-string'
import type { ProjectData } from './projectStorage'
import type { CalendarDate } from '../stores/tickets'

// Compact share payload — independent of ProjectData so it can evolve separately
interface SharePayload {
  v: 1
  name: string
  linkBase?: string  // common URL prefix for all ticket links
  tickets: Array<{
    id: number
    number: string
    title: string
    assignedTo: number | null
    isLabel?: boolean
    labelColor?: string
    // link omitted — reconstructed as linkBase + number
  }>
  // dates stored as YYYYMMDD integers instead of {year,month,day} objects
  placements: Array<{ t: number; s: number; e: number }>
  vacations: Array<{ p: number; s: number; e: number }>
  people: ProjectData['people']
  selectedMonths: number[]
}

function dateToInt(d: CalendarDate): number {
  return d.year * 10000 + (d.month + 1) * 100 + d.day
}

function intToDate(n: number): CalendarDate {
  const day = n % 100
  const month = Math.floor(n / 100) % 100 - 1
  const year = Math.floor(n / 10000)
  return { year, month, day }
}

function extractLinkBase(
  tickets: ProjectData['tickets'],
): string | undefined {
  const linked = tickets.filter((t) => t.link && t.number && t.link.endsWith(t.number))
  if (linked.length === 0 || linked.length !== tickets.filter((t) => t.link).length) return undefined
  const base = linked[0]!.link.slice(0, -linked[0]!.number.length)
  return linked.every((t) => t.link.slice(0, -t.number.length) === base) ? base : undefined
}

export function encodeShareLink(data: ProjectData): string {
  const linkBase = extractLinkBase(data.tickets)

  const payload: SharePayload = {
    v: 1,
    name: data.name,
    linkBase,
    tickets: data.tickets.map(({ id, number, title, assignedTo, isLabel, labelColor }) => ({
      id, number, title, assignedTo,
      ...(isLabel !== undefined && { isLabel }),
      ...(labelColor !== undefined && { labelColor }),
    })),
    placements: data.placements.map((p) => ({
      t: p.ticketId,
      s: dateToInt(p.startDate),
      e: dateToInt(p.endDate),
    })),
    vacations: data.vacations.map((v) => ({
      p: v.personId,
      s: dateToInt(v.startDate),
      e: dateToInt(v.endDate),
    })),
    people: data.people,
    selectedMonths: data.selectedMonths,
  }

  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodeShareLink(encoded: string): ProjectData | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const payload = JSON.parse(json) as SharePayload
    if (payload.v !== 1) return null

    return {
      name: payload.name,
      tickets: payload.tickets.map((t) => ({
        ...t,
        link: payload.linkBase ? payload.linkBase + t.number : '',
      })),
      placements: payload.placements.map((p) => ({
        ticketId: p.t,
        startDate: intToDate(p.s),
        endDate: intToDate(p.e),
      })),
      vacations: payload.vacations.map((v) => ({
        personId: v.p,
        startDate: intToDate(v.s),
        endDate: intToDate(v.e),
      })),
      people: payload.people,
      selectedMonths: payload.selectedMonths,
    }
  } catch {
    return null
  }
}

export function buildShareUrl(data: ProjectData): string {
  const compressed = encodeShareLink(data)
  return `${window.location.origin}${window.location.pathname}#share=${compressed}`
}
