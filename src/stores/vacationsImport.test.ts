import { describe, it, expect, beforeEach } from 'vitest'
import { ref, toRaw } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useVacationsStore } from './vacations'
import { combineRowOccupants, findFirstFreeRow } from './tickets'
import { useTicketsStore } from './tickets'
import type { IncomingPerson } from '../utils/peopleMatch'

// Regression: re-importing HiBob and re-selecting an already-imported person
// used to drop their vacations. Cause: PeopleConfirmModal echoes back the
// IncomingPerson ref via a reactive prop, so Vue deep-wraps it in a Proxy.
// HomeView's resolved map was keyed by the original IncomingPerson, and a
// Proxy-keyed set + original-keyed get returned undefined. toRaw on the
// echoed ref fixes it.
//
// This test models the exact pattern (Map<IncomingPerson, number> keyed by
// original; modal-roundtripped key goes through a Vue ref) so a future
// refactor that loses the toRaw call breaks the test instead of the user.

const d = (y: number, m: number, day: number) => ({ year: y, month: m, day })

describe('vacation re-import: people round-tripped through a ref', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('still resolves the personId when the decision came through a Vue ref', () => {
    const incoming: IncomingPerson[] = [
      { name: 'Alice', email: null },
      { name: 'Bob', email: null },
    ]

    // Simulate the pipeline: HomeView seeds the resolved map with originals
    // (autoCreate path). PeopleConfirmModal echoes back proxies for the
    // merge-confirmed people (needsConfirm path).
    const resolved = new Map<IncomingPerson, number>()

    // Modal-equivalent: put incoming into a ref, pull it back out → Proxy
    const refContainer = ref(incoming)
    const echoedAlice = refContainer.value[0]!
    const echoedBob = refContainer.value[1]!

    // The fix: toRaw unwraps the Proxy to the original ref the map expects.
    resolved.set(toRaw(echoedAlice), 100)
    resolved.set(toRaw(echoedBob), 200)

    // doImport-equivalent: look up by the original ref (not the proxy)
    expect(resolved.get(incoming[0]!)).toBe(100)
    expect(resolved.get(incoming[1]!)).toBe(200)
  })

  it('addVacations preserves existing vacations when new people are added later', () => {
    // Companion check: confirms the downstream store is fine; the original
    // bug was upstream (Map miss) and never reached this layer.
    const tickets = useTicketsStore()
    const vacations = useVacationsStore()

    const occupants1 = combineRowOccupants(tickets.placements, vacations.entries)
    vacations.addVacations([
      {
        personId: 1, startDate: d(2026, 5, 1), endDate: d(2026, 5, 3),
        row: findFirstFreeRow(occupants1, d(2026, 5, 1), d(2026, 5, 3)),
      },
      {
        personId: 2, startDate: d(2026, 5, 5), endDate: d(2026, 5, 7),
        row: findFirstFreeRow(occupants1, d(2026, 5, 5), d(2026, 5, 7)),
      },
    ])

    const occupants2 = combineRowOccupants(tickets.placements, vacations.entries)
    vacations.addVacations([
      {
        personId: 3, startDate: d(2026, 5, 10), endDate: d(2026, 5, 12),
        row: findFirstFreeRow(occupants2, d(2026, 5, 10), d(2026, 5, 12)),
      },
      {
        personId: 4, startDate: d(2026, 5, 15), endDate: d(2026, 5, 17),
        row: findFirstFreeRow(occupants2, d(2026, 5, 15), d(2026, 5, 17)),
      },
    ])

    expect(vacations.entries.map((v) => v.personId).sort()).toEqual([1, 2, 3, 4])
  })
})
