import type { Person } from '../stores/people'

// Per PEOPLE_MATCH_SPEC. Match tier decides whether the import can proceed
// silently or has to surface a confirmation modal.
//
// - email-known: incoming email matches a stored email exactly → safe auto-merge
// - exact-name:  case-insensitive name match, but the email is new (or absent)
// - fuzzy:       one name is a substring of the other after normalization
// - ambiguous:   two or more existing people could be the same person
// - none:        nothing similar exists
export type MatchTier = 'email-known' | 'exact-name' | 'fuzzy' | 'ambiguous' | 'none'

export interface IncomingPerson {
  name: string
  email: string | null
}

export interface Classification {
  incoming: IncomingPerson
  tier: MatchTier
  // For email-known / exact-name / fuzzy: the single suggested match.
  // For ambiguous: the first candidate (UI shows the full list separately).
  // For none: undefined.
  suggestedPersonId?: number
  // Populated for ambiguous; the modal uses this to render the picker without
  // a default selection.
  candidateIds?: number[]
}

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

function isNonEmpty(s: string): boolean {
  return s.length > 0
}

export function classifyIncoming(incoming: IncomingPerson, existing: Person[]): Classification {
  const email = incoming.email ? normalize(incoming.email) : null
  const name = normalize(incoming.name)

  // Tier 1: email-known. Wins outright; even an exact name match on a
  // different person wouldn't override (email is the strong identity).
  if (email) {
    const byEmail = existing.find((p) => p.emails.some((e) => normalize(e) === email))
    if (byEmail) return { incoming, tier: 'email-known', suggestedPersonId: byEmail.id }
  }

  if (!isNonEmpty(name)) return { incoming, tier: 'none' }

  // Tier 2: exact name. Multiple exact matches → ambiguous.
  const exactMatches = existing.filter((p) => normalize(p.name) === name)
  if (exactMatches.length === 1) {
    return { incoming, tier: 'exact-name', suggestedPersonId: exactMatches[0]!.id }
  }
  if (exactMatches.length > 1) {
    return {
      incoming,
      tier: 'ambiguous',
      suggestedPersonId: exactMatches[0]!.id,
      candidateIds: exactMatches.map((p) => p.id),
    }
  }

  // Tier 3: fuzzy (substring either direction). Multiple fuzzy matches →
  // ambiguous.
  const fuzzyMatches = existing.filter((p) => {
    const pn = normalize(p.name)
    return pn.includes(name) || name.includes(pn)
  })
  if (fuzzyMatches.length === 1) {
    return { incoming, tier: 'fuzzy', suggestedPersonId: fuzzyMatches[0]!.id }
  }
  if (fuzzyMatches.length > 1) {
    return {
      incoming,
      tier: 'ambiguous',
      suggestedPersonId: fuzzyMatches[0]!.id,
      candidateIds: fuzzyMatches.map((p) => p.id),
    }
  }

  return { incoming, tier: 'none' }
}

// One user decision emitted by PeopleConfirmModal. The `incoming` ref is the
// same object the caller passed into the modal, so it can be looked up in a
// per-import Map<IncomingPerson, number> after applyDecisions runs.
// Merge → personId is set; Create → personId is omitted and the caller spins
// up a new Person (using uniquifyName to avoid visual duplicates).
export interface Decision {
  incoming: IncomingPerson
  action: 'merge' | 'create'
  personId?: number
}

// Lowest-unused-suffix for a Create-New action when the requested name
// collides with an existing one. "Jonathan" → "Jonathan (2)" if a Jonathan
// already exists; "Jonathan (3)" if (2) is also taken, etc.
export function uniquifyName(requested: string, existing: Person[]): string {
  const taken = new Set(existing.map((p) => normalize(p.name)))
  if (!taken.has(normalize(requested))) return requested
  let n = 2
  while (taken.has(normalize(`${requested} (${n})`))) n++
  return `${requested} (${n})`
}
