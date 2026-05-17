import LZString from 'lz-string'
import type { ProjectData } from './projectStorage'
import type { CalendarDate } from '../stores/tickets'

// v4 — positional tuples + day-offset dates (days since EPOCH) + row index
// tickets:    [id, number, title, assignedTo, labelColor?]
// placements: [ticketId, startOffset, endOffset, row]
// vacations:  [personId, startOffset, endOffset, row]
// people:     [id, name, color]
interface SharePayloadV4 {
  v: 4
  name: string
  linkBase?: string
  tickets: Array<[number, string, string, number | null] | [number, string, string, number | null, string]>
  placements: Array<[number, number, number, number]>
  vacations: Array<[number, number, number, number]>
  people: Array<[number, string, string]>
  selectedMonths: number[]
}

// Day-offset epoch: 2020-01-01
const EPOCH = new Date(2020, 0, 1).getTime()

function dateToOffset(d: CalendarDate): number {
  return Math.round((new Date(d.year, d.month, d.day).getTime() - EPOCH) / 86_400_000)
}

function offsetToDate(n: number): CalendarDate {
  const date = new Date(EPOCH + n * 86_400_000)
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

function extractLinkBase(tickets: ProjectData['tickets']): string | undefined {
  const linked = tickets.filter((t) => t.link && t.number && t.link.endsWith(t.number))
  if (linked.length === 0 || linked.length !== tickets.filter((t) => t.link).length) return undefined
  const base = linked[0]!.link.slice(0, -linked[0]!.number.length)
  return linked.every((t) => t.link.slice(0, -t.number.length) === base) ? base : undefined
}

export function encodeShareLink(data: ProjectData): string {
  const linkBase = extractLinkBase(data.tickets)

  const payload: SharePayloadV4 = {
    v: 4,
    name: data.name,
    linkBase,
    tickets: data.tickets.map(({ id, number, title, assignedTo, labelColor }) =>
      labelColor !== undefined
        ? [id, number, title, assignedTo, labelColor]
        : [id, number, title, assignedTo]
    ),
    placements: data.placements.map((p) => [
      p.ticketId, dateToOffset(p.startDate), dateToOffset(p.endDate), p.row,
    ]),
    vacations: data.vacations
      .filter((v) => v.startDate !== null && v.endDate !== null)
      .map((v) => [v.personId, dateToOffset(v.startDate!), dateToOffset(v.endDate!), v.row]),
    people: data.people.map(({ id, name, color }) => [id, name, color]),
    selectedMonths: data.selectedMonths,
  }

  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodeShareLink(encoded: string): ProjectData | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const raw = JSON.parse(json) as SharePayloadV4

    if (raw.v !== 4) return null

    return {
      name: raw.name,
      tickets: raw.tickets.map((t) => ({
        id: t[0],
        number: t[1],
        title: t[2],
        assignedTo: t[3],
        link: raw.linkBase ? raw.linkBase + t[1] : '',
        ...(t[4] !== undefined && { isLabel: true, labelColor: t[4] }),
      })),
      placements: raw.placements.map((p) => ({
        ticketId: p[0],
        startDate: offsetToDate(p[1]),
        endDate: offsetToDate(p[2]),
        row: p[3],
      })),
      vacations: raw.vacations.map((v, i) => ({
        id: i,
        personId: v[0],
        startDate: offsetToDate(v[1]),
        endDate: offsetToDate(v[2]),
        row: v[3],
      })),
      people: raw.people.map((p) => ({ id: p[0], name: p[1], color: p[2] })),
      selectedMonths: raw.selectedMonths,
    }
  } catch {
    return null
  }
}

export function buildShareUrl(data: ProjectData): string {
  const compressed = encodeShareLink(data)
  return `${window.location.origin}${window.location.pathname}#share=${compressed}`
}

export const TITLE_TRUNCATE_LENGTH = 25
// Hash-fragment URLs never leave the browser (no server, no proxy, no log truncation),
// so the only ceiling is browser address-bar / clipboard handling. 8000 is comfortably
// within Chrome (~32k), Firefox (~64k), and Safari (~80k) limits.
const URL_LIMIT = 8000

export type ShareTier = 'full' | 'truncated' | 'stripped' | 'too-long'

export interface SmartShareResult {
  url: string | null
  tier: ShareTier
  urlLength: number
}

export function buildSmartShareUrl(data: ProjectData): SmartShareResult {
  const full = buildShareUrl(data)
  if (full.length <= URL_LIMIT) return { url: full, tier: 'full', urlLength: full.length }

  const truncatedData = { ...data, tickets: data.tickets.map((t) => ({ ...t, title: t.title.slice(0, TITLE_TRUNCATE_LENGTH) })) }
  const truncated = buildShareUrl(truncatedData)
  if (truncated.length <= URL_LIMIT) return { url: truncated, tier: 'truncated', urlLength: truncated.length }

  const strippedData = { ...data, tickets: data.tickets.map((t) => ({ ...t, title: '' })) }
  const stripped = buildShareUrl(strippedData)
  if (stripped.length <= URL_LIMIT) return { url: stripped, tier: 'stripped', urlLength: stripped.length }

  return { url: null, tier: 'too-long', urlLength: stripped.length }
}

