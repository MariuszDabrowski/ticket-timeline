<script setup lang="ts">
import { ref, computed, watchEffect, onMounted, onUnmounted } from 'vue'
import { useTicketsStore, compareCalendarDates } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
import { useVacationsStore } from '../stores/vacations'
import { getCanadianHolidays, getAmericanHolidays } from '../utils/holidays'
import { snapToWeekday, workingDaysBetween, addWorkingDays } from '../utils/dates'
import type { Ticket, Placement, CalendarDate } from '../stores/tickets'
import EditTicketModal from './EditTicketModal.vue'
import AddLabelModal from './AddLabelModal.vue'

const props = defineProps<{
  year: number
  month: number
  flashToday?: boolean
}>()

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
const rejectedMessage = ref<string | null>(null)
let rejectedTimer: ReturnType<typeof setTimeout> | null = null

function showRejection(message: string) {
  rejectedMessage.value = message
  if (rejectedTimer) clearTimeout(rejectedTimer)
  rejectedTimer = setTimeout(() => { rejectedMessage.value = null }, 2500)
}

function hasTicketEndpointInRange(personId: number, start: CalendarDate, end: CalendarDate): boolean {
  return ticketsStore.placements.some((p) => {
    const ticket = ticketsStore.tickets.find((t) => t.id === p.ticketId)
    if (!ticket || ticket.isLabel || ticket.assignedTo !== personId) return false
    const startHit = compareCalendarDates(p.startDate, start) >= 0 && compareCalendarDates(p.startDate, end) <= 0
    const endHit = compareCalendarDates(p.endDate, start) >= 0 && compareCalendarDates(p.endDate, end) <= 0
    return startHit || endHit
  })
}

