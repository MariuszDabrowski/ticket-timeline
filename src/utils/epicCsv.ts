import type { usePeopleStore } from '../stores/people'
import type { useTicketsStore } from '../stores/tickets'
import { compareCalendarDates } from '../stores/tickets'

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

export function importEpicCSV(
  text: string,
  peopleStore: ReturnType<typeof usePeopleStore>,
  ticketsStore: ReturnType<typeof useTicketsStore>,
  workspaceSlug = '',
) {
  const rows = parseCSV(text)
  if (rows.length < 2) return

  const header = rows[0]!
  const idIdx = header.indexOf('id')
  const nameIdx = header.indexOf('name')
  const ownersIdx = header.indexOf('owners')
  const startedAtIdx = header.indexOf('started_at')
  const completedAtIdx = header.indexOf('completed_at')
  const stateIdx = header.indexOf('state')
  if (idIdx === -1 || nameIdx === -1 || ownersIdx === -1) return

  // Map email → person ID, reusing existing people matched by name
  const emailToPersonId = new Map<string, number>()

  for (const row of rows.slice(1)) {
    const ownersRaw = row[ownersIdx] ?? ''
    const emails = ownersRaw.split(/[,;]/).map((e) => e.trim()).filter(Boolean).filter(isPersonEmail)

    for (const email of emails) {
      if (emailToPersonId.has(email)) continue
      const name = nameFromEmail(email)
      const existing = peopleStore.people.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      )
      if (existing) {
        emailToPersonId.set(email, existing.id)
      } else {
        emailToPersonId.set(email, peopleStore.addPerson(name))
      }
    }
  }

  for (const row of rows.slice(1)) {
    const number = row[idIdx]?.trim()
    const title = row[nameIdx]?.trim()
    if (!number || !title) continue

    const firstEmail = (row[ownersIdx] ?? '').split(/[,;]/).map((e) => e.trim()).find(isPersonEmail) ?? ''
    const assignedTo = firstEmail ? (emailToPersonId.get(firstEmail) ?? null) : null
    const state = stateIdx !== -1 ? (row[stateIdx]?.trim() || undefined) : undefined

    const ticketId = ticketsStore.addTicket({
      number,
      title,
      assignedTo,
      link: workspaceSlug
        ? `https://app.shortcut.com/${workspaceSlug}/story/${number}`
        : '',
      state,
    })

    const startedDate = startedAtIdx !== -1 ? parseDate(row[startedAtIdx] ?? '') : null
    const completedDate = completedAtIdx !== -1 ? parseDate(row[completedAtIdx] ?? '') : null
    if (startedDate) {
      ticketsStore.placeTicket(ticketId, startedDate)
      if (completedDate && compareCalendarDates(startedDate, completedDate) <= 0) {
        ticketsStore.moveTicket(ticketId, startedDate, completedDate)
      }
    }
  }
}
