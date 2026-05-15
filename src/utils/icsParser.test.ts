import { describe, it, expect } from 'vitest'
import { parseICS, groupByPerson } from './icsParser'

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Alice - Out of Office
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260606
END:VEVENT
BEGIN:VEVENT
SUMMARY:Bob - Out of Office
DTSTART;VALUE=DATE:20260615
DTEND;VALUE=DATE:20260616
END:VEVENT
BEGIN:VEVENT
SUMMARY:Team standup
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260602
END:VEVENT
END:VCALENDAR`

describe('parseICS', () => {
  it('extracts only Out of Office events', () => {
    const events = parseICS(SAMPLE_ICS)
    expect(events).toHaveLength(2)
    expect(events.map((e) => e.personName)).toEqual(['Alice', 'Bob'])
  })

  it('makes DTEND inclusive by subtracting one day', () => {
    const events = parseICS(SAMPLE_ICS)
    // Alice: DTSTART=20260601 (June 1), DTEND=20260606 (June 6 exclusive → June 5 inclusive)
    expect(events[0]!.startDate).toEqual({ year: 2026, month: 5, day: 1 })
    expect(events[0]!.endDate).toEqual({ year: 2026, month: 5, day: 5 })
  })

  it('handles single-day vacations correctly', () => {
    const events = parseICS(SAMPLE_ICS)
    // Bob: DTSTART=20260615, DTEND=20260616 → start=15, end=15
    expect(events[1]!.startDate).toEqual({ year: 2026, month: 5, day: 15 })
    expect(events[1]!.endDate).toEqual({ year: 2026, month: 5, day: 15 })
  })

  it('handles month boundaries when subtracting one day', () => {
    const ics = `BEGIN:VEVENT
SUMMARY:Carol - Out of Office
DTSTART;VALUE=DATE:20260628
DTEND;VALUE=DATE:20260701
END:VEVENT`
    const events = parseICS(ics)
    expect(events[0]!.endDate).toEqual({ year: 2026, month: 5, day: 30 })
  })

  it('returns empty array for input with no VEVENT blocks', () => {
    expect(parseICS('not a real calendar')).toEqual([])
  })

  it('skips events with no person name (empty string before " - Out of Office")', () => {
    const ics = `BEGIN:VEVENT
SUMMARY:- Out of Office
DTSTART;VALUE=DATE:20260601
DTEND;VALUE=DATE:20260602
END:VEVENT`
    // Summary "- Out of Office" splits to "" before " - Out of Office", which is empty after trim
    // (parser checks for empty personName and skips)
    const events = parseICS(ics)
    // Behavior may vary on edge formatting; what matters is no crash and no false person
    expect(events.every((e) => e.personName.length > 0)).toBe(true)
  })
})

describe('groupByPerson', () => {
  it('groups multiple events under one person', () => {
    const events = [
      { personName: 'Alice', startDate: { year: 2026, month: 0, day: 1 }, endDate: { year: 2026, month: 0, day: 2 } },
      { personName: 'Alice', startDate: { year: 2026, month: 1, day: 1 }, endDate: { year: 2026, month: 1, day: 2 } },
      { personName: 'Bob', startDate: { year: 2026, month: 0, day: 5 }, endDate: { year: 2026, month: 0, day: 6 } },
    ]
    const groups = groupByPerson(events)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.personName).toBe('Alice')
    expect(groups[0]!.events).toHaveLength(2)
    expect(groups[1]!.personName).toBe('Bob')
    expect(groups[1]!.events).toHaveLength(1)
  })

  it('returns empty for no events', () => {
    expect(groupByPerson([])).toEqual([])
  })
})
