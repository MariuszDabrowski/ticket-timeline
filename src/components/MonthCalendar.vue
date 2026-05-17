<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRef } from 'vue'
import { useTicketsStore, compareCalendarDates } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
import { useVacationsStore } from '../stores/vacations'
import { snapToWeekday, workingDaysBetween, addWorkingDays, addDays, fmtShortDate, workingDayCount } from '../utils/dates'
import { useMonthGrid } from '../composables/useMonthGrid'
import { useCalendarDrag } from '../composables/useCalendarDrag'
import { cascadePush, shrinkRows, type CascadeItem } from '../utils/cascade'
import { colorForTicket, segmentGradient } from '../utils/colors'
import type { Ticket, Placement, CalendarDate } from '../stores/tickets'

const props = defineProps<{
  year: number
  month: number
  flashToday?: boolean
}>()

const emit = defineEmits<{
  editTicket: [ticket: Ticket]
  editLabel: [ticket: Ticket]
  editVacation: [vacationId: number]
}>()

const {
  monthName,
  dayHeaders,
  columnCount,
  visibleDays,
  startOffset,
  firstVisibleDay,
  lastVisibleDay,
  holidayMap,
  isToday,
  colPos,
  dayRowIndex,
} = useMonthGrid(toRef(props, 'year'), toRef(props, 'month'))

const ticketsStore = useTicketsStore()
const peopleStore = usePeopleStore()
const dragState = useDragStateStore()
const options = useOptionsStore()
const vacationsStore = useVacationsStore()

function calDate(day: number): CalendarDate {
  return { year: props.year, month: props.month, day }
}


function assignedName(ticket: Ticket): string {
  if (ticket.assignedTo === null) return 'Unassigned'
  return peopleStore.people.find((p) => p.id === ticket.assignedTo)?.name ?? 'Unassigned'
}

function durationDays(start: CalendarDate, end: CalendarDate, personId?: number | null): number {
  return workingDayCount(
    start,
    end,
    personId != null
      ? (cd) => vacationsStore.isPersonOnVacation(personId, cd, cd)
      : undefined,
  )
}

interface TicketTooltipState {
  title: string | undefined
  startDate: CalendarDate
  endDate: CalendarDate
  assignedTo: string | null
  duration: number
  x: number
  y: number
}

const ticketTooltip = ref<TicketTooltipState | null>(null)
let hideTooltipTimer: ReturnType<typeof setTimeout> | null = null

const isScrolling = ref(false)
let scrollTimer: ReturnType<typeof setTimeout> | null = null
function onScroll() {
  isScrolling.value = true
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => { isScrolling.value = false }, 150)
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true, capture: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll, { capture: true }))

function showTicketTooltip(e: MouseEvent | FocusEvent, info: DayTicketInfo) {
  // During any drag, don't react to hover. Cascade-pushed pills slide under the
  // cursor and would otherwise trigger mouseenter → spurious S/F markers on
  // pills the user wasn't actually hovering.
  if (
    dragState.moveDrag || dragState.vacationMoveDrag ||
    dragState.resizeDrag || dragState.vacationResizeDrag ||
    dragState.newVacationDrag
  ) return
  if (hideTooltipTimer) { clearTimeout(hideTooltipTimer); hideTooltipTimer = null }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dragState.hoveredTicketId = info.ticket.id
  ticketTooltip.value = {
    title: info.ticket.title || undefined,
    startDate: info.placement.startDate,
    endDate: info.placement.endDate,
    assignedTo: info.ticket.isLabel ? null : assignedName(info.ticket),
    duration: durationDays(info.placement.startDate, info.placement.endDate, info.ticket.assignedTo),
    x: rect.left + rect.width / 2,
    y: rect.top,
  }
}

function hideTicketTooltip() {
  hideTooltipTimer = setTimeout(() => {
    ticketTooltip.value = null
    dragState.hoveredTicketId = null
  }, 80)
}

function setVacationHover(vacationId: number | null) {
  // Same guard as showTicketTooltip — don't react to hover during a drag, or
  // cascade-pushed vacations would show spurious S/F markers when they slide
  // under the cursor.
  if (
    dragState.moveDrag || dragState.vacationMoveDrag ||
    dragState.resizeDrag || dragState.vacationResizeDrag ||
    dragState.newVacationDrag
  ) return
  dragState.hoveredVacationId = vacationId
}


function ticketColor(ticket: { assignedTo: number | null; isLabel?: boolean; labelColor?: string }): string {
  return colorForTicket(ticket, peopleStore.people)
}

