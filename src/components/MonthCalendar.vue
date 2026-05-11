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

// Resize drag stays local — handles are only visible in their own month
const resizeDrag = ref<{ ticketId: number; side: 'start' | 'end' } | null>(null)
const resizePreviewDay = ref<number | null>(null)
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
  if (resizeDrag.value?.ticketId === placement.ticketId && resizePreviewDay.value !== null) {
    const previewDate = calDate(resizePreviewDay.value)
    if (resizeDrag.value.side === 'start' && compareCalendarDates(previewDate, placement.endDate) <= 0)
      return { ...placement, startDate: previewDate }
    if (resizeDrag.value.side === 'end' && compareCalendarDates(previewDate, placement.startDate) >= 0)
      return { ...placement, endDate: previewDate }
  }
  if (dragState.moveDrag?.ticketId === placement.ticketId && dragState.movePreviewDate) {
    const newStart = dragState.movePreviewDate
    return { ...placement, startDate: newStart, endDate: addDays(newStart, dragState.moveDrag.span) }
  }
  return placement
}

// Stable slot assignment from original placements for tickets that belong to this month
const slotMap = computed(() => {
  const monthPlacements = ticketsStore
    .getPlacementsForMonth(props.year, props.month)
    .slice()
    .sort((a, b) => compareCalendarDates(a.startDate, b.startDate))

  const map = new Map<number, number>()
  const slotEndDates: CalendarDate[] = []

  for (const p of monthPlacements) {
    const slot = slotEndDates.findIndex((end) => compareCalendarDates(end, p.startDate) < 0)
    const assigned = slot === -1 ? slotEndDates.length : slot
    slotEndDates[assigned] = p.endDate
    map.set(p.ticketId, assigned)
  }

  return map
})

// A ticket being dragged from another month into this one — needs an extra preview slot
const foreignPreview = computed(() => {
  const { moveDrag, movePreviewDate } = dragState
  if (!moveDrag || !movePreviewDate) return null
  if (slotMap.value.has(moveDrag.ticketId)) return null // already has a slot here
  const previewStart = movePreviewDate
  const previewEnd = addDays(previewStart, moveDrag.span)
  const monthStart: CalendarDate = { year: props.year, month: props.month, day: 1 }
  const monthEnd: CalendarDate = { year: props.year, month: props.month, day: daysInMonth.value }
  if (compareCalendarDates(previewStart, monthEnd) > 0) return null
  if (compareCalendarDates(previewEnd, monthStart) < 0) return null
  return { ticketId: moveDrag.ticketId, startDate: previewStart, endDate: previewEnd }
})

const totalSlots = computed(() => {
  const base = slotMap.value.size === 0 ? 0 : Math.max(...slotMap.value.values()) + 1
  return foreignPreview.value ? base + 1 : base
})

interface DayTicketInfo {
  ticket: Ticket
  placement: Placement
  isStart: boolean
  isEnd: boolean
  isMoving: boolean
}

function daySlots(day: number): (DayTicketInfo | null)[] {
  const thisDate = calDate(day)
  const slots: (DayTicketInfo | null)[] = Array(totalSlots.value).fill(null)

  // Tickets originally belonging to this month
  for (const placement of ticketsStore.getPlacementsForMonth(props.year, props.month)) {
    const eff = effectivePlacement(placement)
    if (compareCalendarDates(eff.startDate, thisDate) > 0) continue
    if (compareCalendarDates(thisDate, eff.endDate) > 0) continue
    const ticket = ticketsStore.tickets.find((t) => t.id === placement.ticketId)
    if (!ticket) continue
    const slot = slotMap.value.get(placement.ticketId)
    if (slot === undefined) continue
    slots[slot] = {
      ticket,
      placement: eff,
      isStart: compareCalendarDates(eff.startDate, thisDate) === 0,
      isEnd: compareCalendarDates(eff.endDate, thisDate) === 0,
      isMoving: dragState.moveDrag?.ticketId === placement.ticketId,
    }
  }

  // Foreign ticket being dragged into this month
  if (foreignPreview.value) {
    const fp = foreignPreview.value
    const previewSlot = totalSlots.value - 1
    if (
      compareCalendarDates(fp.startDate, thisDate) <= 0 &&
      compareCalendarDates(thisDate, fp.endDate) <= 0
    ) {
      const ticket = ticketsStore.tickets.find((t) => t.id === fp.ticketId)
      if (ticket) {
        slots[previewSlot] = {
          ticket,
          placement: { ticketId: fp.ticketId, startDate: fp.startDate, endDate: fp.endDate },
          isStart: compareCalendarDates(fp.startDate, thisDate) === 0,
          isEnd: compareCalendarDates(fp.endDate, thisDate) === 0,
          isMoving: true,
        }
      }
    }
  }

  return slots
}

function onDragOver(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = day
  if (resizeDrag.value) resizePreviewDay.value = day
  if (dragState.moveDrag) dragState.updateMovePreview(calDate(day))
}

function onDragLeave(event: DragEvent) {
  if ((event.currentTarget as Element).contains(event.relatedTarget as Node)) return
  dragOverDay.value = null
}

function onHandleDragStart(event: DragEvent, ticketId: number, side: 'start' | 'end') {
  event.stopPropagation()
  event.dataTransfer?.setData('resizeHandle', `${side}:${ticketId}`)
  resizeDrag.value = { ticketId, side }
  resizePreviewDay.value = null
}

function onTicketDragStart(event: DragEvent, info: DayTicketInfo) {
  event.dataTransfer?.setData('moveCalendarTicket', String(info.ticket.id))
  dragState.startMoveDrag(
    info.ticket.id,
    spanInDays(info.placement.startDate, info.placement.endDate),
  )
}

function clearResizeDrag() {
  resizeDrag.value = null
  resizePreviewDay.value = null
}

function onDrop(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = null

  const resizeHandle = event.dataTransfer?.getData('resizeHandle')
  if (resizeHandle) {
    const [side, id] = resizeHandle.split(':')
    ticketsStore.resizePlacement(Number(id), side as 'start' | 'end', calDate(day))
    clearResizeDrag()
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
        :class="{ 'drag-over': dragOverDay === day && !resizeDrag && !dragState.moveDrag }"
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
                'is-preview': resizeDrag?.ticketId === info.ticket.id || info.isMoving,
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
                @dragend="clearResizeDrag"
              >‹</button>
              <span v-if="info.isStart" class="ticket-label">{{ info.ticket.number }}</span>
              <button
                v-if="info.isEnd"
                class="resize-handle"
                draggable="true"
                @dragstart="onHandleDragStart($event, info.ticket.id, 'end')"
                @dragend="clearResizeDrag"
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
  gap: 2px;
}

.cell {
  padding: 0.25rem;
  font-size: 0.85rem;
  min-height: 80px;
}

.header {
  font-weight: bold;
  text-align: center;
  min-height: unset;
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
  overflow: hidden;
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
