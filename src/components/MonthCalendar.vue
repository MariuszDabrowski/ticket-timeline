<script setup lang="ts">
import { ref, computed, watchEffect, onUnmounted } from 'vue'
import { useTicketsStore, compareCalendarDates } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
import { useCalendarLayoutStore } from '../stores/calendarLayout'
import { useDayMarkersStore } from '../stores/dayMarkers'
import { getCanadianHolidays, getAmericanHolidays } from '../utils/holidays'
import { snapToWeekday, workingDaysBetween, addWorkingDays } from '../utils/dates'
import type { Ticket, Placement, CalendarDate } from '../stores/tickets'
import EditTicketModal from './EditTicketModal.vue'
import DayMarkerModal from './DayMarkerModal.vue'

const props = defineProps<{
  year: number
  month: number
}>()

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_HEADERS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const monthName = computed(() => MONTH_NAMES[props.month])
const daysInMonth = computed(() => new Date(props.year, props.month + 1, 0).getDate())

const ticketsStore = useTicketsStore()
const peopleStore = usePeopleStore()
const dragState = useDragStateStore()
const options = useOptionsStore()
const layoutStore = useCalendarLayoutStore()
const storeKey = computed(() => `${props.year}-${props.month}`)

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
  const all = [
    ...(options.showCanadianHolidays ? getCanadianHolidays(props.year) : []),
    ...(options.showAmericanHolidays ? getAmericanHolidays(props.year) : []),
  ]
  for (const h of all) {
    if (h.date.month === props.month) map.set(h.date.day, h.name)
  }
  return map
})

const dragOverDay = ref<number | null>(null)
const editingTicket = ref<Ticket | null>(null)
const dayMarkers = useDayMarkersStore()
const markerDay = ref<number | null>(null)

