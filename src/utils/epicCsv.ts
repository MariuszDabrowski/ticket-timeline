import type { useTicketsStore } from '../stores/tickets'
import type { useVacationsStore } from '../stores/vacations'
import { findFirstFreeRow, combineRowOccupants } from '../stores/tickets'
import type { IncomingPerson } from './peopleMatch'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\r') {
        // skip, \n will handle the break
      } else if (ch === '\n') {
        row.push(field)
        rows.push(row)
        field = ''
        row = []
      } else {
        field += ch
      }
    }
  }

  if (row.length > 0 || field) {
    row.push(field)
    if (row.some((f) => f !== '')) rows.push(row)
  }

  return rows
}

function parseDate(str: string): { year: number; month: number; day: number } | null {
  const match = str.match(/^(\d{4})\/(\d{2})\/(\d{2})/)
  if (!match) return null
  return { year: +match[1]!, month: +match[2]! - 1, day: +match[3]! }
}

function isPersonEmail(email: string): boolean {
  const local = email.split('@')[0] ?? ''
  return !local.includes('+')
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

// Two-phase import (per PEOPLE_MATCH_SPEC):
//   1. parseEpicCSV extracts the unique incoming people from the file. The
//      caller classifies them against the existing roster and, if needed,
//      surfaces PeopleConfirmModal.
//   2. The returned `apply` closure places tickets once the caller has built
//      an emailToPersonId map (from auto-merges + user confirmations).
export interface EpicCsvImport {
  incomingPeople: IncomingPerson[]
  apply(emailToPersonId: Map<string, number>): void
}

export function parseEpicCSV(
  text: string,
  ticketsStore: ReturnType<typeof useTicketsStore>,
  vacationsStore: ReturnType<typeof useVacationsStore>,
  workspaceSlug = '',
): EpicCsvImport | null {
  const rows = parseCSV(text)
  if (rows.length < 2) return null

  const header = rows[0]!
  const idIdx = header.indexOf('id')
  const nameIdx = header.indexOf('name')
  const ownersIdx = header.indexOf('owners')
  const startedAtIdx = header.indexOf('started_at')
  const archivedIdx = header.indexOf('is_archived')
  if (idIdx === -1 || nameIdx === -1 || ownersIdx === -1) return null

  // Collect unique person-emails (excludes team aliases via isPersonEmail).
  // Order is by first appearance for stable UI.
  const seen = new Set<string>()
  const incomingPeople: IncomingPerson[] = []
  for (const row of rows.slice(1)) {
    if (archivedIdx !== -1 && row[archivedIdx]?.trim().toLowerCase() === 'true') continue
    const ownersRaw = row[ownersIdx] ?? ''
    const emails = ownersRaw.split(/[,;]/).map((e) => e.trim()).filter(Boolean).filter(isPersonEmail)
    for (const email of emails) {
      const key = email.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      incomingPeople.push({ name: nameFromEmail(email), email })
    }
  }

  function apply(emailToPersonId: Map<string, number>) {
    for (const row of rows.slice(1)) {
      if (archivedIdx !== -1 && row[archivedIdx]?.trim().toLowerCase() === 'true') continue
      const number = row[idIdx]?.trim()
      const title = row[nameIdx]?.trim()
      if (!number || !title) continue

      const firstEmail = (row[ownersIdx] ?? '').split(/[,;]/).map((e) => e.trim()).find(isPersonEmail) ?? ''
      const assignedTo = firstEmail ? (emailToPersonId.get(firstEmail.toLowerCase()) ?? null) : null

      const ticketId = ticketsStore.addTicket({
        number,
        title,
        assignedTo,
        link: workspaceSlug
          ? `https://app.shortcut.com/${workspaceSlug}/story/${number}`
          : '',
      })

      // Place by started_at (not completed_at) on purpose: tickets often sit in
      // rollout for 10+ days after being finished, so completed_at would make
      // past work look like it took way longer than it actually did.
      const startedDate = startedAtIdx !== -1 ? parseDate(row[startedAtIdx] ?? '') : null
      if (startedDate) {
        const placementRow = findFirstFreeRow(
          combineRowOccupants(ticketsStore.placements, vacationsStore.entries),
          startedDate,
          startedDate,
        )
        ticketsStore.placeTicket(ticketId, startedDate, placementRow)
      }
    }
  }

  return { incomingPeople, apply }
}
