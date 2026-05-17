# Drag & Drop / Stacking Spec

Living doc for the drag/drop + stacking system. Update as behavior changes.

## Goal

Drag-and-drop should feel like **playing with blocks**. The user drops a ticket where they want it, and it lands there. No "why is it sitting in this weird spot?" moments.

## Core invariant

> **Every week's rows are contiguous from 0 to N-1. No holes.**

If a week has 3 rows of tickets, those rows are 0, 1, 2 — never 0, 1, 4. This makes the layout predictable: you can always see exactly what rows exist and where new drops can land.

## Data model

Every placement stores its row explicitly. There is no auto-derived row.

```ts
interface Placement {
  ticketId: number
  startDate: CalendarDate
  endDate: CalendarDate
  row: number  // required, 0-indexed top-to-bottom
}
```

Rendering is dumb: for each day, render placements at their stored `row`. Cell height in a week = `(max row used in that week) + 1`.

The `slotMap` computed in MonthCalendar (which currently does greedy assignment on every render) goes away entirely.

## Drop semantics

### Drop targets

For any day in a week, the valid drop rows are `[0, effectiveRowCount]` — every existing row plus one beyond the bottom. The "one beyond" is the only way to grow the stack.

Where `effectiveRowCount` = `(max stored row of any placement that touches this week) + 1`. Anchored multi-week pills count toward this, even in days they don't visually occupy.

Examples:

- **Empty week:** effectiveRowCount = 0, so the only valid drop is row 0 anywhere. (Extending past 0 — the "one beyond" — gives you row 0 as the only target.)
- **Mon has a ticket at row 0, rest empty:** effectiveRowCount = 1. Valid drops on any day: row 0 (slot in, where empty) or row 1 (extend down). To "extend up" (insert a new top row), drop at row 0 of the day that already has the ticket — push semantics handle it (existing shifts to row 1, new lands at row 0).
- **Anchored pill at row 5 in an otherwise empty week:** effectiveRowCount = 6. Valid drops in any day: rows 0–6. All the "phantom rows" 0–4 are usable.

### Row numbering

When the user drops "above" the current topmost row, the new ticket gets row 0 and everything else shifts down by 1. Rows always start at 0 after every operation — no negative indices stored. (Functionally identical to negative indices + renormalize on render; this is simpler to reason about.)

### Sidebar → calendar (first placement)

User picks the row at drop time. Same target indicator as any other move. Dropping at the bottom of the stack is just one of several valid options.

## Collision policy: cascade push with live preview

When a drop lands on (day, row) that's already occupied, the existing ticket gets pushed down by 1. If that push creates a new conflict, the displaced ticket also pushes down. Cascade continues until no conflicts remain. **Drops always succeed** (within the core invariant); the system never rejects on collision.

The trade-off — that a small drop can cascade through several tickets — is solved by **showing the entire cascade live in the drag preview**. The user sees every ticket that will shift before they release. No surprises on drop.

### Cascade examples

- **Simple push:** A is Mon–Fri row 0. Drop B single-day Wed at row 0. A shifts to row 1.
- **One-step cascade:** A is Mon–Fri row 0, B is Tue–Wed row 1. Drop C single-day Wed at row 0. A pushes to row 1, A now conflicts with B, B pushes to row 2.
- **Multi-step cascade:** A, B, C all Mon–Fri at rows 0/1/2. Drop D single-day Wed at row 0. A→1, B→2, C→3.

In all cases, the preview shows the final state before the drop is committed.

### Why this approach

- **Pure push without preview** can shift many tickets at once and feels disproportionate — "I dropped one thing and my whole week moved."
- **Pure reject** sends the user hunting for the one row the system will accept — friction.
- **Push + live preview** gives both the "blocks" feel (drops always work) and the "I see what's about to happen" feel. The user never commits to something they didn't visualize.

Undo remains the safety net for "I committed and changed my mind."

## Multi-day pills

A multi-day placement is a single row stored once. The whole span renders at that row across every day it touches.

### Cross-week behavior

A multi-week pill keeps its stored `row` in every week it touches — visual continuity matters more than minimizing empty rows. The pill never jumps at a week boundary.

When a pill anchors a high row in an otherwise empty week, those empty rows aren't wasted — they become **usable phantom rows**. The user can drop new tickets into them.

This means the drop-target rule is the same whether a row is occupied by an "actual" placement in this week or just held open by an anchor:

> A week's effective row count = `(max stored row of any placement that touches this week) + 1`. All rows in `[0, effectiveRowCount]` are valid drop targets in any day.

Example:
```
Week 1:                          Week 2:
        Mon  Tue  Wed  Thu  Fri          Mon  Tue  Wed  Thu  Fri
row 0: [A——][B——][C——]                  [D——]
row 1: [E————————————————X————————————————]
row 2:
```
- A, B, C are in week 1 only at rows 0
- E is in week 1 at row 1
- X is a multi-week pill from week 1 (stored row 1), anchored at row 1 in week 2
- D is in week 2 at row 0
- Week 2's effective row count = 2 (X anchors row 1), so drop targets in week 2 are rows 0, 1, 2.

### Multi-day drop validation

A drop is rejected if the chosen row is occupied on ANY day within the drop's span (subject to the push policy above).

## Vacations

Vacations live in the **same row space** as tickets. They are treated as just another placement type — there is no separate "vacation zone" below tickets.

The only special case: **HiBob ICS imports assign rows greedily** — each incoming vacation lands at the lowest row that doesn't conflict on its days. Vacations on different days of the same week share a row when possible; vacations on the same day stack vertically. Manually dragged vacations follow the same drop rules as tickets.

## Visual drag indicator

During a drag, show:

1. **Ghost pill** for the dragged ticket at its would-be (day, row) on release — semi-transparent, "clears a space" at the target so the user sees exactly where it'll sit.
2. **Other tickets shift in real time** to their would-be positions as the cascade resolves. No special styling on the displaced tickets — they just move. The ghost is the only thing styled differently.
3. **Real-time update** — moving the cursor recomputes the cascade and re-renders the layout every frame.

The preview is the contract: **what the user sees in the preview is exactly what they get on release.** No surprises.

Cancelling the drag (Esc or releasing outside a drop target) reverts the preview cleanly — no settled tickets are touched.

## Shrink on remove

Removing a ticket can leave a row empty. The core invariant requires the stack stay contiguous, so:

- When a ticket is removed, scan the week for any newly-empty rows.
- If row K is empty across all days in the week, shift all rows > K down by 1.
- Repeat until no empty rows remain.

This also applies to **move** — when a ticket moves out of a row, the source week may need to compact.

## Resize

Resize changes dates only, never the row. A resized ticket stays at its stored row; the date range stretches or shrinks horizontally.

If a resize would cause the ticket to overlap another ticket on the same row (because the new date range now collides), the resize is rejected with a toast. (We don't push during resize — the user is editing one ticket, not adding a new one.)

## Stack height cap

None. The stack can grow as tall as the user wants. Easy to add later if it becomes a problem.

## Edge cases / open questions

- **Drop on the only ticket's own row, from itself:** moving a ticket within its own day to a different row. The "source" row becomes empty during the drag preview; this should be handled correctly by the shrink logic so the user sees the row count drop in real-time.
- **Drag-cancel during a cascade preview:** if the user starts a drop that would cascade many tickets and then cancels (Esc), all the visual previews should revert cleanly.
- **Undo of a cascade drop:** undo should restore ALL displaced tickets to their original rows, not just the dragged one. The undo entry needs to capture the full pre-drop snapshot.
- **Loaded data that violates the invariant:** if a saved project or share link arrives with row gaps (e.g., from a corrupted state or an older format), should we auto-compact on load? Probably yes — silent normalization is fine since it doesn't change visible intent.

## Implementation order

No one's using the app yet — we're rewriting in place, no migration, no backward-compat shims. Focus on functionality first, tests after.

1. Add required `row: number` to `Placement` (no `?`). Update sample seed data + share-link encode/decode + storage to round-trip it.
2. Rip out `slotMap` computed. Render walks `placements` directly using stored `row`. Calculate `effectiveRowCount` per week.
3. Update `placeTicket` / `moveTicket` signatures to require `row`.
4. Compute `(day, row)` from cursor position in the drop handler.
5. Implement push + cascade resolution. Cascade preview computed during drag.
6. Implement shrink-on-remove and shrink-on-move-out (preserve the no-holes invariant within a week).
7. Visual: ghost pill (semi-transparent, "clears" target space) + real-time live cascade movement of other tickets.
8. Rev existing e2e tests until they pass against the new system; add new tests for cascade preview, push semantics, anchoring, and shrink.
