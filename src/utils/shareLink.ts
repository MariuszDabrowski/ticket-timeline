import LZString from 'lz-string'
import type { ProjectData } from './projectStorage'
import type { CalendarDate } from '../stores/tickets'

// v1 (legacy) — long ticket field names, YYYYMMDD dates
interface SharePayloadV1 {
  v: 1
  name: string
  linkBase?: string
  tickets: Array<{
    id: number
    number: string
    title: string
    assignedTo: number | null
    isLabel?: boolean
    labelColor?: string
  }>
  placements: Array<{ t: number; s: number; e: number }>
  vacations: Array<{ p: number; s: number; e: number }>
  people: ProjectData['people']
  selectedMonths: number[]
}

// v2 — compact ticket field names, YYYYMMDD dates
interface SharePayloadV2 {
  v: 2
  name: string
  linkBase?: string
  tickets: Array<{ id: number; n: string; ti: string; a: number | null; lc?: string }>
  placements: Array<{ t: number; s: number; e: number }>
  vacations: Array<{ p: number; s: number; e: number }>
  people: ProjectData['people']
  selectedMonths: number[]
}

// v3 — positional tuples + day-offset dates (days since EPOCH)
// tickets:    [id, number, title, assignedTo, labelColor?]
// placements: [ticketId, startOffset, endOffset]
// vacations:  [personId, startOffset, endOffset]
// people:     [id, name, color]
interface SharePayloadV3 {
  v: 3
  name: string
  linkBase?: string
  tickets: Array<[number, string, string, number | null] | [number, string, string, number | null, string]>
  placements: Array<[number, number, number]>
  vacations: Array<[number, number, number]>
  people: Array<[number, string, string]>
  selectedMonths: number[]
}

type AnyPayload = SharePayloadV1 | SharePayloadV2 | SharePayloadV3

// Day-offset epoch: 2020-01-01
const EPOCH = new Date(2020, 0, 1).getTime()

function dateToOffset(d: CalendarDate): number {
  return Math.round((new Date(d.year, d.month, d.day).getTime() - EPOCH) / 86_400_000)
}

function offsetToDate(n: number): CalendarDate {
  const date = new Date(EPOCH + n * 86_400_000)
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

// v1/v2 legacy date helpers
function intToDate(n: number): CalendarDate {
  const day = n % 100
  const month = Math.floor(n / 100) % 100 - 1
  const year = Math.floor(n / 10000)
  return { year, month, day }
}

function extractLinkBase(tickets: ProjectData['tickets']): string | undefined {
  const linked = tickets.filter((t) => t.link && t.number && t.link.endsWith(t.number))
  if (linked.length === 0 || linked.length !== tickets.filter((t) => t.link).length) return undefined
  const base = linked[0]!.link.slice(0, -linked[0]!.number.length)
  return linked.every((t) => t.link.slice(0, -t.number.length) === base) ? base : undefined
}

export function encodeShareLink(data: ProjectData): string {
  const linkBase = extractLinkBase(data.tickets)

  const payload: SharePayloadV3 = {
    v: 3,
    name: data.name,
    linkBase,
    tickets: data.tickets.map(({ id, number, title, assignedTo, labelColor }) =>
      labelColor !== undefined
        ? [id, number, title, assignedTo, labelColor]
        : [id, number, title, assignedTo]
    ),
    placements: data.placements.map((p) => [
      p.ticketId, dateToOffset(p.startDate), dateToOffset(p.endDate),
    ]),
    vacations: data.vacations.map((v) => [
      v.personId, dateToOffset(v.startDate), dateToOffset(v.endDate),
    ]),
    people: data.people.map(({ id, name, color }) => [id, name, color]),
    selectedMonths: data.selectedMonths,
  }

  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodeShareLink(encoded: string): ProjectData | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const raw = JSON.parse(json) as AnyPayload

    if (raw.v === 3) {
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
        })),
        vacations: raw.vacations.map((v) => ({
          personId: v[0],
          startDate: offsetToDate(v[1]),
          endDate: offsetToDate(v[2]),
        })),
        people: raw.people.map((p) => ({ id: p[0], name: p[1], color: p[2] })),
        selectedMonths: raw.selectedMonths,
      }
    }

    if (raw.v === 2) {
      return {
        name: raw.name,
        tickets: raw.tickets.map((t) => ({
          id: t.id,
          number: t.n,
          title: t.ti,
          assignedTo: t.a,
          link: raw.linkBase ? raw.linkBase + t.n : '',
          ...(t.lc !== undefined && { isLabel: true, labelColor: t.lc }),
        })),
        placements: raw.placements.map((p) => ({
          ticketId: p.t,
          startDate: intToDate(p.s),
          endDate: intToDate(p.e),
        })),
        vacations: raw.vacations.map((v) => ({
          personId: v.p,
          startDate: intToDate(v.s),
          endDate: intToDate(v.e),
        })),
        people: raw.people,
        selectedMonths: raw.selectedMonths,
      }
    }

    if (raw.v === 1) {
      return {
        name: raw.name,
        tickets: raw.tickets.map((t) => ({
          ...t,
          link: raw.linkBase ? raw.linkBase + t.number : '',
        })),
        placements: raw.placements.map((p) => ({
          ticketId: p.t,
          startDate: intToDate(p.s),
          endDate: intToDate(p.e),
        })),
        vacations: raw.vacations.map((v) => ({
          personId: v.p,
          startDate: intToDate(v.s),
          endDate: intToDate(v.e),
        })),
        people: raw.people,
        selectedMonths: raw.selectedMonths,
      }
    }

    return null
  } catch {
    return null
  }
}