function effectivePlacement(placement: Placement): Placement {
  let result = placement

  if (dragState.resizeDrag?.ticketId === placement.ticketId && dragState.resizePreviewDate) {
    const previewDate = dragState.resizePreviewDate
    if (dragState.resizeDrag.side === 'start' && compareCalendarDates(previewDate, placement.endDate) <= 0)
      result = { ...placement, startDate: previewDate }
    else if (dragState.resizeDrag.side === 'end' && compareCalendarDates(previewDate, placement.startDate) >= 0)
      result = { ...placement, endDate: previewDate }
  } else if (dragState.moveDrag?.ticketId === placement.ticketId && dragState.movePreviewDate) {
    const newStart = dragState.movePreviewDate
    const newEnd = options.hideWeekends
      ? addWorkingDays(newStart, dragState.moveDrag.span)
      : addDays(newStart, dragState.moveDrag.span)
    result = { ...placement, startDate: newStart, endDate: newEnd }
  }

  if (options.hideWeekends) {
    const snappedStart = snapToWeekday(result.startDate, 'forward')
    let snappedEnd = snapToWeekday(result.endDate, 'backward')
    if (compareCalendarDates(snappedEnd, snappedStart) < 0) snappedEnd = snappedStart
    result = { ...result, startDate: snappedStart, endDate: snappedEnd }
  }

  return result
}

function isTicketVisible(ticketId: number): boolean {
  const ticket = ticketsStore.tickets.find((t) => t.id === ticketId)
  if (!ticket) return false
  if (ticket.assignedTo !== null && options.hiddenPersonIds.has(ticket.assignedTo)) return false
  return true
}


interface DayTicketInfo {
  ticket: Ticket
  placement: Placement
  isStart: boolean
  isEnd: boolean
  isRowEnd: boolean
  isRowStart: boolean
  isPreview: boolean
  isOnVacation: boolean
  spanIndex: number
  spanTotal: number
}


// --- Vacation date helpers (preview/resize-aware) ---

interface DayVacationInfo {
  vacationId: number
  personId: number
  color: string
  personName: string
  startDate: CalendarDate
  endDate: CalendarDate
  isStart: boolean
  isEnd: boolean
  isRowStart: boolean
  isRowEnd: boolean
  isPreview: boolean
  // True when the same person has a ticket on this day — both pills render
  // with a red highlight so the planner sees the conflict but isn't blocked.
  isConflict: boolean
}

function effectiveVacation(entry: { id: number; personId: number; startDate: CalendarDate | null; endDate: CalendarDate | null }): { startDate: CalendarDate; endDate: CalendarDate } {
  let startDate = entry.startDate!
  let endDate = entry.endDate!

  if (dragState.vacationResizeDrag?.vacationId === entry.id && dragState.vacationResizePreviewDate) {
    const previewDate = dragState.vacationResizePreviewDate
    if (dragState.vacationResizeDrag.side === 'start' && compareCalendarDates(previewDate, endDate) <= 0)
      startDate = previewDate
    else if (dragState.vacationResizeDrag.side === 'end' && compareCalendarDates(previewDate, startDate) >= 0)
      endDate = previewDate
  } else if (dragState.vacationMoveDrag?.vacationId === entry.id && dragState.vacationMovePreviewDate) {
    startDate = dragState.vacationMovePreviewDate
    endDate = options.hideWeekends
      ? addWorkingDays(startDate, dragState.vacationMoveDrag.span)
      : addDays(startDate, dragState.vacationMoveDrag.span)
  }

  if (options.hideWeekends) {
    startDate = snapToWeekday(startDate, 'forward')
    let snappedEnd = snapToWeekday(endDate, 'backward')
    if (compareCalendarDates(snappedEnd, startDate) < 0) snappedEnd = startDate
    endDate = snappedEnd
  }

  return { startDate, endDate }
}

// --- Unified row-space rendering: tickets and vacations share rows, indexed by
// the stored `row` field on each placement. No greedy assignment — we just read
// the stored row and place it. ---

type UnifiedSlot =
  | { kind: 'ticket'; info: DayTicketInfo }
  | { kind: 'vacation'; info: DayVacationInfo }
  | null

