<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTicketsStore, compareCalendarDates } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
import { useVacationsStore } from '../stores/vacations'
import { getCanadianHolidays, getAmericanHolidays } from '../utils/holidays'
import { snapToWeekday, workingDaysBetween, addWorkingDays } from '../utils/dates'
import { useUndoStack } from '../composables/useUndoStack'
import { useRejectionToast } from '../composables/useRejectionToast'
import { cascadePush, shrinkRows, type CascadeItem } from '../utils/cascade'
import type { Ticket, Placement, CalendarDate } from '../stores/tickets'
import EditTicketModal from './EditTicketModal.vue'
import AddLabelModal from './AddLabelModal.vue'

const props = defineProps<{
  year: number
  month: number
  flashToday?: boolean
}>()

const emit = defineEmits<{ editVacation: [vacationId: number] }>()

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_HEADERS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const monthName = computed(() => MONTH_NAMES[props.month])
const daysInMonth = computed(() => new Date(props.year, props.month + 1, 0).getDate())

const today = new Date()
const todayYear = today.getFullYear()
const todayMonth = today.getMonth()
const todayDay = today.getDate()
const isToday = (day: number) =>
  props.year === todayYear && props.month === todayMonth && day === todayDay

const ticketsStore = useTicketsStore()
const peopleStore = usePeopleStore()
const dragState = useDragStateStore()
const options = useOptionsStore()
const vacationsStore = useVacationsStore()
const undoStack = useUndoStack()

function isWeekend(day: number): boolean {
  const dow = new Date(props.year, props.month, day).getDay()
  return dow === 0 || dow === 6
}

const dayHeaders = computed(() => options.hideWeekends ? WEEKDAY_HEADERS_SHORT : WEEKDAY_HEADERS)
const columnCount = computed(() => options.hideWeekends ? 5 : 7)

const visibleDays = computed(() => {
  const days: number[] = []
  for (let d = 1; d <= daysInMonth.value; d++) {
    if (options.hideWeekends && isWeekend(d)) continue
    days.push(d)
  }
  return days
})

const startOffset = computed(() => {
  if (options.hideWeekends) {
    for (let d = 1; d <= daysInMonth.value; d++) {
      const dow = new Date(props.year, props.month, d).getDay()
      if (dow !== 0 && dow !== 6) return dow - 1 // Mon=0 … Fri=4
    }
    return 0
  }
  return new Date(props.year, props.month, 1).getDay()
})

// Maps each visible weekday number to its 0-based index among weekdays (used for colPos)
const weekdayIndexMap = computed(() => {
  if (!options.hideWeekends) return new Map<number, number>()
  const map = new Map<number, number>()
  let idx = 0
  for (let d = 1; d <= daysInMonth.value; d++) {
    const dow = new Date(props.year, props.month, d).getDay()
    if (dow !== 0 && dow !== 6) map.set(d, idx++)
  }
  return map
})

const firstVisibleDay = computed(() => visibleDays.value[0] ?? 1)
const lastVisibleDay = computed(() => visibleDays.value[visibleDays.value.length - 1] ?? daysInMonth.value)

const holidayMap = computed(() => {
  const map = new Map<number, string>()
  for (const h of getCanadianHolidays(props.year)) {
    if (h.date.month === props.month) map.set(h.date.day, `CA ${h.name}`)
  }
  for (const h of getAmericanHolidays(props.year)) {
    if (h.date.month === props.month) map.set(h.date.day, `US ${h.name}`)
  }
  return map
})

const dragOverDay = ref<number | null>(null)
const editingTicket = ref<Ticket | null>(null)
const editingLabel = ref<Ticket | null>(null)
const { showRejection } = useRejectionToast()

function handleEditSubmit(data: { number: string; title: string; assignedTo: number | null; link: string; startDate: CalendarDate | null; endDate: CalendarDate | null }) {
  if (!editingTicket.value) return
  const id = editingTicket.value.id

  if (data.assignedTo !== null && data.startDate) {
    const end = data.endDate ?? data.startDate
    const hasConflict = vacationsStore.entries.some((v) =>
      v.personId === data.assignedTo &&
      v.startDate !== null && v.endDate !== null &&
      compareCalendarDates(v.startDate, end) <= 0 &&
      compareCalendarDates(data.startDate!, v.endDate) <= 0
    )
    if (hasConflict) {
      const person = peopleStore.people.find((p) => p.id === data.assignedTo)
      showRejection(`Can't assign to ${person?.name ?? 'this person'} — they're on vacation during those dates.`)
      return
    }
  }

  ticketsStore.updateTicket(id, { number: data.number, title: data.title, assignedTo: data.assignedTo, link: data.link })
  if (data.startDate && data.endDate) {
    ticketsStore.moveTicket(id, data.startDate, data.endDate)
  } else {
    ticketsStore.removePlacement(id)
  }
  editingTicket.value = null
}

