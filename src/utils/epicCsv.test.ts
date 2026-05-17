import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { parseEpicCSV } from './epicCsv'
import { useTicketsStore } from '../stores/tickets'
import { useVacationsStore } from '../stores/vacations'

beforeEach(() => {
  setActivePinia(createPinia())
})

const HEADER = 'id,name,owners,started_at,is_archived'

// Two-phase API: parseEpicCSV extracts the list of incoming people (the caller
// resolves them via classifyIncoming + PeopleConfirmModal); apply() then
// places tickets given the resolved email→personId map.

describe('parseEpicCSV: incoming people extraction', () => {
  it('returns null for empty input', () => {
    expect(parseEpicCSV('', useTicketsStore(), useVacationsStore())).toBeNull()
  })

  it('returns null when required columns are missing', () => {
    expect(parseEpicCSV('foo,bar\nbaz,qux', useTicketsStore(), useVacationsStore())).toBeNull()
  })

  it('emits a single IncomingPerson per unique email', () => {
    const csv = `${HEADER}\n100,T1,alice.smith@example.com,,false\n101,T2,alice.smith@example.com,,false`
    const parsed = parseEpicCSV(csv, useTicketsStore(), useVacationsStore())
    expect(parsed!.incomingPeople).toHaveLength(1)
    expect(parsed!.incomingPeople[0]).toEqual({ name: 'Alice Smith', email: 'alice.smith@example.com' })
  })

  it('skips team-alias emails (containing "+")', () => {
    const csv = `${HEADER}\n100,T1,team+alpha@example.com,,false`
    const parsed = parseEpicCSV(csv, useTicketsStore(), useVacationsStore())
    expect(parsed!.incomingPeople).toHaveLength(0)
  })

  it('extracts multiple owners listed in one cell', () => {
    const csv = `${HEADER}\n100,T1,"alice@example.com,bob@example.com",,false`
    const parsed = parseEpicCSV(csv, useTicketsStore(), useVacationsStore())
    expect(parsed!.incomingPeople.map((p) => p.email).sort()).toEqual([
      'alice@example.com', 'bob@example.com',
    ])
  })

  it('skips archived rows when collecting people', () => {
    const csv = `${HEADER}\n100,T1,archived@example.com,,true\n101,T2,active@example.com,,false`
    const parsed = parseEpicCSV(csv, useTicketsStore(), useVacationsStore())
    expect(parsed!.incomingPeople.map((p) => p.email)).toEqual(['active@example.com'])
  })
})

describe('parseEpicCSV.apply: ticket placement', () => {
  it('creates tickets with title + number from id+name columns', () => {
    const csv = `${HEADER}\n100,Build login,alice@example.com,,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map([['alice@example.com', 99]]))
    expect(tickets.tickets).toHaveLength(1)
    expect(tickets.tickets[0]!.number).toBe('100')
    expect(tickets.tickets[0]!.title).toBe('Build login')
    expect(tickets.tickets[0]!.assignedTo).toBe(99)
  })

  it('assigns ticket to first non-team email when multiple owners listed', () => {
    const csv = `${HEADER}\n100,T1,"team+x@example.com,alice@example.com,bob@example.com",,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map([['alice@example.com', 1], ['bob@example.com', 2]]))
    expect(tickets.tickets[0]!.assignedTo).toBe(1)
  })

  it('leaves assignedTo null when the email is not in the map', () => {
    const csv = `${HEADER}\n100,T1,unknown@example.com,,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map())
    expect(tickets.tickets[0]!.assignedTo).toBeNull()
  })

  it('skips archived rows', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,,true\n101,T2,alice@example.com,,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map([['alice@example.com', 1]]))
    expect(tickets.tickets).toHaveLength(1)
    expect(tickets.tickets[0]!.number).toBe('101')
  })

  it('places tickets that have a started_at date', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,2026/05/14,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map([['alice@example.com', 1]]))
    expect(tickets.placements).toHaveLength(1)
    expect(tickets.placements[0]!.startDate).toEqual({ year: 2026, month: 4, day: 14 })
  })

  it('leaves tickets unplaced when started_at is empty', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map([['alice@example.com', 1]]))
    expect(tickets.placements).toHaveLength(0)
  })

  it('handles quoted fields containing commas', () => {
    const csv = `${HEADER}\n100,"Title, with comma",alice@example.com,,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map([['alice@example.com', 1]]))
    expect(tickets.tickets[0]!.title).toBe('Title, with comma')
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const csv = `${HEADER}\n100,"He said ""hi""",alice@example.com,,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore())!
    parsed.apply(new Map([['alice@example.com', 1]]))
    expect(tickets.tickets[0]!.title).toBe('He said "hi"')
  })

  it('builds Shortcut links when workspaceSlug is provided', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,,false`
    const tickets = useTicketsStore()
    const parsed = parseEpicCSV(csv, tickets, useVacationsStore(), 'my-workspace')!
    parsed.apply(new Map([['alice@example.com', 1]]))
    expect(tickets.tickets[0]!.link).toBe('https://app.shortcut.com/my-workspace/story/100')
  })
})