function handleEditSubmit(data: { number: string; title: string; assignedTo: number | null; link: string }) {
  if (editingTicket.value) ticketsStore.updateTicket(editingTicket.value.id, data)
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

function ticketColor(assignedTo: number | null): string {
  if (assignedTo === null) return '#ccc'
  return peopleStore.people.find((p) => p.id === assignedTo)?.color ?? '#ccc'
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

// Slot assignment based on effective placements so overlapping tickets drop to new slots during preview
const slotMap = computed(() => {
  const monthPlacements = ticketsStore
    .getPlacementsForMonth(props.year, props.month)
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
    slots[slot] = {
      ticket,
      placement: eff,
      isStart,
      isEnd,
      isRowEnd: !isEnd && (col === columnCount.value - 1 || day === lastVisibleDay.value),
      isRowStart: !isStart && (col === 0 || day === firstVisibleDay.value),
      isPreview,
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
        slots[previewSlot] = {
          ticket,
          placement: { ticketId: ep.ticketId, startDate: ep.startDate, endDate: ep.endDate },
          isStart,
          isEnd,
          isRowEnd: !isEnd && (col === 6 || day === daysInMonth.value),
          isRowStart: !isStart && (col === 0 || day === 1),
          isPreview: true,
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

const slotsPerRow = computed<Record<number, number>>(() => {
  const result: Record<number, number> = {}
  visibleDays.value.forEach((day, idx) => {
    const row = dayRowIndex(idx)
    const count = daySlots(day).length
    result[row] = Math.max(result[row] ?? 0, count)
  })
  return result
})

watchEffect(() => {
  layoutStore.register(storeKey.value, slotsPerRow.value)
})

onUnmounted(() => {
  layoutStore.unregister(storeKey.value)
})

function effectiveDaySlots(day: number, rowIdx: number): (DayTicketInfo | null)[] {
  const slots = daySlots(day)
  const maxForRow = layoutStore.maxSlotsPerRow[rowIdx] ?? slots.length
  while (slots.length < maxForRow) slots.push(null)
  return slots
}

function onDragOver(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = day
  if (dragState.resizeDrag) dragState.updateResizePreview(calDate(day))
  if (dragState.moveDrag) dragState.updateMovePreview(calDate(day))
}

function onDragLeave(event: DragEvent) {
  if ((event.currentTarget as Element).contains(event.relatedTarget as Node)) return
  dragOverDay.value = null
}

function onHandleDragStart(event: DragEvent, ticketId: number, side: 'start' | 'end') {
  event.stopPropagation()
  event.dataTransfer?.setData('resizeHandle', `${side}:${ticketId}`)
  dragState.startResizeDrag(ticketId, side)
}

function onTicketDragStart(event: DragEvent, info: DayTicketInfo) {
  event.dataTransfer?.setData('moveCalendarTicket', String(info.ticket.id))
  const span = options.hideWeekends
    ? workingDaysBetween(info.placement.startDate, info.placement.endDate)
    : spanInDays(info.placement.startDate, info.placement.endDate)
  dragState.startMoveDrag(info.ticket.id, span)
}

function onDrop(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = null

  const resizeHandle = event.dataTransfer?.getData('resizeHandle')
  if (resizeHandle) {
    const [side, id] = resizeHandle.split(':')
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
    ticketsStore.moveTicket(Number(moveData), newStart, newEnd)
    dragState.clearMoveDrag()
    return
  }

  const ticketId = event.dataTransfer?.getData('ticketId')
  if (ticketId) {
    ticketsStore.placeTicket(Number(ticketId), calDate(day))
    dragState.clearMoveDrag()
  }
}
</script>

<template>
  <div class="month-calendar">
    <h2>{{ monthName }} {{ year }}</h2>
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
        }"
        @dragover="onDragOver($event, day)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, day)"
      >
        <div class="day-header">
          <div class="day-number-wrap">
            <span
              class="day-number"
              :class="{ 'has-marker': !!dayMarkers.getMarker(props.year, props.month, day) }"
              :style="dayMarkers.getMarker(props.year, props.month, day) ? { background: dayMarkers.getMarker(props.year, props.month, day)!.color } : {}"
              @click.stop="markerDay = day"
            >{{ day }}</span>
            <div
              v-if="dayMarkers.getMarker(props.year, props.month, day)?.note"
              class="day-marker-tooltip"
            >{{ dayMarkers.getMarker(props.year, props.month, day)!.note }}</div>
          </div>
          <span v-if="holidayMap.has(day)" class="holiday-label">{{ holidayMap.get(day) }}</span>
        </div>
        <div class="placed-tickets">
          <div v-for="(info, slotIdx) in effectiveDaySlots(day, dayRowIndex(dayIdx))" :key="slotIdx" class="slot-row">
            <div
              v-if="info"
              class="ticket-pill"
              :class="{
                'is-start': info.isStart,
                'is-end': info.isEnd,
                'is-preview': info.isPreview,
                'row-end': info.isRowEnd,
                'row-start': info.isRowStart,
              }"
              :style="{ background: ticketColor(info.ticket.assignedTo) }"
              :title="info.ticket.title"
              draggable="true"
              @click.stop="editingTicket = info.ticket"
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
              <span v-if="info.isStart || info.isRowStart" class="ticket-label">{{ info.ticket.number }}</span>
              <button
                v-if="info.isEnd"
                class="resize-handle right-handle"
                draggable="true"
                @dragstart="onHandleDragStart($event, info.ticket.id, 'end')"
                @dragend="dragState.clearResizeDrag"
              >›</button>
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
    @submit="handleEditSubmit"
    @delete="handleDeleteTicket"
    @cancel="editingTicket = null"
  />

  <DayMarkerModal
    v-if="markerDay !== null"
    :year="props.year"
    :month="props.month"
    :day="markerDay"
    :existing="dayMarkers.getMarker(props.year, props.month, markerDay)"
    @save="(m) => { dayMarkers.setMarker(props.year, props.month, markerDay!, m); markerDay = null }"
    @cancel="markerDay = null"
  />
</template>

<style scoped>
.month-calendar {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 1rem;
  min-width: fit-content;
  flex-shrink: 0;
}

h2 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
  font-weight: bold;
}

.grid {
  display: grid;
  gap: 0;
  border-top: 1px solid #ddd;
  border-left: 1px solid #ddd;
}

.cell {
  padding: 0.25rem 0;
  font-size: 0.85rem;
  min-height: 125px;
  border-right: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
  overflow: visible;
}

.header {
  font-weight: bold;
  text-align: center;
  min-height: unset;
  padding: 0.25rem;
}

.day {
  display: grid;
  grid-template-rows: 2.6rem 1fr;
  overflow: visible;
}

.day.drag-over {
  background: #f0f4ff;
  outline: 2px dashed #99b;
}

.day-header {
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0 0 0.25rem;
  overflow: visible;
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
  width: 1.6rem;
  height: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.1s;
}

.day-number:hover {
  background: rgba(128, 128, 128, 0.15);
}

.day-number.has-marker {
  color: #fff;
}

.day-marker-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(80, 80, 80, 0.85);
  color: #fff;
  padding: 0.3rem 0.6rem;
  border-radius: 5px;
  font-size: 0.75rem;
  width: max-content;
  max-width: 250px;
  white-space: normal;
  text-align: center;
  line-height: 1.4;
  pointer-events: none;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.15s;
}

.day-marker-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(80, 80, 80, 0.85);
}

.day-number-wrap:hover .day-marker-tooltip {
  opacity: 1;
}

.day.is-holiday {
  background: rgba(200, 160, 0, 0.08);
}

.holiday-label {
  font-size: 0.65rem;
  color: #9a7a1a;
  font-weight: 500;
  padding: 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

@media (prefers-color-scheme: dark) {
  .holiday-label {
    color: #c8a030;
  }
}

.placed-tickets {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.slot-row {
  height: 1.4rem;
}

.slot-spacer {
  height: 100%;
}

.ticket-pill {
  display: flex;
  align-items: center;
  height: 100%;
  font-size: 0.72rem;
  font-weight: bold;
  color: #fff;
  overflow: visible;
  position: relative;
  border-radius: 0;
  padding: 0.1rem 0;
  cursor: grab;
  transition: opacity 0.1s;
}

.ticket-pill:active {
  cursor: grabbing;
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

.ticket-pill.is-start.is-end {
  border-radius: 999px;
}

.ticket-pill.is-preview {
  opacity: 0.5;
}

.ticket-label {
  flex: 1;
  padding: 0 0.3rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ticket-pill.row-end::after {
  content: '';
  position: absolute;
  right: -0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: inherit;
  z-index: 1;
}

.ticket-pill.row-start::before {
  content: '';
  position: absolute;
  left: -0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--color-background, #ffffff);
  z-index: 1;
}

.resize-handle {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0 0.25rem;
  cursor: ew-resize;
  opacity: 0.7;
}

.resize-handle:hover {
  opacity: 1;
}

.right-handle {
  margin-left: auto;
}
</style>
