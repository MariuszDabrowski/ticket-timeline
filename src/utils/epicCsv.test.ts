import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { importEpicCSV } from './epicCsv'
import { usePeopleStore } from '../stores/people'
import { useTicketsStore } from '../stores/tickets'

beforeEach(() => {
  setActivePinia(createPinia())
})

const HEADER = 'id,name,owners,started_at,is_archived'

describe('importEpicCSV', () => {
  it('imports tickets with title and number from id+name columns', () => {
    const csv = `${HEADER}\n100,Build login,alice@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(tickets.tickets).toHaveLength(1)
    expect(tickets.tickets[0]!.number).toBe('100')
    expect(tickets.tickets[0]!.title).toBe('Build login')
  })

  it('creates a person from owner email and assigns the ticket to them', () => {
    const csv = `${HEADER}\n100,Build login,alice.smith@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(people.people).toHaveLength(1)
    expect(people.people[0]!.name).toBe('Alice Smith')
    expect(tickets.tickets[0]!.assignedTo).toBe(people.people[0]!.id)
  })

  it('reuses existing people matched by name (case-insensitive)', () => {
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    const existingId = people.addPerson('Alice Smith')

    const csv = `${HEADER}\n100,T1,alice.smith@example.com,,false`
    importEpicCSV(csv, people, tickets)

    expect(people.people).toHaveLength(1)
    expect(tickets.tickets[0]!.assignedTo).toBe(existingId)
  })

  // Regression: importing HiBob vacations first ("Mariusz Dabrowski") then
  // importing a CSV (email "mariusz@...") used to create a duplicate "Mariusz".
  // The fuzzy match now collapses them onto the existing person.
  it('fuzzy-matches CSV name as a substring of an existing full name', () => {
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    const existingId = people.addPerson('Mariusz Dabrowski')

    // email's local part becomes just "Mariusz" — substring of "Mariusz Dabrowski"
    const csv = `${HEADER}\n100,T1,mariusz@example.com,,false`
    importEpicCSV(csv, people, tickets)

    expect(people.people).toHaveLength(1)
    expect(tickets.tickets[0]!.assignedTo).toBe(existingId)
  })

  it('fuzzy-matches existing first-name when CSV provides full name', () => {
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    const existingId = people.addPerson('Mariusz')

    // CSV email yields "Mariusz Dabrowski" — should collapse onto existing "Mariusz"
    const csv = `${HEADER}\n100,T1,mariusz.dabrowski@example.com,,false`
    importEpicCSV(csv, people, tickets)

    expect(people.people).toHaveLength(1)
    expect(tickets.tickets[0]!.assignedTo).toBe(existingId)
  })

  it('creates separate people when names share no substring', () => {
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    people.addPerson('Alice Smith')

    const csv = `${HEADER}\n100,T1,bob.jones@example.com,,false`
    importEpicCSV(csv, people, tickets)

    expect(people.people).toHaveLength(2)
    expect(people.people.map((p) => p.name).sort()).toEqual(['Alice Smith', 'Bob Jones'])
  })

  it('filters out emails containing "+" (team aliases)', () => {
    const csv = `${HEADER}\n100,T1,team+alpha@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(people.people).toHaveLength(0)
    expect(tickets.tickets[0]!.assignedTo).toBeNull()
  })

  it('skips archived rows', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,,true\n101,T2,alice@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(tickets.tickets).toHaveLength(1)
    expect(tickets.tickets[0]!.number).toBe('101')
  })

  it('places tickets that have a started_at date', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,2026/05/14,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(tickets.placements).toHaveLength(1)
    expect(tickets.placements[0]!.startDate).toEqual({ year: 2026, month: 4, day: 14 })
  })

  it('leaves tickets unplaced when started_at is empty', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(tickets.placements).toHaveLength(0)
  })

  it('handles quoted fields containing commas', () => {
    const csv = `${HEADER}\n100,"Title, with comma",alice@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(tickets.tickets[0]!.title).toBe('Title, with comma')
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const csv = `${HEADER}\n100,"He said ""hi""",alice@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    expect(tickets.tickets[0]!.title).toBe('He said "hi"')
  })

  it('builds Shortcut links when workspaceSlug is provided', () => {
    const csv = `${HEADER}\n100,T1,alice@example.com,,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets, 'my-workspace')

    expect(tickets.tickets[0]!.link).toBe('https://app.shortcut.com/my-workspace/story/100')
  })

  it('returns silently for empty input', () => {
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV('', people, tickets)
    expect(tickets.tickets).toHaveLength(0)
  })

  it('returns silently when required columns are missing', () => {
    const csv = 'foo,bar\nbaz,qux'
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)
    expect(tickets.tickets).toHaveLength(0)
  })

  it('assigns to first non-team email when multiple owners listed', () => {
    const csv = `${HEADER}\n100,T1,"team+x@example.com,alice@example.com,bob@example.com",,false`
    const people = usePeopleStore()
    const tickets = useTicketsStore()
    importEpicCSV(csv, people, tickets)

    const alice = people.people.find((p) => p.name === 'Alice')!
    expect(tickets.tickets[0]!.assignedTo).toBe(alice.id)
  })
})