// Collect every visible ticket + vacation as a CascadeItem, applying any active
// drag-preview dates. If the user is currently mid-drag on a ticket and has a
// target row picked, run cascadePush so the preview reflects the would-be
// layout — pushed neighbors render at their post-cascade rows, not their
// stored rows.
const previewItems = computed<CascadeItem[]>(() => {
  const items: CascadeItem[] = []

  for (const p of ticketsStore.placements) {
    if (!isTicketVisible(p.ticketId)) continue
    const eff = effectivePlacement(p)
    items.push({
      key: `ticket:${p.ticketId}`,
      startDate: eff.startDate,
      endDate: eff.endDate,
      row: p.row,
    })
  }

  for (const v of vacationsStore.entries) {
    if (v.startDate === null || v.endDate === null) continue
    if (options.hiddenPersonIds.has(v.personId)) continue
    const eff = effectiveVacation(v)
    items.push({
      key: `vacation:${v.id}`,
      startDate: eff.startDate,
      endDate: eff.endDate,
      row: v.row,
    })
  }

  // Ticket move (calendar OR sidebar). For calendar drags the ticket is already
  // in `items`; cascadePush replaces it. For sidebar drags the ticket has no
  // placement yet — cascadePush still works (target just gets added to the
  // result), so the preview shows the new ticket landing in real time.
  if (dragState.moveDrag && dragState.movePreviewDate && dragState.movePreviewRow !== null) {
    const draggedKey = `ticket:${dragState.moveDrag.ticketId}`
    const newStart = dragState.movePreviewDate
    const newEnd = options.hideWeekends
      ? addWorkingDays(newStart, dragState.moveDrag.span)
      : addDays(newStart, dragState.moveDrag.span)
    const pushed = cascadePush(items, {
      key: draggedKey,
      startDate: newStart,
      endDate: newEnd,
      row: dragState.movePreviewRow,
    })
    // Shrink in the preview so what the user sees mid-drag matches what
    // they'll get on release. Without this, a downward drag briefly shows
    // an empty row at the top (cascade pushed everything down, hasn't
    // compacted yet).
    return shrinkRows(pushed)
  }

  if (dragState.vacationMoveDrag && dragState.vacationMovePreviewDate && dragState.movePreviewRow !== null) {
    const draggedKey = `vacation:${dragState.vacationMoveDrag.vacationId}`
    const newStart = dragState.vacationMovePreviewDate
    const newEnd = options.hideWeekends
      ? addWorkingDays(newStart, dragState.vacationMoveDrag.span)
      : addDays(newStart, dragState.vacationMoveDrag.span)
    const pushed = cascadePush(items, {
      key: draggedKey,
      startDate: newStart,
      endDate: newEnd,
      row: dragState.movePreviewRow,
    })
    return shrinkRows(pushed)
  }

  // Sidebar new-vacation drag: not tied to an existing vacation id. We use
  // the sentinel key 'new-vacation' so the drop handler can fish out the
  // landed row from the cascaded preview.
  if (dragState.newVacationDrag && dragState.newVacationPreviewDate && dragState.movePreviewRow !== null) {
    const date = dragState.newVacationPreviewDate
    const pushed = cascadePush(items, {
      key: 'new-vacation',
      startDate: date,
      endDate: date,
      row: dragState.movePreviewRow,
    })
    return shrinkRows(pushed)
  }

  // Ticket or vacation resize: the dragged item's `items` entry already has
  // the previewed dates (effectivePlacement/effectiveVacation applies them),
  // so cascadePush at its same row pushes anything the new footprint overlaps
  // and shrinkRows keeps the layout compact. Without this the resized pill
  // just renders on top of its neighbor.
  const resizedKey =
    dragState.resizeDrag ? `ticket:${dragState.resizeDrag.ticketId}` :
    dragState.vacationResizeDrag ? `vacation:${dragState.vacationResizeDrag.vacationId}` :
    null
  if (resizedKey) {
    const dragged = items.find((i) => i.key === resizedKey)
    if (dragged) {
      const pushed = cascadePush(items, dragged)
      return shrinkRows(pushed)
    }
  }

  return items
})

function daySlots(day: number): UnifiedSlot[] {
  const thisDate = calDate(day)
  const slots: UnifiedSlot[] = []
  const col = colPos(day)

  function setSlot(row: number, slot: UnifiedSlot) {
    while (slots.length <= row) slots.push(null)
    slots[row] = slot
  }

  // Pre-build a vacations-by-date check so we can flag tickets visually on vacation days.
  const monthVacations = vacationsStore.getVacationsForMonth(props.year, props.month)

  for (const item of previewItems.value) {
    if (compareCalendarDates(item.startDate, thisDate) > 0) continue
    if (compareCalendarDates(thisDate, item.endDate) > 0) continue

    if (item.key.startsWith('ticket:')) {
      const ticketId = Number(item.key.slice('ticket:'.length))
      const ticket = ticketsStore.tickets.find((t) => t.id === ticketId)
      if (!ticket) continue

      const isStart = compareCalendarDates(item.startDate, thisDate) === 0
      const isEnd = compareCalendarDates(item.endDate, thisDate) === 0
      const isPreview =
        dragState.moveDrag?.ticketId === ticketId ||
        dragState.resizeDrag?.ticketId === ticketId

      const isOnVacation = !ticket.isLabel && ticket.assignedTo !== null &&
        monthVacations.some(
          (v) => v.personId === ticket.assignedTo &&
            compareCalendarDates(v.startDate!, thisDate) <= 0 &&
            compareCalendarDates(thisDate, v.endDate!) <= 0
        )

      const spanTotal = Math.max(1, workingDaysBetween(item.startDate, item.endDate) + 1)
      const spanIndex = workingDaysBetween(item.startDate, thisDate)

      setSlot(item.row, {
        kind: 'ticket',
        info: {
          ticket,
          placement: { ticketId, startDate: item.startDate, endDate: item.endDate, row: item.row },
          isStart,
          isEnd,
          isRowEnd: !isEnd && (col === columnCount.value - 1 || day === lastVisibleDay.value),
          isRowStart: !isStart && (col === 0 || day === firstVisibleDay.value),
          isPreview,
          isOnVacation,
          spanIndex,
          spanTotal,
        },
      })
    } else if (item.key.startsWith('vacation:')) {
      const vacationId = Number(item.key.slice('vacation:'.length))
      const entry = vacationsStore.entries.find((e) => e.id === vacationId)
      if (!entry) continue
      const person = peopleStore.people.find((p) => p.id === entry.personId)
      const isStart = compareCalendarDates(item.startDate, thisDate) === 0
      const isEnd = compareCalendarDates(item.endDate, thisDate) === 0

      // Does the same person have any ticket on this day? If so, both pills
      // render with the conflict highlight.
      const isConflict = ticketsStore.placements.some((p) => {
        const t = ticketsStore.tickets.find((x) => x.id === p.ticketId)
        if (!t || t.isLabel || t.assignedTo !== entry.personId) return false
        // thisDate is in [p.startDate, p.endDate] — both inclusive.
        return compareCalendarDates(p.startDate, thisDate) <= 0 &&
               compareCalendarDates(thisDate, p.endDate) <= 0
      })

      setSlot(item.row, {
        kind: 'vacation',
        info: {
          vacationId,
          personId: entry.personId,
          color: person?.color ?? '#aaa',
          personName: person?.name ?? '',
          startDate: item.startDate,
          endDate: item.endDate,
          isStart,
          isEnd,
          isRowStart: !isStart && (col === 0 || day === firstVisibleDay.value),
          isRowEnd: !isEnd && (col === columnCount.value - 1 || day === lastVisibleDay.value),
          isPreview: dragState.vacationMoveDrag?.vacationId === vacationId || dragState.vacationResizeDrag?.vacationId === vacationId,
          isConflict,
        },
      })
    }
  }

  // Trim trailing empties so a cell's natural height matches its tallest occupant.
  // We'll pad back to the week's effectiveRowCount in effectiveDaySlots().
  while (slots.length > 0 && slots[slots.length - 1] === null) slots.pop()
  return slots
}