export function buildShareUrl(data: ProjectData): string {
  const compressed = encodeShareLink(data)
  return `${window.location.origin}${window.location.pathname}#share=${compressed}`
}

export const TITLE_TRUNCATE_LENGTH = 25
const URL_LIMIT = 2000

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

export interface ShareFieldStat {
  field: string
  count: number | null
  rawChars: number
  avgChars: number | null
  pct: number
  detail: { label: string; chars: number }[]
}

export function analyzeSharePayload(data: ProjectData): ShareFieldStat[] {
  const linkBase = extractLinkBase(data.tickets)

  const compactTickets = data.tickets.map(({ id, number, title, assignedTo, labelColor }) =>
    labelColor !== undefined
      ? [id, number, title, assignedTo, labelColor]
      : [id, number, title, assignedTo]
  ) as unknown[][]

  const compactPlacements = data.placements.map((p) => [
    p.ticketId, dateToOffset(p.startDate), dateToOffset(p.endDate),
  ]) as unknown[][]

  const compactVacations = data.vacations.map((v) => [
    v.personId, dateToOffset(v.startDate), dateToOffset(v.endDate),
  ]) as unknown[][]

  const compactPeople = data.people.map(({ id, name, color }) => [id, name, color]) as unknown[][]

  function avgTupleSizes(items: unknown[][], labels: string[]): { label: string; chars: number }[] {
    if (items.length === 0) return []
    const totals: number[] = new Array(labels.length).fill(0)
    const counts: number[] = new Array(labels.length).fill(0)
    for (const item of items) {
      for (let i = 0; i < item.length; i++) {
        totals[i] = (totals[i] ?? 0) + JSON.stringify(item[i]).length + 1
        counts[i]!++
      }
    }
    return labels
      .map((label, i) => ({ label, chars: counts[i]! > 0 ? Math.round(totals[i]! / counts[i]!) : 0 }))
      .filter((x) => x.chars > 0)
      .sort((a, b) => b.chars - a.chars)
  }

  const sections: {
    field: string
    value: unknown
    tuples?: unknown[][]
    tupleLabels?: string[]
  }[] = [
    { field: 'tickets', value: compactTickets, tuples: compactTickets, tupleLabels: ['id', 'n', 'ti', 'a', 'lc'] },
    { field: 'placements', value: compactPlacements, tuples: compactPlacements, tupleLabels: ['t', 's', 'e'] },
    { field: 'vacations', value: compactVacations, tuples: compactVacations, tupleLabels: ['p', 's', 'e'] },
    { field: 'people', value: compactPeople, tuples: compactPeople, tupleLabels: ['id', 'name', 'color'] },
    { field: 'linkBase', value: linkBase ?? '' },
    { field: 'selectedMonths', value: data.selectedMonths },
  ]

  const sized = sections.map((s) => ({
    field: s.field,
    rawChars: JSON.stringify(s.value).length,
    count: Array.isArray(s.value) ? (s.value as unknown[]).length : null,
    detail: s.tuples && s.tupleLabels ? avgTupleSizes(s.tuples, s.tupleLabels) : [],
  }))

  const total = sized.reduce((sum, s) => sum + s.rawChars, 0)

  return sized.map((s) => ({
    ...s,
    avgChars: s.count ? Math.round(s.rawChars / s.count) : null,
    pct: Math.round((s.rawChars / total) * 100),
  }))
}
