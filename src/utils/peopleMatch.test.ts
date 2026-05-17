import { describe, it, expect } from 'vitest'
import { classifyIncoming, uniquifyName } from './peopleMatch'
import type { Person } from '../stores/people'

function p(id: number, name: string, emails: string[] = []): Person {
  return { id, name, color: '#000', emails }
}

describe('classifyIncoming: email-known', () => {
  it('matches when incoming email is stored on a person (exact)', () => {
    const existing = [p(1, 'Alice', ['alice@example.com'])]
    const result = classifyIncoming({ name: 'A. Different', email: 'alice@example.com' }, existing)
    expect(result.tier).toBe('email-known')
    expect(result.suggestedPersonId).toBe(1)
  })

  it('matches email case-insensitively', () => {
    const existing = [p(1, 'Alice', ['Alice@Example.com'])]
    const result = classifyIncoming({ name: 'Anything', email: 'ALICE@example.COM' }, existing)
    expect(result.tier).toBe('email-known')
  })

  it('wins over a fuzzy name match on a different person', () => {
    // Bob has the email; Alice has the matching name. Email should win.
    const existing = [p(1, 'Alice', []), p(2, 'Bob', ['z@example.com'])]
    const result = classifyIncoming({ name: 'Alice', email: 'z@example.com' }, existing)
    expect(result.tier).toBe('email-known')
    expect(result.suggestedPersonId).toBe(2)
  })
})

describe('classifyIncoming: exact-name', () => {
  it('matches case-insensitively on name when email is new', () => {
    const existing = [p(1, 'Alice Smith', ['alice@example.com'])]
    const result = classifyIncoming({ name: 'alice smith', email: 'new@example.com' }, existing)
    expect(result.tier).toBe('exact-name')
    expect(result.suggestedPersonId).toBe(1)
  })

  it('matches when no email is given (HiBob path)', () => {
    const existing = [p(1, 'Alice Smith')]
    const result = classifyIncoming({ name: 'Alice Smith', email: null }, existing)
    expect(result.tier).toBe('exact-name')
  })

  it('returns ambiguous when two people share the exact name', () => {
    // Two real Jonathans coexist; the user must pick.
    const existing = [p(1, 'Jonathan'), p(2, 'Jonathan')]
    const result = classifyIncoming({ name: 'Jonathan', email: null }, existing)
    expect(result.tier).toBe('ambiguous')
    expect(result.candidateIds).toEqual([1, 2])
  })
})

describe('classifyIncoming: fuzzy', () => {
  it('matches when existing name contains the incoming name', () => {
    const existing = [p(1, 'Mariusz Dabrowski')]
    const result = classifyIncoming({ name: 'Mariusz', email: 'mariusz@example.com' }, existing)
    expect(result.tier).toBe('fuzzy')
    expect(result.suggestedPersonId).toBe(1)
  })

  it('matches when incoming name contains the existing name', () => {
    const existing = [p(1, 'Mariusz')]
    const result = classifyIncoming({ name: 'Mariusz Dabrowski', email: 'm.d@example.com' }, existing)
    expect(result.tier).toBe('fuzzy')
  })

  it('returns ambiguous on multiple fuzzy candidates', () => {
    const existing = [p(1, 'Alice Smith'), p(2, 'Alice Jones')]
    const result = classifyIncoming({ name: 'Alice', email: null }, existing)
    expect(result.tier).toBe('ambiguous')
    expect(result.candidateIds).toEqual([1, 2])
  })
})

describe('classifyIncoming: none', () => {
  it('returns none when nothing matches', () => {
    const existing = [p(1, 'Alice'), p(2, 'Bob')]
    const result = classifyIncoming({ name: 'Carol', email: 'c@example.com' }, existing)
    expect(result.tier).toBe('none')
    expect(result.suggestedPersonId).toBeUndefined()
  })

  it('returns none for an empty incoming name with no email', () => {
    const result = classifyIncoming({ name: '   ', email: null }, [p(1, 'Alice')])
    expect(result.tier).toBe('none')
  })
})

describe('uniquifyName', () => {
  it('returns the requested name when it is unique', () => {
    expect(uniquifyName('Alice', [p(1, 'Bob')])).toBe('Alice')
  })

  it('appends (2) when the name already exists', () => {
    expect(uniquifyName('Jonathan', [p(1, 'Jonathan')])).toBe('Jonathan (2)')
  })

  it('skips taken suffixes to find the lowest free one', () => {
    expect(uniquifyName('Jonathan', [p(1, 'Jonathan'), p(2, 'Jonathan (2)')])).toBe('Jonathan (3)')
  })

  it('matches existing names case-insensitively', () => {
    expect(uniquifyName('Jonathan', [p(1, 'jonathan')])).toBe('Jonathan (2)')
  })
})