// Apply a cascaded layout back to the stores. Walks each item in the new
// layout, finds its matching ticket placement or vacation entry, and writes
// the new (startDate, endDate, row) if any of them changed. Used at drop
// time to materialize the preview.
function commitLayout(layout: CascadeItem[]) {
  for (const item of layout) {
    if (item.key.startsWith('ticket:')) {
      const id = Number(item.key.slice('ticket:'.length))
      const existing = ticketsStore.placements.find((p) => p.ticketId === id)
      if (!existing) {
        // New placement — sidebar drag landed here. placeTicket creates the
        // single-day placement; if the dragged span covers multiple days
        // moveTicket extends it to the cascaded end date.
        ticketsStore.placeTicket(id, item.startDate, item.row)
        if (compareCalendarDates(item.startDate, item.endDate) !== 0) {
          ticketsStore.moveTicket(id, item.startDate, item.endDate, item.row)
        }
        continue
      }
      const dateChanged =
        compareCalendarDates(existing.startDate, item.startDate) !== 0 ||
        compareCalendarDates(existing.endDate, item.endDate) !== 0
      if (dateChanged || existing.row !== item.row) {
        ticketsStore.moveTicket(id, item.startDate, item.endDate, item.row)
      }
    } else if (item.key.startsWith('vacation:')) {
      const id = Number(item.key.slice('vacation:'.length))
      const existing = vacationsStore.entries.find((e) => e.id === id)
      if (!existing || existing.startDate === null || existing.endDate === null) continue
      const dateChanged =
        compareCalendarDates(existing.startDate, item.startDate) !== 0 ||
        compareCalendarDates(existing.endDate, item.endDate) !== 0
      if (dateChanged || existing.row !== item.row) {
        vacationsStore.placeVacation(id, item.startDate, item.endDate, item.row)
      }
    }
    // 'new-vacation' items are intentionally skipped here — the drop handler
    // creates the real vacation first, then commits a re-keyed layout.
  }
}

// Drag handlers come from useCalendarDrag. Has to be wired AFTER commitLayout
// and previewItems (the composable needs them) and BEFORE dragOverWeek + the
// freeze-row watchers below (those depend on dragOverDay).
const {
  dragOverDay,
  onDragOver,
  onDragLeave,
  onDrop,
  onHandleDragStart,
  onVacationHandleDragStart,
  onVacationDragStart,
  onTicketDragStart,
} = useCalendarDrag({
  calDate,
  visibleDays,
  dayRowIndex,
  previewItems,
  commitLayout,
  isTicketVisible,
  ticketTooltip,
})

// Per the spec, a week's effective row count = (max stored row of any placement
// that touches this week) + 1. Anchored multi-week pills count even on days they
// don't visually occupy in this week — they hold their row open as a phantom row
// the user can drop into.
const rawEffectiveRowCountPerWeek = computed<Record<number, number>>(() => {
  const result: Record<number, number> = {}
  for (let i = 0; i < visibleDays.value.length; i++) {
    const day = visibleDays.value[i]!
    const week = dayRowIndex(i)
    const maxRow = daySlots(day).length // already 1-past-last-used-row
    if (maxRow > (result[week] ?? 0)) result[week] = maxRow
  }
  return result
})

