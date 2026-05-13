<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { useTicketsStore, compareCalendarDates } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
import { useDayMarkersStore } from '../stores/dayMarkers'
import { useVacationsStore } from '../stores/vacations'
import { getCanadianHolidays, getAmericanHolidays } from '../utils/holidays'
import { snapToWeekday, workingDaysBetween, addWorkingDays } from '../utils/dates'
import type { Ticket, Placement, CalendarDate } from '../stores/tickets'
import EditTicketModal from './EditTicketModal.vue'
import AddLabelModal from './AddLabelModal.vue'
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
  for (const h of (options.showCanadianHolidays ? getCanadianHolidays(props.year) : [])) {
    if (h.date.month === props.month) map.set(h.date.day, `🇨🇦 ${h.name}`)
  }
  for (const h of (options.showAmericanHolidays ? getAmericanHolidays(props.year) : [])) {
    if (h.date.month === props.month) map.set(h.date.day, `🇺🇸 ${h.name}`)
  }
  return map
})

const dragOverDay = ref<number | null>(null)
const editingTicket = ref<Ticket | null>(null)
const editingLabel = ref<Ticket | null>(null)
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

function ticketColor(ticket: { assignedTo: number | null; isLabel?: boolean; labelColor?: string }): string {
  if (ticket.isLabel) return ticket.labelColor ?? '#607d8b'
  if (ticket.assignedTo === null) return '#555'
  return peopleStore.people.find((p) => p.id === ticket.assignedTo)?.color ?? '#555'
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
  personId: number
  color: string
  personName: string
  isStart: boolean
  isEnd: boolean
  isRowStart: boolean
  isRowEnd: boolean
}

const vacationSlotMap = computed(() => {
  const monthVacations = vacationsStore.getVacationsForMonth(props.year, props.month)
    .slice()
    .sort((a, b) => compareCalendarDates(a.startDate, b.startDate))

  const map = new Map<number, number>()
  const slotEndDates: CalendarDate[] = []

  for (const entry of monthVacations) {
    const slot = slotEndDates.findIndex((end) => compareCalendarDates(end, entry.startDate) < 0)
    const assigned = slot === -1 ? slotEndDates.length : slot
    slotEndDates[assigned] = entry.endDate
    map.set(entry.id, assigned)
  }
  return map
})

const totalVacationSlots = computed(() =>
  vacationSlotMap.value.size === 0 ? 0 : Math.max(...vacationSlotMap.value.values()) + 1
)

