import { describe, it, expect } from 'vitest'
import { snapToWeekday, workingDaysBetween, addWorkingDays } from './dates'

// In JS Date, month is 0-indexed. May 2026: 1st = Friday, 2nd = Saturday, 3rd = Sunday
// May 4 = Mon, 5 = Tue, 6 = Wed, 7 = Thu, 8 = Fri, 9 = Sat, 10 = Sun, 11 = Mon

describe('snapToWeekday', () => {
  it('leaves weekdays unchanged', () => {
    const monday = { year: 2026, month: 4, day: 4 }
    expect(snapToWeekday(monday, 'forward')).toEqual(monday)
    expect(snapToWeekday(monday, 'backward')).toEqual(monday)
  })

  it('snaps Saturday forward to Monday', () => {
    const saturday = { year: 2026, month: 4, day: 9 }
    expect(snapToWeekday(saturday, 'forward')).toEqual({ year: 2026, month: 4, day: 11 })
  })

  it('snaps Saturday backward to Friday', () => {
    const saturday = { year: 2026, month: 4, day: 9 }
    expect(snapToWeekday(saturday, 'backward')).toEqual({ year: 2026, month: 4, day: 8 })
  })

  it('snaps Sunday forward to Monday', () => {
    const sunday = { year: 2026, month: 4, day: 10 }
    expect(snapToWeekday(sunday, 'forward')).toEqual({ year: 2026, month: 4, day: 11 })
  })

  it('snaps Sunday backward to Friday', () => {
    const sunday = { year: 2026, month: 4, day: 10 }
    expect(snapToWeekday(sunday, 'backward')).toEqual({ year: 2026, month: 4, day: 8 })
  })
})

describe('workingDaysBetween', () => {
  it('returns 0 for same day', () => {
    const d = { year: 2026, month: 4, day: 4 }
    expect(workingDaysBetween(d, d)).toBe(0)
  })

  it('counts Mon → Fri (same week) as 4 working days', () => {
    expect(
      workingDaysBetween({ year: 2026, month: 4, day: 4 }, { year: 2026, month: 4, day: 8 }),
    ).toBe(4)
  })

  it('skips the weekend between Fri and following Mon', () => {
    expect(
      workingDaysBetween({ year: 2026, month: 4, day: 8 }, { year: 2026, month: 4, day: 11 }),
    ).toBe(1)
  })

  it('counts a full week (Mon → next Mon) as 5 working days', () => {
    expect(
      workingDaysBetween({ year: 2026, month: 4, day: 4 }, { year: 2026, month: 4, day: 11 }),
    ).toBe(5)
  })
})

describe('addWorkingDays', () => {
  it('returns the same date when adding 0 days', () => {
    const d = { year: 2026, month: 4, day: 4 }
    expect(addWorkingDays(d, 0)).toEqual(d)
  })

  it('adds 1 working day Mon → Tue', () => {
    expect(addWorkingDays({ year: 2026, month: 4, day: 4 }, 1)).toEqual({
      year: 2026,
      month: 4,
      day: 5,
    })
  })

  it('jumps from Friday over the weekend to next Monday', () => {
    expect(addWorkingDays({ year: 2026, month: 4, day: 8 }, 1)).toEqual({
      year: 2026,
      month: 4,
      day: 11,
    })
  })

  it('rolls across month boundaries', () => {
    // May 29 2026 = Friday. +2 working days = Tuesday June 2
    expect(addWorkingDays({ year: 2026, month: 4, day: 29 }, 2)).toEqual({
      year: 2026,
      month: 5,
      day: 2,
    })
  })

  it('rolls across year boundaries', () => {
    // Dec 31 2026 = Thursday. +1 working day = Friday Jan 1 2027 (NB: holidays not considered here)
    expect(addWorkingDays({ year: 2026, month: 11, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 0,
      day: 1,
    })
  })
})
