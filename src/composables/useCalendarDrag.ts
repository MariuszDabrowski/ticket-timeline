import { ref, type Ref } from 'vue'
import { compareCalendarDates, type CalendarDate } from '../stores/tickets'
import { useTicketsStore } from '../stores/tickets'
import { useVacationsStore } from '../stores/vacations'
import { usePeopleStore } from '../stores/people'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
import { useUndoStack } from './useUndoStack'
import { workingDaysBetween } from '../utils/dates'
import { spanInDays } from '../utils/dates'
import { suppressNativeDragImage, setMoveDropEffect, setPillDragImage } from '../utils/drag'
import { colorForTicket, pillGradient } from '../utils/colors'
import type { CascadeItem } from '../utils/cascade'

// Drop-target info the drag handlers report up to the renderer (typed loosely
// since the renderer's DayTicketInfo / DayVacationInfo include lots of
// render-only flags). All we need on this side is the placement + ids.
export interface DragStartTicketInfo {
  ticket: { id: number }
  placement: { startDate: CalendarDate; endDate: CalendarDate }
}

export interface DragStartVacationInfo {
  vacationId: number
  startDate: CalendarDate
  endDate: CalendarDate
}

// Pulls every drag-related concern out of MonthCalendar.vue: the cursor →
// (day, row) math, the start/over/leave/drop handlers, the snapshot+commit
// dance for undo, and the dragOverDay highlight state. The renderer wires
// these onto cell dragover/drop + pill dragstart events.
//
// Calendar-specific inputs (calDate, visibleDays, dayRowIndex, previewItems,
// commitLayout, isTicketVisible, ticketTooltip) come in as args; stores are
// resolved internally so the composable owns its own coupling.
export function useCalendarDrag(opts: {
  calDate: (day: number) => CalendarDate
  visibleDays: Ref<number[]>
  dayRowIndex: (visibleDayIndex: number) => number
  previewItems: Ref<CascadeItem[]>
  commitLayout: (layout: CascadeItem[]) => void
  isTicketVisible: (ticketId: number) => boolean
  ticketTooltip: Ref<unknown | null>
}) {
  const { calDate, visibleDays, dayRowIndex, previewItems, commitLayout, isTicketVisible, ticketTooltip } = opts

  const ticketsStore = useTicketsStore()
  const vacationsStore = useVacationsStore()
  const peopleStore = usePeopleStore()
  const dragState = useDragStateStore()
  const options = useOptionsStore()
  const undoStack = useUndoStack()

  const dragOverDay = ref<number | null>(null)

  // Translate cursor Y inside a day cell into a row index. Slots are 1.4rem
  // tall with a 0.2rem gap (1.6rem stride) and the placed-tickets container
  // has 0.3rem top padding — same constants the renderer uses.
  //
  // Sticky origin: while the cursor stays within the dragged item's original
  // row (vertically), keep that row — don't move yet. Otherwise Math.round
  // snaps to the nearest row center, so dragging past the visual midpoint of
  // another pill jumps past it (Trello-style "insert below" rather than
  // always pushing).
  function rowFromY(cellEl: HTMLElement, clientY: number, originRow: number): number {
    const placed = cellEl.querySelector('.placed-tickets') as HTMLElement | null
    if (!placed) return 0
    const rect = placed.getBoundingClientRect()
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const slotHeight = 1.6 * rootFontSize
    const paddingTop = 0.3 * rootFontSize
    const y = clientY - rect.top - paddingTop
    const raw = y / slotHeight
    if (raw >= originRow && raw < originRow + 1) return originRow
    return Math.max(0, Math.round(raw))
  }

  // Max stored row of any placement that touches the given week, OPTIONALLY
  // excluding one item (so during a drag we don't count the dragged ticket
  // against itself when clamping). Drives the "extend by 1" upper bound on
  // valid drop rows.
  function maxRowInWeek(weekIdx: number, excludeKey?: string): number {
    let max = -1
    for (let i = 0; i < visibleDays.value.length; i++) {
      if (dayRowIndex(i) !== weekIdx) continue
      const day = visibleDays.value[i]!
      const dayDate = calDate(day)
      for (const p of ticketsStore.placements) {
        if (excludeKey === `ticket:${p.ticketId}`) continue
        if (!isTicketVisible(p.ticketId)) continue
        if (compareCalendarDates(p.startDate, dayDate) > 0) continue
        if (compareCalendarDates(dayDate, p.endDate) > 0) continue
        if (p.row > max) max = p.row
      }
      for (const v of vacationsStore.entries) {
        if (excludeKey === `vacation:${v.id}`) continue
        if (v.startDate === null || v.endDate === null) continue
        if (options.hiddenPersonIds.has(v.personId)) continue
        if (compareCalendarDates(v.startDate, dayDate) > 0) continue
        if (compareCalendarDates(dayDate, v.endDate) > 0) continue
        if (v.row > max) max = v.row
      }
    }
    return max
  }

  function onDragOver(event: DragEvent, day: number) {
    event.preventDefault()
    setMoveDropEffect(event)

    // For any active move (calendar ticket, calendar vacation, sidebar new
    // ticket [a moveDrag with no existing placement], sidebar new vacation),
    // compute the would-be (day, row) from the cursor and stash them in
    // dragState so previewItems can run cascade and every visible month
    // re-renders the would-be layout in real time.
    const activeMove =
      dragState.moveDrag
        ? { kind: 'ticket' as const, key: `ticket:${dragState.moveDrag.ticketId}` }
        : dragState.vacationMoveDrag
        ? { kind: 'vacation' as const, key: `vacation:${dragState.vacationMoveDrag.vacationId}` }
        : dragState.newVacationDrag
        ? { kind: 'new-vacation' as const, key: 'new-vacation' }
        : null

    if (activeMove) {
      if (activeMove.kind === 'ticket') dragState.updateMovePreview(calDate(day))
      else if (activeMove.kind === 'vacation') dragState.updateVacationMovePreview(calDate(day))
      else dragState.updateNewVacationPreview(calDate(day))

      const cellEl = event.currentTarget as HTMLElement | null
      if (cellEl) {
        const visibleIdx = visibleDays.value.indexOf(day)
        if (visibleIdx !== -1) {
          const weekIdx = dayRowIndex(visibleIdx)
          // Look up the dragged item's original (stored) row so rowFromY can
          // apply sticky-origin — cursor inside that row's vertical band
          // keeps the row unchanged, no premature push. New items (sidebar
          // drags) have no origin row; use 0 so the first row of every week
          // becomes the natural landing target.
          const originRow =
            activeMove.kind === 'ticket'
              ? ticketsStore.placements.find((p) => p.ticketId === dragState.moveDrag!.ticketId)?.row ?? 0
              : activeMove.kind === 'vacation'
              ? vacationsStore.entries.find((v) => v.id === dragState.vacationMoveDrag!.vacationId)?.row ?? 0
              : 0
          const rawRow = rowFromY(cellEl, event.clientY, originRow)
          const maxOther = maxRowInWeek(weekIdx, activeMove.key)
          const cappedRow = Math.min(rawRow, maxOther + 1)
          dragState.updateMovePreviewRow(cappedRow)
        }
      }
    }

    if (dragOverDay.value === day) return
    dragOverDay.value = day
    if (dragState.resizeDrag) dragState.updateResizePreview(calDate(day))
    if (dragState.vacationResizeDrag) dragState.updateVacationResizePreview(calDate(day))
  }

  function onDragLeave(event: DragEvent) {
    if ((event.currentTarget as Element).contains(event.relatedTarget as Node)) return
    dragOverDay.value = null
  }

  function onHandleDragStart(event: DragEvent, ticketId: number, side: 'start' | 'end') {
    event.stopPropagation()
    suppressNativeDragImage(event)
    event.dataTransfer?.setData('resizeHandle', `${side}:${ticketId}`)
    dragState.startResizeDrag(ticketId, side)
    ticketTooltip.value = null
    dragState.hoveredTicketId = null
  }

  function onVacationHandleDragStart(event: DragEvent, vacationId: number, side: 'start' | 'end') {
    event.stopPropagation()
    suppressNativeDragImage(event)
    event.dataTransfer?.setData('vacationResizeHandle', `${side}:${vacationId}`)
    dragState.startVacationResizeDrag(vacationId, side)
  }

  function onVacationDragStart(event: DragEvent, info: DragStartVacationInfo) {
    // Custom pill ghost so the cursor carries a labeled "{Name} Vacation"
    // chip regardless of which segment of a multi-day bar was grabbed.
    const entry = vacationsStore.entries.find((v) => v.id === info.vacationId)
    const person = entry ? peopleStore.people.find((p) => p.id === entry.personId) : null
    const text = `${person?.name ?? 'Person'} Vacation`
    const background =
      'repeating-linear-gradient(45deg, #2a2a2a 0px, #2a2a2a 3px, #323232 3px, #323232 9px)'
    setPillDragImage(event, { text, background })
    event.dataTransfer?.setData('moveCalendarVacation', String(info.vacationId))
    const span = options.hideWeekends
      ? workingDaysBetween(info.startDate, info.endDate)
      : spanInDays(info.startDate, info.endDate)
    dragState.startVacationMoveDrag(info.vacationId, span)
  }

  function onTicketDragStart(event: DragEvent, info: DragStartTicketInfo) {
    // Custom pill ghost so the cursor always carries a labeled chip — needed
    // for multi-day pills where grabbing a middle segment would otherwise
    // show a label-less chunk under the cursor.
    const ticket = ticketsStore.tickets.find((t) => t.id === info.ticket.id)
    if (ticket) {
      const text = ticket.isLabel ? ticket.title || 'Event' : ticket.number
      const color = colorForTicket(ticket, peopleStore.people)
      // Layer a 45° stripe overlay on event pills to match their calendar look.
      const background = ticket.isLabel
        ? `repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 3px, transparent 3px, transparent 9px), ${pillGradient(color)}`
        : pillGradient(color)
      setPillDragImage(event, { text, background })
    }
    event.dataTransfer?.setData('moveCalendarTicket', String(info.ticket.id))
    const span = options.hideWeekends
      ? workingDaysBetween(info.placement.startDate, info.placement.endDate)
      : spanInDays(info.placement.startDate, info.placement.endDate)
    dragState.startMoveDrag(info.ticket.id, span)
    ticketTooltip.value = null
    dragState.hoveredTicketId = null
  }

  // Shared undo step: every drag commit (move / resize / sidebar drop)
  // snapshots tickets + vacations beforehand so the cascade can be fully
  // reverted by replaying the snapshot.
  function snapshotLayout() {
    return {
      ticketSnapshot: ticketsStore.placements.map((p) => ({ ...p })),
      vacationSnapshot: vacationsStore.entries.map((v) => ({ ...v })),
    }
  }

  function restoreLayout(snap: ReturnType<typeof snapshotLayout>) {
    for (const t of snap.ticketSnapshot) {
      ticketsStore.moveTicket(t.ticketId, t.startDate, t.endDate, t.row)
    }
    for (const v of snap.vacationSnapshot) {
      if (v.startDate && v.endDate) {
        vacationsStore.placeVacation(v.id, v.startDate, v.endDate, v.row)
      }
    }
  }

  function onDrop(event: DragEvent, day: number) {
    event.preventDefault()
    dragOverDay.value = null

    const resizeHandle = event.dataTransfer?.getData('resizeHandle')
    if (resizeHandle) {
      // Commit the cascaded preview so a resize that overlaps a neighbor
      // pushes it down instead of rendering on top. Snapshot for undo since
      // the cascade can move several placements.
      const snap = snapshotLayout()
      commitLayout(previewItems.value)
      undoStack.push(() => restoreLayout(snap))
      dragState.clearResizeDrag()
      return
    }

    const moveData = event.dataTransfer?.getData('moveCalendarTicket')
    if (moveData && dragState.moveDrag) {
      // previewItems already contains the cascade-resolved layout for the
      // current hover position — commit it, then shrink so any rows left
      // empty by the move-out get compacted.
      const snap = snapshotLayout()
      commitLayout(previewItems.value)
      undoStack.push(() => restoreLayout(snap))
      dragState.clearMoveDrag()
      return
    }

    const ticketId = event.dataTransfer?.getData('ticketId')
    if (ticketId) {
      // Sidebar ticket/label drag — commit the cascaded preview so cursor
      // row pick + push behave the same as a calendar-to-calendar drag.
      // Snapshot first so undo restores any pushed neighbors too.
      const snap = snapshotLayout()
      commitLayout(previewItems.value)
      undoStack.push(() => {
        ticketsStore.removePlacement(Number(ticketId))
        restoreLayout(snap)
      })
      dragState.clearMoveDrag()
      return
    }

    const vacationResizeHandle = event.dataTransfer?.getData('vacationResizeHandle')
    if (vacationResizeHandle) {
      const snap = snapshotLayout()
      commitLayout(previewItems.value)
      undoStack.push(() => restoreLayout(snap))
      dragState.clearVacationResizeDrag()
      return
    }

    const vacationId = event.dataTransfer?.getData('vacationId')
    if (vacationId) {
      const entry = vacationsStore.entries.find((v) => v.id === Number(vacationId))
      const oldStart = entry?.startDate
      const oldEnd = entry?.endDate
      vacationsStore.placeVacation(Number(vacationId), calDate(day), calDate(day))
      if (oldStart && oldEnd) {
        undoStack.push(() => vacationsStore.placeVacation(Number(vacationId), oldStart, oldEnd))
      }
      dragState.clearVacationMoveDrag()
      return
    }

    const newVacationPersonId = event.dataTransfer?.getData('newVacationPersonId')
    if (newVacationPersonId) {
      const personId = Number(newVacationPersonId)
      const snap = snapshotLayout()
      // Pull the cascaded layout the user is seeing right now. The new
      // vacation appears under the sentinel key 'new-vacation'; re-key it
      // to the real id before commitLayout so the row + cascade actually
      // applies.
      const layout = previewItems.value
      const id = vacationsStore.addVacation(personId)
      const previewedRow = layout.find((i) => i.key === 'new-vacation')?.row ?? 0
      vacationsStore.placeVacation(id, calDate(day), calDate(day), previewedRow)
      const rekeyed = layout.map((i) =>
        i.key === 'new-vacation' ? { ...i, key: `vacation:${id}` } : i,
      )
      commitLayout(rekeyed)
      undoStack.push(() => {
        vacationsStore.removeVacation(id)
        restoreLayout(snap)
      })
      dragState.clearNewVacationDrag()
      return
    }

    const moveVacationData = event.dataTransfer?.getData('moveCalendarVacation')
    if (moveVacationData && dragState.vacationMoveDrag) {
      const snap = snapshotLayout()
      commitLayout(previewItems.value)
      undoStack.push(() => restoreLayout(snap))
      dragState.clearVacationMoveDrag()
    }
  }

  return {
    dragOverDay,
    onDragOver,
    onDragLeave,
    onDrop,
    onHandleDragStart,
    onVacationHandleDragStart,
    onVacationDragStart,
    onTicketDragStart,
  }
}
