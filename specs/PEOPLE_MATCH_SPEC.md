# People Matching on Import — Spec

Living doc for how the app decides whether an incoming name (from a CSV epic import or a HiBob ICS import) is the same person as someone already in the project, vs. a new person to create.

## Problem today

Two import paths, two different behaviors, both prone to silently picking the wrong person:

- **CSV epic import** matches automatically with no confirmation. Match priority: exact name (case-insensitive) → existing name *contains* incoming name → incoming name *contains* existing name → create new. So "Mariusz" (from email `mariusz@…`) auto-merges with an existing "Mariusz Dabrowski", and vice versa, and the user never sees it happen.
- **HiBob ICS import** runs the same fuzzy algorithm but surfaces results in `HiBobConfirmModal` — the user can flip matches around before confirming. Better, but still pre-selects fuzzy matches as "merge" by default, so a quick "Confirm" rubber-stamps potentially wrong merges.

The user-visible failure mode: two people who are the same end up as duplicates, or two people who are different get silently merged.

## Goal

Imports should **never silently merge across uncertainty**. Exact name matches are safe to auto-merge. Anything fuzzier — substring, nickname, ambiguous — must surface a confirmation step that lets the user pick "merge with X", "create new", or "skip".

## Match tiers

Every incoming person is classified into one of these tiers. The tier decides whether it confirms or proceeds silently.

| Tier | Definition | Default action |
|---|---|---|
| **Email-known** | The incoming email is already stored on a Person record | Auto-merge, silent |
| **Exact name** | Case-insensitive name equality against a *single* existing person (the email, if any, is new) | Auto-merge, silent. The incoming email (if any) is recorded on the matched person so future imports go email-known. |
| **No match** | Nothing similar exists | Auto-create, silent. No conflict — no decision to make. |
| **Fuzzy** | One name is a substring of the other after normalization, single candidate | **Confirm** with merge pre-selected |
| **Ambiguous** | Multiple existing people could be the match (exact-name OR fuzzy with 2+ candidates) | **Confirm** with no pre-selection — user must pick |

Only tiers where the matcher could be wrong (fuzzy, ambiguous) interrupt the user. Clearly safe cases — already-known emails, single unambiguous name matches, entirely-new names — proceed silently. If two people in the roster already share the same name, an incoming name match becomes ambiguous and surfaces the modal so the user can disambiguate.

There is no "Skip" action. Every incoming person is either merged into an existing one or created new. (If the user genuinely doesn't want them, they can delete the person afterward.)

## Unified confirm modal (PeopleConfirmModal)

A new modal, reused across import sources, that handles only the question "who is who?". It opens after the source-specific picker step (HiBob: after the user checks which people to sync; CSV: after the file is parsed) and only if at least one incoming person needs confirmation. Email-known rows are auto-merged silently and never appear in this modal.

Per-row controls:

- **Action dropdown**: "Merge with [person]" or "Create new"
- **Person picker** (when action is Merge): searchable list of existing people, with the heuristic match pre-selected for Fuzzy / Exact-name tiers
- **Tier badge**: visible label (Exact name / Fuzzy / Ambiguous / New) so the user can see where uncertainty lives

Bottom of modal:
- "Confirm" applies all selected actions
- "Cancel" discards the entire import — nothing is created, no emails are stored, no vacations or tickets are placed

### Name collision on Create New

If the user picks "Create new" for an incoming name that already exists in the project (case-insensitive), the new Person is created with an auto-suffix: `Jonathan (2)`, `Jonathan (3)`, etc. Lowest unused number wins. The user can rename later from the sidebar.

### Auto-merged rows are hidden

Email-known auto-merges happen silently with no visual presence in the modal. The user sees only what they need to decide. (If transparency becomes a wish later, this is a one-line change to surface a "X auto-merged" header.)

## Data model change

`Person` carries any number of email addresses:

```ts
interface Person {
  id: number
  name: string
  color: string
  emails: string[]  // any email ever associated with this person via import
}
```

Email storage policy: on **every** confirmed action — merge or create-new — the incoming email (if any) is appended to the chosen Person's `emails` array if not already present. This maximizes silent steady-state: re-importing the same CSV after one round of confirmation is fully silent.

HiBob ICS imports carry no email, so they never grow the `emails` array. Their next import will re-confirm by name. (Acceptable — HiBob name spellings tend to be stable.)

## Migration

Existing Person records have no `emails` field. On load, treat missing/undefined as `[]`. No data conversion needed.

## Per-source flows

### HiBob ICS

1. `HiBobModal` parses the file (existing).
2. `HiBobConfirmModal` is a **people picker** — checkbox list. Default selection is "matches existing roster" (email-known / exact-name / fuzzy). Names that don't match anyone in the calendar start **unchecked** so importing into an empty project doesn't accidentally add 50 strangers.
3. For each picked person, classify the match tier. Auto-create silently for `none`; open `PeopleConfirmModal` for exact-name / fuzzy / ambiguous.
4. On confirm, create/merge people and import vacations.

### CSV epic

1. `UploadEpicModal` collects the file (existing).
2. Parse owners → unique emails. Classify each.
3. Auto-merge email-known, auto-create `none`. If any rows are exact-name / fuzzy / ambiguous, open `PeopleConfirmModal`. Otherwise skip straight to import.
4. On confirm, create/merge people and import tickets/placements.

### Existing calendar data

If the calendar already has anything on it (seeded sample data OR the user's real work) when an import starts, prompt them: **Replace** the current calendar, or **Merge** the import alongside it. Cancel discards the import. Replace runs the clear immediately (not deferred) so classification sees the right roster — a deferred clear could wipe a Person whose id was already resolved against. Empty calendars skip the prompt and import silently.

## Non-goals

- No automated nickname mapping ("Mike" ↔ "Michael"). The fuzzy heuristic stays simple; the user is the arbiter.
- No background sync or real-time matching against an external directory. Match is per-import.
- No "always merge X with Y" rules separate from the email mechanism — email *is* the rule.
- No per-person color picking in the confirm modal — new people keep the existing random-color assignment.

## Implementation order

1. **Data model**: add `emails: string[]` to `Person` (with migration default of `[]`). Update share-link schema (bump to v5) to carry it.
2. **Classification helper**: a pure function `classifyIncoming(name, email | null, existingPeople) → MatchTier` plus tier types. Unit-test the heck out of it.
3. **PeopleConfirmModal**: new component, props are an array of `{ name, email | null, tier, suggestion }`, emits `confirm` with per-row decisions.
4. **CSV path**: wire classifier + modal into the existing CSV import flow. Drop the in-import fuzzy match (currently in `epicCsv.ts`); the classifier does it now.
5. **HiBob path**: split `HiBobConfirmModal` into picker-only, then route picked people through the same classifier + new modal.
6. **Test coverage**: tier classification, name-collision suffixing, email accumulation on merge, cancel-discards-everything.