function vacationDaySlots(day: number): (DayVacationInfo | null)[] {
  const thisDate = calDate(day)
  const slots: (DayVacationInfo | null)[] = Array(totalVacationSlots.value).fill(null)
  const col = colPos(day)

  for (const entry of vacationsStore.getVacationsForMonth(props.year, props.month)) {
    if (compareCalendarDates(entry.startDate, thisDate) > 0) continue
    if (compareCalendarDates(thisDate, entry.endDate) > 0) continue
    const slot = vacationSlotMap.value.get(entry.id)
    if (slot === undefined) continue
    const person = peopleStore.people.find((p) => p.id === entry.personId)
    const isStart = compareCalendarDates(entry.startDate, thisDate) === 0
    const isEnd = compareCalendarDates(entry.endDate, thisDate) === 0
    slots[slot] = {
      personId: entry.personId,
      color: person?.color ?? '#aaa',
      personName: person?.name ?? '',
      isStart,
      isEnd,
      isRowStart: !isStart && (col === 0 || day === firstVisibleDay.value),
      isRowEnd: !isEnd && (col === columnCount.value - 1 || day === lastVisibleDay.value),
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

function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * (1 - amount))}, ${Math.round(g * (1 - amount))}, ${Math.round(b * (1 - amount))})`
}

function vacationStyle(color: string): Record<string, string> {
  const dark = darkenColor(color, 0.18)
  return {
    background: `repeating-linear-gradient(45deg, ${color}, ${color} 5px, ${dark} 5px, ${dark} 10px)`,
  }
}

function onDragOver(event: DragEvent, day: number) {
  event.preventDefault()
  if (dragOverDay.value === day) return
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
              :class="{ 'has-marker': !!dayMarkers.getMarker(props.year, props.month, day) }"
              :style="dayMarkers.getMarker(props.year, props.month, day) ? { background: dayMarkers.getMarker(props.year, props.month, day)!.color } : {}"
              @click.stop="markerDay = day"
            >{{ day }}</span>
            <div
              v-if="dayMarkers.getMarker(props.year, props.month, day)?.note"
              class="day-marker-tooltip"
              :class="{ 'always-visible': options.showAllTooltips }"
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
              :style="{ background: ticketColor(info.ticket) }"
              draggable="true"
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
              <span v-if="!info.ticket.isLabel && info.ticket.title" class="ticket-tooltip">{{ info.ticket.title }}</span>
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
          <div v-for="(info, slotIdx) in effectiveVacationSlots(day, dayRowIndex(dayIdx))" :key="`vac-${slotIdx}`" class="slot-row">
            <div
              v-if="info"
              class="vacation-pill"
              :class="{
                'is-start': info.isStart,
                'is-end': info.isEnd,
                'row-end': info.isRowEnd,
                'row-start': info.isRowStart,
              }"
              :style="{ ...vacationStyle(info.color), '--vac-color': info.color }"
              :title="`${info.personName} – vacation`"
            >
              <span v-if="info.isStart || info.isRowStart" class="vacation-label">{{ info.personName }} Vacation</span>
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

  <AddLabelModal
    v-if="editingLabel"
    :existing="editingLabel"
    @save="(text, color) => { ticketsStore.updateTicket(editingLabel!.id, { title: text, labelColor: color }); editingLabel = null }"
    @delete="() => { ticketsStore.deleteTicket(editingLabel!.id); editingLabel = null }"
    @cancel="editingLabel = null"
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
  color: #fff;
  min-height: unset;
  padding: 0.5rem 0.25rem;
  background: rgba(255, 255, 255, 0.04);
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
  width: 1.7rem;
  height: 1.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.82rem;
  font-weight: 500;
  color: #fff;
  transition: background 0.1s, color 0.1s;
}

.day-number:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.day-number.has-marker {
  color: #fff;
}

.day-marker-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(40, 40, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
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
  border-top-color: rgba(40, 40, 40, 0.95);
}

.day-number-wrap:hover .day-marker-tooltip,
.day-marker-tooltip.always-visible {
  opacity: 1;
}

.day.is-today .day-number {
  background: #e05252;
  color: #fff;
  font-weight: 700;
}

.day.is-holiday {
  background: rgba(240, 175, 85, 0.05);
}

.holiday-label {
  font-size: 12px;
  color: rgba(240, 175, 85, 1);
  font-weight: 500;
  padding: 0 0.3rem 0.35rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.placed-tickets {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-top: 0.3rem;
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
  cursor: default;
  opacity: 0.9;
  min-height: 1.1rem;
  line-height: 1;
  position: relative;
}

.vacation-pill.row-end::after {
  content: '';
  position: absolute;
  right: -0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: var(--vac-color);
  z-index: 1;
}

.vacation-pill.row-start::before {
  content: '';
  position: absolute;
  left: -0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: #1a1a1a;
  z-index: 1;
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

.ticket-pill {
  display: flex;
  align-items: center;
  height: 100%;
  font-size: 0.72rem;
  font-weight: bold;
  line-height: 1;
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

.ticket-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(60, 60, 60, 0.92);
  color: #fff;
  padding: 0.3rem 0.55rem;
  border-radius: 5px;
  font-size: 0.75rem;
  font-weight: normal;
  width: max-content;
  max-width: 250px;
  white-space: normal;
  text-align: center;
  line-height: 1.4;
  pointer-events: none;
  z-index: 20;
  opacity: 0;
  transition: opacity 0.15s;
}

.ticket-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(60, 60, 60, 0.92);
}

.ticket-pill:hover .ticket-tooltip {
  opacity: 1;
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

.ticket-pill.row-start .ticket-label {
  padding-left: 0.6rem;
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
  background: #1a1a1a;
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