// During a drag, the week the cursor is currently over must only GROW in
// height — never shrink. If a cascade push briefly makes that week shorter
// and then taller again, cells resize underneath the cursor, the cursor's
// Y → row mapping changes, the cascade re-resolves, and we get visual
// jitter. Freezing the hovered week's row count for the duration of the
// hover stabilizes the layout there.
//
// Other weeks (where the cursor isn't) are NOT frozen — they shrink back
// to their natural height as soon as the cascade no longer needs the extra
// row. So if a multi-week pill briefly pushed a neighbor and the user
// moved on, those distant cells settle back immediately, not at drag-end.
const frozenDragWeek = ref<number | null>(null)
const frozenDragWeekRowCount = ref<number>(0)
const isDragging = computed(
  () => dragState.moveDrag !== null ||
    dragState.vacationMoveDrag !== null ||
    dragState.resizeDrag !== null ||
    dragState.vacationResizeDrag !== null ||
    dragState.newVacationDrag !== null,
)
const dragOverWeek = computed<number | null>(() => {
  if (dragOverDay.value === null) return null
  const idx = visibleDays.value.indexOf(dragOverDay.value)
  return idx === -1 ? null : dayRowIndex(idx)
})
// When the cursor enters a new week (or none), reset the freeze so the
// previously-hovered week can shrink back to its natural row count.
watch(dragOverWeek, (newWeek) => {
  if (!isDragging.value) return
  frozenDragWeek.value = newWeek
  frozenDragWeekRowCount.value = newWeek !== null
    ? rawEffectiveRowCountPerWeek.value[newWeek] ?? 0
    : 0
})
// Grow the freeze as the hovered week's raw row count grows (cascade pushing).
watch(rawEffectiveRowCountPerWeek, (current) => {
  if (!isDragging.value || frozenDragWeek.value === null) return
  const val = current[frozenDragWeek.value] ?? 0
  if (val > frozenDragWeekRowCount.value) frozenDragWeekRowCount.value = val
})
watch(isDragging, (dragging) => {
  if (!dragging) {
    frozenDragWeek.value = null
    frozenDragWeekRowCount.value = 0
  }
})

function effectiveRowCount(weekIdx: number): number {
  const raw = rawEffectiveRowCountPerWeek.value[weekIdx] ?? 0
  if (frozenDragWeek.value !== weekIdx) return raw
  return Math.max(raw, frozenDragWeekRowCount.value)
}

function effectiveDaySlots(day: number, weekIdx: number): UnifiedSlot[] {
  const slots = daySlots(day)
  const target = effectiveRowCount(weekIdx)
  while (slots.length < target) slots.push(null)
  return slots
}


function ticketSegmentBg(ticket: Ticket, spanIndex: number, spanTotal: number): string {
  return segmentGradient(ticketColor(ticket), spanIndex, spanTotal)
}


</script>

