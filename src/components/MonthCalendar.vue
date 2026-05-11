<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTicketsStore, compareCalendarDates } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import { useDragStateStore } from '../stores/dragState'
import type { Ticket, Placement, CalendarDate } from '../stores/tickets'

const props = defineProps<{
  year: number
  month: number
}>()

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const monthName = computed(() => MONTH_NAMES[props.month])
const startOffset = computed(() => new Date(props.year, props.month, 1).getDay())
const daysInMonth = computed(() => new Date(props.year, props.month + 1, 0).getDate())

const ticketsStore = useTicketsStore()
const peopleStore = usePeopleStore()
const dragState = useDragStateStore()

const dragOverDay = ref<number | null>(null)

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
  if (dragState.resizeDrag?.ticketId === placement.ticketId && dragState.resizePreviewDate) {
    const previewDate = dragState.resizePreviewDate
    if (dragState.resizeDrag.side === 'start' && compareCalendarDates(previewDate, placement.endDate) <= 0)
      return { ...placement, startDate: previewDate }
    if (dragState.resizeDrag.side === 'end' && compareCalendarDates(previewDate, placement.startDate) >= 0)
      return { ...placement, endDate: previewDate }
  }
  if (dragState.moveDrag?.ticketId === placement.ticketId && dragState.movePreviewDate) {
    const newStart = dragState.movePreviewDate
    return { ...placement, startDate: newStart, endDate: addDays(newStart, dragState.moveDrag.span) }
  }
  return placement
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
  return (startOffset.value + day - 1) % 7
}

function daySlots(day: number): (DayTicketInfo | null)[] {
  const thisDate = calDate(day)
  const slots: (DayTicketInfo | null)[] = Array(totalSlots.value).fill(null)
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
      isRowEnd: !isEnd && (col === 6 || day === daysInMonth.value),
      isRowStart: !isStart && (col === 0 || day === 1),
      isPreview,
    }
  }

  // Ticket entering this month from outside (move or resize)
  const ep = extraPreview.value
  if (ep) {
    const firstEmpty = slots.indexOf(null)
    const previewSlot = firstEmpty !== -1 ? firstEmpty : totalSlots.value - 1
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
  dragState.startMoveDrag(
    info.ticket.id,
    spanInDays(info.placement.startDate, info.placement.endDate),
  )
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
  if (moveData) {
    ticketsStore.moveTicket(Number(moveData), calDate(day))
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
    <div class="grid">
      <div v-for="day in DAY_HEADERS" :key="day" class="cell header">{{ day }}</div>
      <div v-for="n in startOffset" :key="`empty-${n}`" class="cell" />
      <div
        v-for="day in daysInMonth"
        :key="day"
        class="cell day"
        :class="{ 'drag-over': dragOverDay === day && !dragState.resizeDrag && !dragState.moveDrag }"
        @dragover="onDragOver($event, day)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, day)"
      >
        <span class="day-number">{{ day }}</span>
        <div class="placed-tickets">
          <div v-for="(info, slotIdx) in daySlots(day)" :key="slotIdx" class="slot-row">
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
              @dragstart="onTicketDragStart($event, info)"
              @dragend="dragState.clearMoveDrag"
            >
              <button
                v-if="info.isStart"
                class="resize-handle"
                draggable="true"
                @dragstart="onHandleDragStart($event, info.ticket.id, 'start')"
                @dragend="dragState.clearResizeDrag"
              >‹</button>
              <span v-if="info.isStart" class="ticket-label">{{ info.ticket.number }}</span>
              <button
                v-if="info.isEnd"
                class="resize-handle"
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
</template>

<style scoped>
.month-calendar {
  padding: 1rem;
  border-bottom: 1px solid #ccc;
}

h2 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
  font-weight: bold;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
  column-gap: 0;
}

.cell {
  padding: 0.25rem 0;
  font-size: 0.85rem;
  min-height: 80px;
}

.header {
  font-weight: bold;
  text-align: center;
  min-height: unset;
  padding: 0.25rem;
}

.day {
  border-top: 1px solid #ccc;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.day.drag-over {
  background: #f0f4ff;
  outline: 2px dashed #99b;
}

.day-number {
  font-size: 0.85rem;
  padding: 0 0.25rem;
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
}

.ticket-pill.is-end {
  border-radius: 0 999px 999px 0;
  padding-right: 0.1rem;
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
</style>