function handleDeleteTicket() {
  if (editingTicket.value) ticketsStore.deleteTicket(editingTicket.value.id)
  editingTicket.value = null
}

function calDate(day: number): CalendarDate {
  return { year: props.year, month: props.month, day }
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(date.year, date.month, date.day)
  d.setDate(d.getDate() + days)
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
}

function spanInDays(start: CalendarDate, end: CalendarDate): number {
  return Math.round(
    (new Date(end.year, end.month, end.day).getTime() -
      new Date(start.year, start.month, start.day).getTime()) /
      86_400_000,
  )
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(d: { year: number; month: number; day: number }): string {
  return `${MONTH_SHORT[d.month]} ${d.day}`
}

function assignedName(ticket: Ticket): string {
  if (ticket.assignedTo === null) return 'Unassigned'
  return peopleStore.people.find((p) => p.id === ticket.assignedTo)?.name ?? 'Unassigned'
}

function durationDays(start: CalendarDate, end: CalendarDate, personId?: number | null): number {
  let count = 0
  const d = new Date(start.year, start.month, start.day)
  const endDate = new Date(end.year, end.month, end.day)
  while (d <= endDate) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      if (personId != null) {
        const cd: CalendarDate = { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
        const onVacation = vacationsStore.entries.some(
          (v) => v.personId === personId &&
            v.startDate !== null && v.endDate !== null &&
            compareCalendarDates(v.startDate, cd) <= 0 &&
            compareCalendarDates(cd, v.endDate) <= 0
        )
        if (!onVacation) count++
      } else {
        count++
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return count
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
  if (ticket.isLabel) return ticket.labelColor ?? '#607d8b'
  if (ticket.assignedTo === null) return '#555555'
  return peopleStore.people.find((p) => p.id === ticket.assignedTo)?.color ?? '#555555'
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

function colPos(day: number): number {
  if (options.hideWeekends) {
    const idx = weekdayIndexMap.value.get(day) ?? 0
    return (startOffset.value + idx) % columnCount.value
  }
  return (startOffset.value + day - 1) % columnCount.value
}

function dayRowIndex(visibleDayIndex: number): number {
  return Math.floor((startOffset.value + visibleDayIndex) / columnCount.value)
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
  const hex = ticketColor(ticket)
  let h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3) h = h[0]! + h[0] + h[1]! + h[1] + h[2]! + h[2]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const p0 = spanIndex / spanTotal
  const p1 = Math.min(1, (spanIndex + 1) / spanTotal)
  const shade = (p: number) => {
    const d = 1 - p * 0.4
    return `rgba(${Math.round(r * d)}, ${Math.round(g * d)}, ${Math.round(b * d)}, 0.75)`
  }
  return `linear-gradient(to right, ${shade(p0)}, ${shade(p1)})`
}


// Translate cursor Y inside a day cell into a row index. Slots are 1.4rem tall
// with a 0.2rem gap (1.6rem stride) and the placed-tickets container has 0.3rem
// top padding — same constants the renderer uses.
//
// Sticky origin: while the cursor stays within the dragged item's original row
// (vertically), keep that row — don't move yet. Otherwise Math.round snaps to
// the nearest row center, so dragging past the visual midpoint of another pill
// jumps past it (Trello-style "insert below" rather than always pushing).
function rowFromY(cellEl: HTMLElement, clientY: number, originRow: number): number {
  const placed = cellEl.querySelector('.placed-tickets') as HTMLElement | null
  if (!placed) return 0
  const rect = placed.getBoundingClientRect()
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const slotHeight = 1.6 * rootFontSize
  const paddingTop = 0.3 * rootFontSize
  const y = clientY - rect.top - paddingTop
  const raw = y / slotHeight
  // Sticky: cursor still inside the origin row's vertical band → stay.
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
        // apply sticky-origin — cursor inside that row's vertical band keeps
        // the row unchanged, no premature push. New items (sidebar drags)
        // have no origin row; use 0 so the first row of every week becomes
        // the natural landing target.
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
  event.dataTransfer?.setData('resizeHandle', `${side}:${ticketId}`)
  dragState.startResizeDrag(ticketId, side)
  ticketTooltip.value = null
  dragState.hoveredTicketId = null
}

function onVacationHandleDragStart(event: DragEvent, vacationId: number, side: 'start' | 'end') {
  event.stopPropagation()
  event.dataTransfer?.setData('vacationResizeHandle', `${side}:${vacationId}`)
  dragState.startVacationResizeDrag(vacationId, side)
}

function onVacationDragStart(event: DragEvent, info: DayVacationInfo) {
  event.dataTransfer?.setData('moveCalendarVacation', String(info.vacationId))
  const span = options.hideWeekends
    ? workingDaysBetween(info.startDate, info.endDate)
    : spanInDays(info.startDate, info.endDate)
  dragState.startVacationMoveDrag(info.vacationId, span)
}

function onTicketDragStart(event: DragEvent, info: DayTicketInfo) {
  event.dataTransfer?.setData('moveCalendarTicket', String(info.ticket.id))
  const span = options.hideWeekends
    ? workingDaysBetween(info.placement.startDate, info.placement.endDate)
    : spanInDays(info.placement.startDate, info.placement.endDate)
  dragState.startMoveDrag(info.ticket.id, span)
  ticketTooltip.value = null
  dragState.hoveredTicketId = null
}

function onDrop(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = null

  const resizeHandle = event.dataTransfer?.getData('resizeHandle')
  if (resizeHandle) {
    // Commit the cascaded preview so a resize that overlaps a neighbor pushes
    // it down instead of rendering on top. Snapshot for undo since the cascade
    // can move several placements.
    const ticketSnapshot = ticketsStore.placements.map((p) => ({ ...p }))
    const vacationSnapshot = vacationsStore.entries.map((v) => ({ ...v }))

    commitLayout(previewItems.value)

    undoStack.push(() => {
      for (const snap of ticketSnapshot) {
        ticketsStore.moveTicket(snap.ticketId, snap.startDate, snap.endDate, snap.row)
      }
      for (const snap of vacationSnapshot) {
        if (snap.startDate && snap.endDate) {
          vacationsStore.placeVacation(snap.id, snap.startDate, snap.endDate, snap.row)
        }
      }
    })
    dragState.clearResizeDrag()
    return
  }

  const moveData = event.dataTransfer?.getData('moveCalendarTicket')
  if (moveData && dragState.moveDrag) {
    // Snapshot every ticket + vacation row before the cascade so we can fully
    // revert on undo (a cascade can move several placements, not just the
    // dragged one).
    const ticketSnapshot = ticketsStore.placements.map((p) => ({ ...p }))
    const vacationSnapshot = vacationsStore.entries.map((v) => ({ ...v }))

    // previewItems already contains the cascade-resolved layout for the
    // current hover position — commit it, then shrink so any rows left empty
    // by the move-out get compacted.
    commitLayout(previewItems.value)

    undoStack.push(() => {
      for (const snap of ticketSnapshot) {
        ticketsStore.moveTicket(snap.ticketId, snap.startDate, snap.endDate, snap.row)
      }
      for (const snap of vacationSnapshot) {
        if (snap.startDate && snap.endDate) {
          vacationsStore.placeVacation(snap.id, snap.startDate, snap.endDate, snap.row)
        }
      }
    })
    dragState.clearMoveDrag()
    return
  }

  const ticketId = event.dataTransfer?.getData('ticketId')
  if (ticketId) {
    // Sidebar ticket/label drag — commit the cascaded preview so cursor row
    // pick + push behave the same as a calendar-to-calendar drag. Snapshot
    // first so undo restores any pushed neighbors too.
    const ticketSnapshot = ticketsStore.placements.map((p) => ({ ...p }))
    const vacationSnapshot = vacationsStore.entries.map((v) => ({ ...v }))

    commitLayout(previewItems.value)

    undoStack.push(() => {
      ticketsStore.removePlacement(Number(ticketId))
      for (const snap of ticketSnapshot) {
        ticketsStore.moveTicket(snap.ticketId, snap.startDate, snap.endDate, snap.row)
      }
      for (const snap of vacationSnapshot) {
        if (snap.startDate && snap.endDate) {
          vacationsStore.placeVacation(snap.id, snap.startDate, snap.endDate, snap.row)
        }
      }
    })
    dragState.clearMoveDrag()
    return
  }

  const vacationResizeHandle = event.dataTransfer?.getData('vacationResizeHandle')
  if (vacationResizeHandle) {
    const ticketSnapshot = ticketsStore.placements.map((p) => ({ ...p }))
    const vacationSnapshot = vacationsStore.entries.map((v) => ({ ...v }))

    commitLayout(previewItems.value)

    undoStack.push(() => {
      for (const snap of ticketSnapshot) {
        ticketsStore.moveTicket(snap.ticketId, snap.startDate, snap.endDate, snap.row)
      }
      for (const snap of vacationSnapshot) {
        if (snap.startDate && snap.endDate) {
          vacationsStore.placeVacation(snap.id, snap.startDate, snap.endDate, snap.row)
        }
      }
    })
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
    const ticketSnapshot = ticketsStore.placements.map((p) => ({ ...p }))
    const vacationSnapshot = vacationsStore.entries.map((v) => ({ ...v }))

    // Pull the cascaded layout the user is seeing right now. The new vacation
    // appears under the sentinel key 'new-vacation'; re-key it to the real id
    // before commitLayout so the row + cascade actually applies.
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
      for (const snap of ticketSnapshot) {
        ticketsStore.moveTicket(snap.ticketId, snap.startDate, snap.endDate, snap.row)
      }
      for (const snap of vacationSnapshot) {
        if (snap.startDate && snap.endDate) {
          vacationsStore.placeVacation(snap.id, snap.startDate, snap.endDate, snap.row)
        }
      }
    })
    dragState.clearNewVacationDrag()
    return
  }

  const moveVacationData = event.dataTransfer?.getData('moveCalendarVacation')
  if (moveVacationData && dragState.vacationMoveDrag) {
    const ticketSnapshot = ticketsStore.placements.map((p) => ({ ...p }))
    const vacationSnapshot = vacationsStore.entries.map((v) => ({ ...v }))

    commitLayout(previewItems.value)

    undoStack.push(() => {
      for (const snap of ticketSnapshot) {
        ticketsStore.moveTicket(snap.ticketId, snap.startDate, snap.endDate, snap.row)
      }
      for (const snap of vacationSnapshot) {
        if (snap.startDate && snap.endDate) {
          vacationsStore.placeVacation(snap.id, snap.startDate, snap.endDate, snap.row)
        }
      }
    })
    dragState.clearVacationMoveDrag()
  }
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
                  @click.stop="slot.info.ticket.isLabel ? (editingLabel = slot.info.ticket) : (editingTicket = slot.info.ticket)"
                  @keydown.enter.stop="slot.info.ticket.isLabel ? (editingLabel = slot.info.ticket) : (editingTicket = slot.info.ticket)"
                  @keydown.space.prevent.stop="slot.info.ticket.isLabel ? (editingLabel = slot.info.ticket) : (editingTicket = slot.info.ticket)"
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

  <Transition name="modal">
    <EditTicketModal
      v-if="editingTicket"
      :ticket="editingTicket"
      :people="peopleStore.people"
      :placement="ticketsStore.placements.find((p) => p.ticketId === editingTicket!.id) ?? null"
      @submit="handleEditSubmit"
      @delete="handleDeleteTicket"
      @cancel="editingTicket = null"
    />
  </Transition>

  <Transition name="modal">
    <AddLabelModal
      v-if="editingLabel"
      :existing="editingLabel"
      @save="(text, color) => { ticketsStore.updateTicket(editingLabel!.id, { title: text, labelColor: color }); editingLabel = null }"
      @delete="() => { ticketsStore.deleteTicket(editingLabel!.id); editingLabel = null }"
      @cancel="editingLabel = null"
    />
  </Transition>

  <Teleport to="body">
    <Transition name="tooltip">
      <div
        v-if="ticketTooltip && !dragState.moveDrag && !dragState.resizeDrag"
        class="global-tooltip"
        :style="{ '--tx': ticketTooltip.x + 'px', '--ty': ticketTooltip.y + 'px' }"
      >
        <div v-if="ticketTooltip.title" class="tooltip-title">{{ ticketTooltip.title }}</div>
        <div class="tooltip-row"><span class="tooltip-label">{{ ticketTooltip.duration === 1 ? 'Date' : 'Dates' }}</span><span>{{ ticketTooltip.duration === 1 ? fmtDate(ticketTooltip.startDate) : `${fmtDate(ticketTooltip.startDate)} – ${fmtDate(ticketTooltip.endDate)}` }}</span></div>
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

.ticket-pill.is-hovered:not(.is-on-vacation)::before {
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
  /* Red base with dark diagonal stripes running top-right → bottom-left
     (opposite the 45deg `\\` stripes on vacation pills, so a conflicted
     vacation reads as a crosshatch and stands out from the surrounding
     vacation hatching). */
  background:
    repeating-linear-gradient(
      -45deg,
      transparent 0,
      transparent 4px,
      rgba(0, 0, 0, 0.4) 4px,
      rgba(0, 0, 0, 0.4) 7px
    ),
    rgba(220, 38, 38, 0.5);
  pointer-events: none;
  border-radius: inherit;
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