<template>
  <div class="month-calendar">
    <h2><span class="month-name shine-text">{{ monthName }}</span> <sup class="year-sup">{{ year }}</sup></h2>
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${columnCount}, minmax(125px, 1fr))` }">
      <div v-for="header in dayHeaders" :key="header" class="cell header">{{ header }}</div>
      <div v-for="n in startOffset" :key="`empty-${n}`" class="cell" />
      <div
        v-for="(day, dayIdx) in visibleDays"
        :key="day"
        class="cell day"
        :class="{
          'drag-over': dragOverDay === day,
          'is-holiday': holidayMap.has(day),
          'is-today': isToday(day),
        }"
        @dragover="onDragOver($event, day)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, day)"
      >
        <div class="day-header">
          <div class="day-number-wrap">
            <span
              class="day-number"
              :class="{ 'today-flash': isToday(day) && props.flashToday }"
            >{{ day }}</span>
          </div>
          <span v-if="holidayMap.has(day)" class="holiday-label">{{ holidayMap.get(day) }}</span>
        </div>
        <div class="placed-tickets" :class="{ 'no-pointer': isScrolling }">
          <template v-for="(slot, slotIdx) in effectiveDaySlots(day, dayRowIndex(dayIdx))" :key="slotIdx">
            <div v-if="slot && slot.kind === 'ticket'" class="slot-row">
              <div class="pill-slot">
                <div
                  v-if="slot.info.isStart"
                  class="pill-marker s-marker"
                  :class="{ 'is-visible': dragState.hoveredTicketId === slot.info.ticket.id }"
                >S</div>
                <div
                  class="ticket-pill"
                  :data-ticket-id="slot.info.ticket.id"
                  :class="{
                    'is-start': slot.info.isStart,
                    'is-end': slot.info.isEnd,
                    'is-preview': slot.info.isPreview,
                    'row-end': slot.info.isRowEnd,
                    'row-start': slot.info.isRowStart,
                    'is-on-vacation': slot.info.isOnVacation,
                    'is-hovered': dragState.hoveredTicketId === slot.info.ticket.id,
                    'is-dimmed': (dragState.hoveredTicketId !== null && dragState.hoveredTicketId !== slot.info.ticket.id) || dragState.hoveredVacationId !== null,
                    'is-event': slot.info.ticket.isLabel,
                  }"
                  :style="{ '--tc': ticketColor(slot.info.ticket), background: ticketSegmentBg(slot.info.ticket, slot.info.spanIndex, slot.info.spanTotal) }"
                  draggable="true"
                  tabindex="0"
                  role="button"
                  :aria-label="slot.info.ticket.isLabel ? `${slot.info.ticket.title || 'Event'} — edit` : `${slot.info.ticket.number} ${slot.info.ticket.title} — edit`"
                  @mouseenter="showTicketTooltip($event, slot.info)"
                  @mouseleave="hideTicketTooltip()"
                  @focus="showTicketTooltip($event, slot.info)"
                  @blur="hideTicketTooltip()"
                  @click.stop="slot.info.ticket.isLabel ? emit('editLabel', slot.info.ticket) : emit('editTicket', slot.info.ticket)"
                  @keydown.enter.stop="slot.info.ticket.isLabel ? emit('editLabel', slot.info.ticket) : emit('editTicket', slot.info.ticket)"
                  @keydown.space.prevent.stop="slot.info.ticket.isLabel ? emit('editLabel', slot.info.ticket) : emit('editTicket', slot.info.ticket)"
                  @dragstart="onTicketDragStart($event, slot.info)"
                  @dragend="dragState.clearMoveDrag"
                >
                  <button
                    v-if="slot.info.isStart"
                    class="resize-handle"
                    draggable="true"
                    aria-label="Drag to change start date"
                    @click.stop
                    @dragstart="onHandleDragStart($event, slot.info.ticket.id, 'start')"
                    @dragend="dragState.clearResizeDrag"
                  >‹</button>
                  <span v-if="slot.info.isStart || slot.info.isRowStart" class="ticket-label">{{ slot.info.ticket.isLabel ? slot.info.ticket.title : slot.info.ticket.number }}</span>
                  <button
                    v-if="slot.info.isEnd"
                    class="resize-handle right-handle"
                    draggable="true"
                    aria-label="Drag to change end date"
                    @dragstart="onHandleDragStart($event, slot.info.ticket.id, 'end')"
                    @dragend="dragState.clearResizeDrag"
                  >›</button>
                </div>
                <div
                  v-if="slot.info.isEnd"
                  class="pill-marker f-marker"
                  :class="{ 'is-visible': dragState.hoveredTicketId === slot.info.ticket.id }"
                >F</div>
              </div>
            </div>
            <div v-else-if="slot && slot.kind === 'vacation'" class="slot-row">
              <div class="pill-slot">
                <div
                  v-if="slot.info.isStart"
                  class="pill-marker s-marker"
                  :class="{ 'is-visible': dragState.hoveredVacationId === slot.info.vacationId }"
                >S</div>
                <div
                  class="vacation-pill"
                  :class="{
                    'is-start': slot.info.isStart,
                    'is-end': slot.info.isEnd,
                    'row-end': slot.info.isRowEnd,
                    'row-start': slot.info.isRowStart,
                    'is-preview': slot.info.isPreview,
                    'is-conflict': slot.info.isConflict,
                    'is-hovered': dragState.hoveredVacationId === slot.info.vacationId,
                    'is-dimmed': (dragState.hoveredVacationId !== null && dragState.hoveredVacationId !== slot.info.vacationId) || (dragState.hoveredTicketId !== null),
                  }"
                  draggable="true"
                  tabindex="0"
                  role="button"
                  :aria-label="`${slot.info.personName} vacation — edit`"
                  @mouseenter="setVacationHover(slot.info.vacationId)"
                  @mouseleave="setVacationHover(null)"
                  @focus="setVacationHover(slot.info.vacationId)"
                  @blur="setVacationHover(null)"
                  @click.stop="emit('editVacation', slot.info.vacationId)"
                  @keydown.enter.stop="emit('editVacation', slot.info.vacationId)"
                  @keydown.space.prevent.stop="emit('editVacation', slot.info.vacationId)"
                  @dragstart="onVacationDragStart($event, slot.info)"
                  @dragend="dragState.clearVacationMoveDrag()"
                >
                  <button
                    v-if="slot.info.isStart"
                    class="resize-handle"
                    draggable="true"
                    aria-label="Drag to change vacation start date"
                    @click.stop
                    @dragstart="onVacationHandleDragStart($event, slot.info.vacationId, 'start')"
                    @dragend="dragState.clearVacationResizeDrag()"
                  >‹</button>
                  <span v-if="slot.info.isStart || slot.info.isRowStart" class="vacation-label">{{ slot.info.personName }} Vacation</span>
                  <button
                    v-if="slot.info.isEnd"
                    class="resize-handle right-handle"
                    draggable="true"
                    aria-label="Drag to change vacation end date"
                    @click.stop
                    @dragstart="onVacationHandleDragStart($event, slot.info.vacationId, 'end')"
                    @dragend="dragState.clearVacationResizeDrag()"
                  >›</button>
                </div>
                <div
                  v-if="slot.info.isEnd"
                  class="pill-marker f-marker"
                  :class="{ 'is-visible': dragState.hoveredVacationId === slot.info.vacationId }"
                >F</div>
              </div>
            </div>
            <div v-else class="slot-row">
              <div class="slot-spacer" />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <Transition name="tooltip">
      <div
        v-if="ticketTooltip && !dragState.moveDrag && !dragState.resizeDrag"
        class="global-tooltip"
        :style="{ '--tx': ticketTooltip.x + 'px', '--ty': ticketTooltip.y + 'px' }"
      >
        <div v-if="ticketTooltip.title" class="tooltip-title">{{ ticketTooltip.title }}</div>
        <div class="tooltip-row"><span class="tooltip-label">{{ ticketTooltip.duration === 1 ? 'Date' : 'Dates' }}</span><span>{{ ticketTooltip.duration === 1 ? fmtShortDate(ticketTooltip.startDate) : `${fmtShortDate(ticketTooltip.startDate)} – ${fmtShortDate(ticketTooltip.endDate)}` }}</span></div>
        <div v-if="ticketTooltip.duration !== 1" class="tooltip-row"><span class="tooltip-label">Duration</span><span>{{ ticketTooltip.duration }} days</span></div>
        <div v-if="ticketTooltip.assignedTo !== null" class="tooltip-row"><span class="tooltip-label">Assigned to</span><span>{{ ticketTooltip.assignedTo }}</span></div>
      </div>
    </Transition>
  </Teleport>

</template>

<style scoped>
.month-calendar {
  border-radius: 12px;
  margin: 0 0 1rem;
  flex-shrink: 0;
}

h2 {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  padding: 1.1rem 0 0.85rem;
}

.month-name {
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
}

.year-sup {
  font-size: 15.6px;
  font-weight: 300;
  vertical-align: baseline;
  opacity: 0.6;
  letter-spacing: 0.02em;
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.07);
}

.grid {
  display: grid;
  gap: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.cell {
  padding: 0.25rem 0;
  font-size: 0.85rem;
  min-height: 125px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow: visible;
}

.cell:not(.day):not(.header) {
  position: relative;
}

.cell:not(.day):not(.header)::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.header {
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5);
  min-height: unset;
  padding: 0.5rem 0.25rem;
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.07);
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E"),
    linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, transparent 200%);
}

.day {
  display: grid;
  grid-template-rows: 4rem 1fr;
  overflow: visible;
  background: rgba(0, 0, 0, 0.1);
}

.day.drag-over {
  background: rgba(255, 255, 255, 0.06);
}

.day-header {
  display: flex;
  flex-direction: column;
  padding: 0.4rem 0 0 0.4rem;
  overflow: hidden;
}

.day-number-wrap {
  position: relative;
  display: inline-flex;
  align-self: flex-start;
}

.day-number {
  border-radius: 50%;
  width: 1.7rem;
  height: 1.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.82rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
}

.day.is-today .day-number {
  position: relative;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
}

/* Gradient ring around today, matching the darker S/F marker gradient and
   animating via the same textShine keyframe. mask-composite punches a hole
   in the center so only the border ring shows the gradient. */
.day.is-today .day-number::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  padding: 2px;
  background: var(--shine-gradient-dark);
  background-size: 500% auto;
  animation: textShine var(--shine-duration) ease-in-out infinite alternate;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
}



.day.is-holiday {
  background: linear-gradient(to top left, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
}

.holiday-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 500;
  padding: 0 0.3rem 0.35rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  filter: grayscale(1);
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.07);
}

.placed-tickets {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-top: 0.3rem;
}

.placed-tickets.no-pointer {
  pointer-events: none;
}

.slot-row {
  height: 1.4rem;
}

.slot-spacer {
  height: 100%;
}

.vacation-pill {
  display: flex;
  align-items: center;
  height: 100%;
  border-radius: 0;
  cursor: grab;
  opacity: 0.9;
  background: repeating-linear-gradient(45deg, #2a2a2a 0px, #2a2a2a 3px, #323232 3px, #323232 9px);
  min-height: 1.1rem;
  line-height: 1;
  position: relative;
  overflow: hidden;
  transition: opacity 0.2s ease, filter 0.2s ease;
}


.vacation-pill.is-preview {
  opacity: 0.75;
}

.vacation-pill.is-hovered {
  opacity: 1;
  filter: brightness(1.1);
}

.vacation-pill.is-dimmed {
  opacity: 0.25;
}

.vacation-pill:not(.is-start):not(.row-start) {
  margin-left: -1px;
  width: calc(100% + 1px);
}

.vacation-pill.is-end:not(.is-start):not(.row-start) {
  width: calc(100% - 0.25rem + 1px);
}

.vacation-pill.row-end {
  z-index: 1;
}


.vacation-pill.row-start {
  z-index: 2;
}


.vacation-pill.is-start {
  border-radius: 999px 0 0 999px;
  margin-left: 0.25rem;
}

.vacation-pill.is-end {
  border-radius: 0 999px 999px 0;
  margin-right: 0.25rem;
}

.vacation-pill.is-start.is-end {
  border-radius: 999px;
}

.vacation-pill.is-start .vacation-label,
.vacation-pill.row-start .vacation-label {
  padding-left: 0.6rem;
}

.vacation-label {
  padding: 0 0.3rem;
  font-size: 0.72rem;
  font-weight: bold;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.pill-slot {
  position: relative;
  height: 100%;
}

.pill-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--shine-gradient-dark);
  background-size: 500% auto;
  animation: textShine var(--shine-duration) ease-in-out infinite alternate;
  border: 2px solid rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 0;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: transform 0.1s ease-in, opacity 0s;
}

.s-marker {
  right: calc(100% + 2px);
  transform: translateX(calc(100% + 2px));
}

.f-marker {
  left: calc(100% + 2px);
  transform: translateX(calc(-100% - 2px));
}

.pill-marker.is-visible {
  opacity: 1;
  transform: translateX(0);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0s;
}

.ticket-pill {
  display: flex;
  align-items: center;
  height: 100%;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
  color: #fff;
  overflow: visible;
  position: relative;
  z-index: 1;
  border-radius: 0;
  padding: 0.1rem 0;
  cursor: grab;
  transition: opacity 0.2s ease;
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.07);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

.ticket-pill::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--tc);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

.ticket-pill.is-hovered::before {
  opacity: 0.35;
}

.ticket-pill.is-event::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    45deg,
    rgba(0, 0, 0, 0.12) 0px,
    rgba(0, 0, 0, 0.12) 3px,
    transparent 3px,
    transparent 9px
  );
  pointer-events: none;
  z-index: 0;
}

.ticket-pill.is-dimmed {
  opacity: 0.25;
}

/* Conflict highlight: ticket pill is on the same day as a vacation for the
   same person (and vice versa). Solid red overlay with opacity on just the
   segment that overlaps — so a Mon–Fri ticket with a vacation only on Wed
   shows red only on its Wed slice, not the whole pill. */
.ticket-pill.is-on-vacation,
.vacation-pill.is-conflict {
  position: relative;
}
.ticket-pill.is-on-vacation::after,
.vacation-pill.is-conflict::after {
  content: '';
  position: absolute;
  inset: 0;
  /* Just the error icon, centered. drop-shadow filter tracks the icon's
     actual shape (background is transparent everywhere else) so the badge
     reads as floating above the pill underneath. z-index lifts it above
     the pill's title text so a long title can't slide under it. */
  background: url("../assets/icons/error.svg") no-repeat center / 20px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
  pointer-events: none;
  border-radius: inherit;
  z-index: 1;
}


.ticket-pill:active {
  cursor: grabbing;
}

.ticket-pill:not(.is-start):not(.row-start) {
  margin-left: -1px;
  width: calc(100% + 1px);
}

.ticket-pill.is-start {
  border-radius: 999px 0 0 999px;
  padding-left: 0.1rem;
  margin-left: 0.25rem;
}

.ticket-pill.is-end {
  border-radius: 0 999px 999px 0;
  padding-right: 0.1rem;
  margin-right: 0.25rem;
}

.ticket-pill.is-end:not(.is-start):not(.row-start) {
  width: calc(100% - 0.25rem + 1px);
}

.ticket-pill.is-start.is-end {
  border-radius: 999px;
}

.ticket-pill.is-preview {
  opacity: 0.5;
}

:global(.tooltip-enter-active) {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

:global(.tooltip-leave-active) {
  transition: opacity 0.15s ease;
}

:global(.tooltip-enter-from.global-tooltip) {
  opacity: 0;
  transform: translate3d(var(--tx, 0), var(--ty, 0), 0) translate(-50%, calc(-100% + 8px));
}

:global(.tooltip-leave-to) {
  opacity: 0;
}

:global(.global-tooltip) {
  position: fixed;
  top: 0;
  left: 0;
  transform: translate3d(var(--tx, 0), var(--ty, 0), 0) translate(-50%, calc(-100% - 6px));
  transition: transform 0.3s cubic-bezier(0.1, 1, 0.2, 1);
  background: rgb(30, 30, 35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: normal;
  width: max-content;
  max-width: 260px;
  white-space: normal;
  text-align: left;
  line-height: 1.5;
  pointer-events: none;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

:global(.global-tooltip::after) {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgb(30, 30, 35);
}

:global(.global-tooltip .tooltip-title) {
  font-weight: 600;
  font-size: 0.75rem;
  color: #fff;
  margin-bottom: 0.2rem;
}

:global(.global-tooltip .tooltip-row) {
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
}

:global(.global-tooltip .tooltip-label) {
  opacity: 0.5;
  flex-shrink: 0;
  min-width: 4.5rem;
}


.ticket-label {
  flex: 1;
  padding: 0 0.3rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  position: relative;
  z-index: 1;
}


.ticket-pill.row-end {
  z-index: 1;
}


.ticket-pill.row-start .ticket-label {
  padding-left: 0.6rem;
}

.ticket-pill.row-start {
  z-index: 2;
}


.resize-handle {
  flex-shrink: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0 0.25rem;
  cursor: ew-resize;
  opacity: 0.7;
  position: relative;
  z-index: 1;
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.07);
}

.resize-handle:hover {
  opacity: 1;
}

.resize-handle::after {
  display: none;
}

.right-handle {
  margin-left: auto;
}
</style>