function handleEditSubmit(data: { number: string; title: string; assignedTo: number | null; link: string; startDate: CalendarDate | null; endDate: CalendarDate | null }) {
  if (!editingTicket.value) return
  const id = editingTicket.value.id
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
  assignedTo: string
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

function showTicketTooltip(e: MouseEvent, info: DayTicketInfo) {
  if (info.ticket.isLabel) return
  if (hideTooltipTimer) { clearTimeout(hideTooltipTimer); hideTooltipTimer = null }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dragState.hoveredTicketId = info.ticket.id
  ticketTooltip.value = {
    title: info.ticket.title || undefined,
    startDate: info.placement.startDate,
    endDate: info.placement.endDate,
    assignedTo: assignedName(info.ticket),
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

// Slot assignment based on effective placements so overlapping tickets drop to new slots during preview
const slotMap = computed(() => {
  const monthPlacements = ticketsStore
    .getPlacementsForMonth(props.year, props.month)
    .filter((p) => isTicketVisible(p.ticketId))
    .map((p) => ({ ticketId: p.ticketId, eff: effectivePlacement(p) }))
    .sort((a, b) => compareCalendarDates(a.eff.startDate, b.eff.startDate))

  const map = new Map<number, number>()
  const slotEndDates: CalendarDate[] = []

  for (const { ticketId, eff } of monthPlacements) {
    const slot = slotEndDates.findIndex((end) => compareCalendarDates(end, eff.startDate) < 0)
    const assigned = slot === -1 ? slotEndDates.length : slot
    slotEndDates[assigned] = eff.endDate
    map.set(ticketId, assigned)
  }

  return map
})

const monthStart = computed<CalendarDate>(() => ({ year: props.year, month: props.month, day: 1 }))
const monthEnd = computed<CalendarDate>(() => ({ year: props.year, month: props.month, day: daysInMonth.value }))

function overlapsMonth(start: CalendarDate, end: CalendarDate): boolean {
  return compareCalendarDates(start, monthEnd.value) <= 0 &&
         compareCalendarDates(end, monthStart.value) >= 0
}

// A ticket being moved or resized from another month into this one — needs a temporary extra slot
const extraPreview = computed(() => {
  // Move preview
  const { moveDrag, movePreviewDate, resizeDrag, resizePreviewDate } = dragState

  if (moveDrag && movePreviewDate && !slotMap.value.has(moveDrag.ticketId)) {
    const previewStart = movePreviewDate
    const previewEnd = addDays(previewStart, moveDrag.span)
    if (overlapsMonth(previewStart, previewEnd))
      return { ticketId: moveDrag.ticketId, startDate: previewStart, endDate: previewEnd }
  }

  // Resize preview — ticket originally in another month, stretching into this one
  if (resizeDrag && resizePreviewDate && !slotMap.value.has(resizeDrag.ticketId)) {
    const original = ticketsStore.placements.find((p) => p.ticketId === resizeDrag.ticketId)
    if (original) {
      const eff = effectivePlacement(original)
      if (overlapsMonth(eff.startDate, eff.endDate))
        return { ticketId: resizeDrag.ticketId, startDate: eff.startDate, endDate: eff.endDate }
    }
  }

  return null
})

const totalSlots = computed(() => {
  const base = slotMap.value.size === 0 ? 0 : Math.max(...slotMap.value.values()) + 1
  return extraPreview.value ? base + 1 : base
})

// Prevent layout jitter during drag: slot count may only grow, never shrink,
// so day cell heights stay stable and don't shift the element under the cursor.
const frozenSlots = ref(0)
watchEffect(() => {
  if (dragState.moveDrag || dragState.resizeDrag) {
    if (totalSlots.value > frozenSlots.value) frozenSlots.value = totalSlots.value
  } else {
    frozenSlots.value = 0
  }
})
const stableSlots = computed(() =>
  (dragState.moveDrag || dragState.resizeDrag)
    ? Math.max(totalSlots.value, frozenSlots.value)
    : totalSlots.value
)

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

function daySlots(day: number): (DayTicketInfo | null)[] {
  const thisDate = calDate(day)
  const slots: (DayTicketInfo | null)[] = Array(stableSlots.value).fill(null)
  const col = colPos(day)

  for (const placement of ticketsStore.getPlacementsForMonth(props.year, props.month)) {
    if (!isTicketVisible(placement.ticketId)) continue
    const eff = effectivePlacement(placement)
    if (compareCalendarDates(eff.startDate, thisDate) > 0) continue
    if (compareCalendarDates(thisDate, eff.endDate) > 0) continue
    const ticket = ticketsStore.tickets.find((t) => t.id === placement.ticketId)
    if (!ticket) continue
    const slot = slotMap.value.get(placement.ticketId)
    if (slot === undefined) continue

    const isStart = compareCalendarDates(eff.startDate, thisDate) === 0
    const isEnd = compareCalendarDates(eff.endDate, thisDate) === 0
    const isPreview =
      dragState.moveDrag?.ticketId === placement.ticketId ||
      dragState.resizeDrag?.ticketId === placement.ticketId

    const isOnVacation = !ticket.isLabel && ticket.assignedTo !== null &&
      vacationsStore.getVacationsForMonth(props.year, props.month).some(
        (v) => v.personId === ticket.assignedTo &&
          compareCalendarDates(v.startDate!, thisDate) <= 0 &&
          compareCalendarDates(thisDate, v.endDate!) <= 0
      )

    const spanTotal = Math.max(1, workingDaysBetween(eff.startDate, eff.endDate) + 1)
    const spanIndex = workingDaysBetween(eff.startDate, thisDate)

    slots[slot] = {
      ticket,
      placement: eff,
      isStart,
      isEnd,
      isRowEnd: !isEnd && (col === columnCount.value - 1 || day === lastVisibleDay.value),
      isRowStart: !isStart && (col === 0 || day === firstVisibleDay.value),
      isPreview,
      isOnVacation,
      spanIndex,
      spanTotal,
    }
  }

  // Ticket entering this month from outside (move or resize)
  const ep = extraPreview.value
  if (ep) {
    const firstEmpty = slots.indexOf(null)
    const previewSlot = firstEmpty !== -1 ? firstEmpty : stableSlots.value - 1
    if (
      compareCalendarDates(ep.startDate, thisDate) <= 0 &&
      compareCalendarDates(thisDate, ep.endDate) <= 0
    ) {
      const ticket = ticketsStore.tickets.find((t) => t.id === ep.ticketId)
      if (ticket) {
        const isStart = compareCalendarDates(ep.startDate, thisDate) === 0
        const isEnd = compareCalendarDates(ep.endDate, thisDate) === 0
        const epSpanTotal = Math.max(1, workingDaysBetween(ep.startDate, ep.endDate) + 1)
        const epSpanIndex = workingDaysBetween(ep.startDate, thisDate)
        slots[previewSlot] = {
          ticket,
          placement: { ticketId: ep.ticketId, startDate: ep.startDate, endDate: ep.endDate },
          isStart,
          isEnd,
          isRowEnd: !isEnd && (col === 6 || day === daysInMonth.value),
          isRowStart: !isStart && (col === 0 || day === 1),
          isPreview: true,
          isOnVacation: false,
          spanIndex: epSpanIndex,
          spanTotal: epSpanTotal,
        }
      }
    }
  }

  // Trim trailing empty slots so each cell is only as tall as its content.
  // Slots between used indices are kept (a ticket in slot 2 still needs slots 0 and 1).
  while (slots.length > 0 && slots[slots.length - 1] === null) slots.pop()
  return slots
}

function dayRowIndex(visibleDayIndex: number): number {
  return Math.floor((startOffset.value + visibleDayIndex) / columnCount.value)
}

const ticketSlotsPerRow = computed<Record<number, number>>(() => {
  const result: Record<number, number> = {}
  visibleDays.value.forEach((day, idx) => {
    const row = dayRowIndex(idx)
    const count = daySlots(day).length
    result[row] = Math.max(result[row] ?? 0, count)
  })
  return result
})

// --- Vacation slot computation ---

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

const vacationSlotMap = computed(() => {
  const monthVacations = vacationsStore.getVacationsForMonth(props.year, props.month)
    .filter((v) => !options.hiddenPersonIds.has(v.personId))
    .map((v) => ({ vacationId: v.id, eff: effectiveVacation(v) }))
    .sort((a, b) => compareCalendarDates(a.eff.startDate, b.eff.startDate))

  const map = new Map<number, number>()
  const slotEndDates: CalendarDate[] = []

  for (const { vacationId, eff } of monthVacations) {
    const slot = slotEndDates.findIndex((end) => compareCalendarDates(end, eff.startDate) < 0)
    const assigned = slot === -1 ? slotEndDates.length : slot
    slotEndDates[assigned] = eff.endDate
    map.set(vacationId, assigned)
  }
  return map
})

const extraVacationPreview = computed(() => {
  const { vacationMoveDrag, vacationMovePreviewDate, vacationResizeDrag, vacationResizePreviewDate } = dragState

  if (vacationMoveDrag && vacationMovePreviewDate && !vacationSlotMap.value.has(vacationMoveDrag.vacationId)) {
    const previewStart = vacationMovePreviewDate
    const previewEnd = options.hideWeekends
      ? addWorkingDays(previewStart, vacationMoveDrag.span)
      : addDays(previewStart, vacationMoveDrag.span)
    if (overlapsMonth(previewStart, previewEnd))
      return { vacationId: vacationMoveDrag.vacationId, startDate: previewStart, endDate: previewEnd }
  }

  if (vacationResizeDrag && vacationResizePreviewDate && !vacationSlotMap.value.has(vacationResizeDrag.vacationId)) {
    const original = vacationsStore.entries.find((v) => v.id === vacationResizeDrag.vacationId)
    if (original && original.startDate && original.endDate) {
      const eff = effectiveVacation(original)
      if (overlapsMonth(eff.startDate, eff.endDate))
        return { vacationId: vacationResizeDrag.vacationId, startDate: eff.startDate, endDate: eff.endDate }
    }
  }

  return null
})

const totalVacationSlots = computed(() => {
  const base = vacationSlotMap.value.size === 0 ? 0 : Math.max(...vacationSlotMap.value.values()) + 1
  return extraVacationPreview.value ? base + 1 : base
})

const frozenVacationSlots = ref(0)
watchEffect(() => {
  if (dragState.vacationMoveDrag || dragState.vacationResizeDrag) {
    if (totalVacationSlots.value > frozenVacationSlots.value) frozenVacationSlots.value = totalVacationSlots.value
  } else {
    frozenVacationSlots.value = 0
  }
})
const stableVacationSlots = computed(() =>
  (dragState.vacationMoveDrag || dragState.vacationResizeDrag)
    ? Math.max(totalVacationSlots.value, frozenVacationSlots.value)
    : totalVacationSlots.value
)

function vacationDaySlots(day: number): (DayVacationInfo | null)[] {
  const thisDate = calDate(day)
  const slots: (DayVacationInfo | null)[] = Array(stableVacationSlots.value).fill(null)
  const col = colPos(day)

  for (const entry of vacationsStore.getVacationsForMonth(props.year, props.month)) {
    if (options.hiddenPersonIds.has(entry.personId)) continue
    const eff = effectiveVacation(entry)
    if (compareCalendarDates(eff.startDate, thisDate) > 0) continue
    if (compareCalendarDates(thisDate, eff.endDate) > 0) continue
    const slot = vacationSlotMap.value.get(entry.id)
    if (slot === undefined) continue
    const person = peopleStore.people.find((p) => p.id === entry.personId)
    const isStart = compareCalendarDates(eff.startDate, thisDate) === 0
    const isEnd = compareCalendarDates(eff.endDate, thisDate) === 0
    slots[slot] = {
      vacationId: entry.id,
      personId: entry.personId,
      color: person?.color ?? '#aaa',
      personName: person?.name ?? '',
      startDate: eff.startDate,
      endDate: eff.endDate,
      isStart,
      isEnd,
      isRowStart: !isStart && (col === 0 || day === firstVisibleDay.value),
      isRowEnd: !isEnd && (col === columnCount.value - 1 || day === lastVisibleDay.value),
      isPreview: dragState.vacationMoveDrag?.vacationId === entry.id || dragState.vacationResizeDrag?.vacationId === entry.id,
    }
  }

  // Vacation from another month being dragged into this one
  const evp = extraVacationPreview.value
  if (evp) {
    const firstEmpty = slots.indexOf(null)
    const previewSlot = firstEmpty !== -1 ? firstEmpty : stableVacationSlots.value - 1
    if (
      compareCalendarDates(evp.startDate, thisDate) <= 0 &&
      compareCalendarDates(thisDate, evp.endDate) <= 0
    ) {
      const entry = vacationsStore.entries.find((v) => v.id === evp.vacationId)
      if (entry) {
        const person = peopleStore.people.find((p) => p.id === entry.personId)
        const isStart = compareCalendarDates(evp.startDate, thisDate) === 0
        const isEnd = compareCalendarDates(evp.endDate, thisDate) === 0
        slots[previewSlot] = {
          vacationId: evp.vacationId,
          personId: entry.personId,
          color: person?.color ?? '#aaa',
          personName: person?.name ?? '',
          startDate: evp.startDate,
          endDate: evp.endDate,
          isStart,
          isEnd,
          isRowStart: !isStart && (col === 0 || day === firstVisibleDay.value),
          isRowEnd: !isEnd && (col === columnCount.value - 1 || day === lastVisibleDay.value),
          isPreview: true,
        }
      }
    }
  }

  while (slots.length > 0 && slots[slots.length - 1] === null) slots.pop()
  return slots
}

const vacationSlotsPerRow = computed<Record<number, number>>(() => {
  const result: Record<number, number> = {}
  visibleDays.value.forEach((day, idx) => {
    const row = dayRowIndex(idx)
    const count = vacationDaySlots(day).length
    result[row] = Math.max(result[row] ?? 0, count)
  })
  return result
})

function effectiveDaySlots(day: number, rowIdx: number): (DayTicketInfo | null)[] {
  const slots = daySlots(day)
  const maxForRow = ticketSlotsPerRow.value[rowIdx] ?? slots.length
  while (slots.length < maxForRow) slots.push(null)
  return slots
}

function effectiveVacationSlots(day: number, rowIdx: number): (DayVacationInfo | null)[] {
  const slots = vacationDaySlots(day)
  const maxForRow = vacationSlotsPerRow.value[rowIdx] ?? slots.length
  while (slots.length < maxForRow) slots.push(null)
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


function onDragOver(event: DragEvent, day: number) {
  event.preventDefault()
  if (dragOverDay.value === day) return
  dragOverDay.value = day
  if (dragState.resizeDrag) dragState.updateResizePreview(calDate(day))
  if (dragState.moveDrag) dragState.updateMovePreview(calDate(day))
  if (dragState.vacationResizeDrag) dragState.updateVacationResizePreview(calDate(day))
  if (dragState.vacationMoveDrag) dragState.updateVacationMovePreview(calDate(day))
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

function isVacationDay(personId: number | null, date: CalendarDate): boolean {
  if (personId === null) return false
  return vacationsStore.entries.some(
    (v) =>
      v.personId === personId &&
      v.startDate !== null &&
      v.endDate !== null &&
      compareCalendarDates(date, v.startDate) >= 0 &&
      compareCalendarDates(date, v.endDate) <= 0,
  )
}

function onDrop(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = null

  const resizeHandle = event.dataTransfer?.getData('resizeHandle')
  if (resizeHandle) {
    const [side, id] = resizeHandle.split(':')
    const ticket = ticketsStore.tickets.find((t) => t.id === Number(id))
    if (ticket && isVacationDay(ticket.assignedTo, calDate(day))) {
      dragState.clearResizeDrag()
      showRejection("Tickets can't start or end on a vacation day")
      return
    }
    ticketsStore.resizePlacement(Number(id), side as 'start' | 'end', calDate(day))
    dragState.clearResizeDrag()
    return
  }

  const moveData = event.dataTransfer?.getData('moveCalendarTicket')
  if (moveData && dragState.moveDrag) {
    const newStart = calDate(day)
    const newEnd = options.hideWeekends
      ? addWorkingDays(newStart, dragState.moveDrag.span)
      : addDays(newStart, dragState.moveDrag.span)
    const ticket = ticketsStore.tickets.find((t) => t.id === Number(moveData))
    if (ticket && (isVacationDay(ticket.assignedTo, newStart) || isVacationDay(ticket.assignedTo, newEnd))) {
      dragState.clearMoveDrag()
      showRejection("Tickets can't start or end on a vacation day")
      return
    }
    ticketsStore.moveTicket(Number(moveData), newStart, newEnd)
    dragState.clearMoveDrag()
    return
  }

  const ticketId = event.dataTransfer?.getData('ticketId')
  if (ticketId) {
    const ticket = ticketsStore.tickets.find((t) => t.id === Number(ticketId))
    if (ticket && isVacationDay(ticket.assignedTo, calDate(day))) {
      dragState.clearMoveDrag()
      showRejection("Tickets can't start or end on a vacation day")
      return
    }
    ticketsStore.placeTicket(Number(ticketId), calDate(day))
    dragState.clearMoveDrag()
    return
  }

  const vacationResizeHandle = event.dataTransfer?.getData('vacationResizeHandle')
  if (vacationResizeHandle) {
    const [side, idStr] = vacationResizeHandle.split(':')
    const id = Number(idStr)
    const entry = vacationsStore.entries.find((v) => v.id === id)
    if (entry && entry.startDate && entry.endDate) {
      let newStart = entry.startDate
      let newEnd = entry.endDate
      if (side === 'start' && compareCalendarDates(calDate(day), entry.endDate) <= 0) newStart = calDate(day)
      else if (side === 'end' && compareCalendarDates(calDate(day), entry.startDate) >= 0) newEnd = calDate(day)
      if (hasTicketEndpointInRange(entry.personId, newStart, newEnd)) {
        dragState.clearVacationResizeDrag()
        showRejection("Vacations can't cover a ticket's start or end day")
        return
      }
      vacationsStore.moveVacation(id, newStart, newEnd)
    }
    dragState.clearVacationResizeDrag()
    return
  }

  const vacationId = event.dataTransfer?.getData('vacationId')
  if (vacationId) {
    const entry = vacationsStore.entries.find((v) => v.id === Number(vacationId))
    if (entry && hasTicketEndpointInRange(entry.personId, calDate(day), calDate(day))) {
      dragState.clearVacationMoveDrag()
      showRejection("Vacations can't cover a ticket's start or end day")
      return
    }
    vacationsStore.placeVacation(Number(vacationId), calDate(day), calDate(day))
    dragState.clearVacationMoveDrag()
    return
  }

  const newVacationPersonId = event.dataTransfer?.getData('newVacationPersonId')
  if (newVacationPersonId) {
    const personId = Number(newVacationPersonId)
    if (hasTicketEndpointInRange(personId, calDate(day), calDate(day))) {
      showRejection("Vacations can't cover a ticket's start or end day")
      return
    }
    const id = vacationsStore.addVacation(personId)
    vacationsStore.placeVacation(id, calDate(day), calDate(day))
    return
  }

  const moveVacationData = event.dataTransfer?.getData('moveCalendarVacation')
  if (moveVacationData && dragState.vacationMoveDrag) {
    const entry = vacationsStore.entries.find((v) => v.id === Number(moveVacationData))
    const newStart = calDate(day)
    const newEnd = addDays(newStart, dragState.vacationMoveDrag.span)
    if (entry && hasTicketEndpointInRange(entry.personId, newStart, newEnd)) {
      dragState.clearVacationMoveDrag()
      showRejection("Vacations can't cover a ticket's start or end day")
      return
    }
    vacationsStore.moveVacation(Number(moveVacationData), newStart, newEnd)
    dragState.clearVacationMoveDrag()
  }
}
</script>

<template>
  <Transition name="toast">
    <div v-if="rejectedMessage" class="vacation-toast">
      {{ rejectedMessage }}
    </div>
  </Transition>
  <div class="month-calendar">
    <h2><span class="month-name">{{ monthName }}</span> <sup class="year-sup">{{ year }}</sup></h2>
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${columnCount}, minmax(125px, 1fr))` }">
      <div v-for="header in dayHeaders" :key="header" class="cell header">{{ header }}</div>
      <div v-for="n in startOffset" :key="`empty-${n}`" class="cell" />
      <div
        v-for="(day, dayIdx) in visibleDays"
        :key="day"
        class="cell day"
        :class="{
          'drag-over': dragOverDay === day && !dragState.resizeDrag && !dragState.moveDrag,
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
          <div v-for="(info, slotIdx) in effectiveDaySlots(day, dayRowIndex(dayIdx))" :key="slotIdx" class="slot-row">
            <div v-if="info" class="pill-slot">
              <div
                v-if="info.isStart"
                class="pill-marker s-marker"
                :class="{ 'is-visible': dragState.hoveredTicketId === info.ticket.id }"
              >S</div>
              <div
                class="ticket-pill"
                :data-ticket-id="info.ticket.id"
                :class="{
                  'is-start': info.isStart,
                  'is-end': info.isEnd,
                  'is-preview': info.isPreview,
                  'row-end': info.isRowEnd,
                  'row-start': info.isRowStart,
                  'is-on-vacation': info.isOnVacation,
                  'is-hovered': dragState.hoveredTicketId === info.ticket.id,
                  'is-dimmed': (dragState.hoveredTicketId !== null && dragState.hoveredTicketId !== info.ticket.id) || dragState.hoveredVacationId !== null,
                  'is-event': info.ticket.isLabel,
                }"
                :style="{ '--tc': ticketColor(info.ticket), background: ticketSegmentBg(info.ticket, info.spanIndex, info.spanTotal) }"
                draggable="true"
                @mouseenter="showTicketTooltip($event, info)"
                @mouseleave="hideTicketTooltip()"
                @click.stop="info.ticket.isLabel ? (editingLabel = info.ticket) : (editingTicket = info.ticket)"
                @dragstart="onTicketDragStart($event, info)"
                @dragend="dragState.clearMoveDrag"
              >
                <button
                  v-if="info.isStart"
                  class="resize-handle"
                  draggable="true"
                  @click.stop
                  @dragstart="onHandleDragStart($event, info.ticket.id, 'start')"
                  @dragend="dragState.clearResizeDrag"
                >‹</button>
                <span v-if="info.isStart || info.isRowStart" class="ticket-label">{{ info.ticket.isLabel ? info.ticket.title : info.ticket.number }}</span>
                <button
                  v-if="info.isEnd"
                  class="resize-handle right-handle"
                  draggable="true"
                  @dragstart="onHandleDragStart($event, info.ticket.id, 'end')"
                  @dragend="dragState.clearResizeDrag"
                >›</button>
              </div>
              <div
                v-if="info.isEnd"
                class="pill-marker f-marker"
                :class="{ 'is-visible': dragState.hoveredTicketId === info.ticket.id }"
              >F</div>
            </div>
            <div v-else class="slot-spacer" />
          </div>
          <div v-for="(info, slotIdx) in effectiveVacationSlots(day, dayRowIndex(dayIdx))" :key="`vac-${slotIdx}`" class="slot-row">
            <div v-if="info" class="pill-slot">
              <div
                v-if="info.isStart"
                class="pill-marker s-marker"
                :class="{ 'is-visible': dragState.hoveredVacationId === info.vacationId }"
              >S</div>
              <div
                class="vacation-pill"
                :class="{
                  'is-start': info.isStart,
                  'is-end': info.isEnd,
                  'row-end': info.isRowEnd,
                  'row-start': info.isRowStart,
                  'is-preview': info.isPreview,
                  'is-hovered': dragState.hoveredVacationId === info.vacationId,
                  'is-dimmed': (dragState.hoveredVacationId !== null && dragState.hoveredVacationId !== info.vacationId) || (dragState.hoveredTicketId !== null),
                }"
                draggable="true"
                @mouseenter="dragState.hoveredVacationId = info.vacationId"
                @mouseleave="dragState.hoveredVacationId = null"
                @dragstart="onVacationDragStart($event, info)"
                @dragend="dragState.clearVacationMoveDrag()"
              >
                <button
                  v-if="info.isStart"
                  class="resize-handle"
                  draggable="true"
                  @click.stop
                  @dragstart="onVacationHandleDragStart($event, info.vacationId, 'start')"
                  @dragend="dragState.clearVacationResizeDrag()"
                >‹</button>
                <span v-if="info.isStart || info.isRowStart" class="vacation-label">{{ info.personName }} Vacation</span>
                <button
                  v-if="info.isEnd"
                  class="resize-handle right-handle"
                  draggable="true"
                  @click.stop
                  @dragstart="onVacationHandleDragStart($event, info.vacationId, 'end')"
                  @dragend="dragState.clearVacationResizeDrag()"
                >›</button>
              </div>
              <div
                v-if="info.isEnd"
                class="pill-marker f-marker"
                :class="{ 'is-visible': dragState.hoveredVacationId === info.vacationId }"
              >F</div>
            </div>
            <div v-else class="slot-spacer" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <EditTicketModal
    v-if="editingTicket"
    :ticket="editingTicket"
    :people="peopleStore.people"
    :placement="ticketsStore.placements.find((p) => p.ticketId === editingTicket!.id) ?? null"
    @submit="handleEditSubmit"
    @delete="handleDeleteTicket"
    @cancel="editingTicket = null"
  />

  <AddLabelModal
    v-if="editingLabel"
    :existing="editingLabel"
    @save="(text, color) => { ticketsStore.updateTicket(editingLabel!.id, { title: text, labelColor: color }); editingLabel = null }"
    @delete="() => { ticketsStore.deleteTicket(editingLabel!.id); editingLabel = null }"
    @cancel="editingLabel = null"
  />

  <Teleport to="body">
    <Transition name="tooltip">
      <div
        v-if="ticketTooltip && !dragState.moveDrag && !dragState.resizeDrag"
        class="global-tooltip"
        :style="{ left: ticketTooltip.x + 'px', top: ticketTooltip.y + 'px' }"
      >
        <div v-if="ticketTooltip.title" class="tooltip-title">{{ ticketTooltip.title }}</div>
        <div class="tooltip-row"><span class="tooltip-label">{{ ticketTooltip.duration === 1 ? 'Date' : 'Dates' }}</span><span>{{ ticketTooltip.duration === 1 ? fmtDate(ticketTooltip.startDate) : `${fmtDate(ticketTooltip.startDate)} – ${fmtDate(ticketTooltip.endDate)}` }}</span></div>
        <div v-if="ticketTooltip.duration !== 1" class="tooltip-row"><span class="tooltip-label">Duration</span><span>{{ ticketTooltip.duration }} days</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Assigned to</span><span>{{ ticketTooltip.assignedTo }}</span></div>
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
  background: linear-gradient(
    to right,
    #a78bfa 20%,
    #38bdf8 35%,
    #22d3ee 65%,
    #818cf8 80%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-fill-color: transparent;
  background-size: 500% auto;
  animation: textShine 5s ease-in-out infinite alternate;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
}

@keyframes textShine {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
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
  background: rgba(100, 120, 255, 0.1);
  outline: 1px dashed rgba(150, 150, 255, 0.4);
}

.day-header {
  display: flex;
  flex-direction: column;
  padding: 0.4rem 0 0 0.4rem;
  overflow: hidden;
}

.day-number {
  font-size: 0.85rem;
}

.day-number-wrap {
  position: relative;
  display: inline-flex;
  align-self: flex-start;
}

.day-number {
  cursor: pointer;
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
  transition: background 0.1s, color 0.1s;
}

.day-number:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
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
  overflow: visible;
  transition: opacity 0.2s ease, filter 0.2s ease;
}


.vacation-pill.is-preview {
  opacity: 0.75;
}

.vacation-pill.is-hovered {
  opacity: 1;
  filter: brightness(1.35);
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
  background: linear-gradient(to right, #4c3585 20%, #0e6688 35%, #0b7a85 65%, #2d3178 80%);
  background-size: 500% auto;
  animation: textShine 5s ease-in-out infinite alternate;
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
  opacity: 1;
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

.ticket-pill.is-on-vacation {
  display: none;
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
  transform: translate(-50%, calc(-100% + 8px));
}

:global(.tooltip-leave-to) {
  opacity: 0;
}

:global(.global-tooltip) {
  position: fixed;
  transform: translate(-50%, calc(-100% - 6px));
  transition: left 0.3s cubic-bezier(0.1, 1, 0.2, 1), top 0.3s cubic-bezier(0.1, 1, 0.2, 1);
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

.vacation-toast {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  white-space: nowrap;
}

.toast-enter-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-leave-active {
  transition: opacity 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
.toast-leave-to {
  opacity: 0;
}
</style>
