<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTicketsStore } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'
import type { Ticket, Placement } from '../stores/tickets'

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

const dragOverDay = ref<number | null>(null)

function ticketColor(assignedTo: number | null): string {
  if (assignedTo === null) return '#ccc'
  return peopleStore.people.find((p) => p.id === assignedTo)?.color ?? '#ccc'
}

interface DayTicketInfo {
  ticket: Ticket
  placement: Placement
  isStart: boolean
  isEnd: boolean
}

function dayTicketInfos(day: number): DayTicketInfo[] {
  return ticketsStore
    .getPlacementsForDay(props.year, props.month, day)
    .map((placement) => {
      const ticket = ticketsStore.tickets.find((t) => t.id === placement.ticketId)
      if (!ticket) return null
      return { ticket, placement, isStart: placement.startDay === day, isEnd: placement.endDay === day }
    })
    .filter((x): x is DayTicketInfo => x !== null)
}

function onDragOver(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = day
}

function onDragLeave(event: DragEvent) {
  if ((event.currentTarget as Element).contains(event.relatedTarget as Node)) return
  dragOverDay.value = null
}

function onHandleDragStart(event: DragEvent, ticketId: number, side: 'start' | 'end') {
  event.stopPropagation()
  event.dataTransfer?.setData('resizeHandle', `${side}:${ticketId}`)
}

function onDrop(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = null

  const resizeHandle = event.dataTransfer?.getData('resizeHandle')
  if (resizeHandle) {
    const [side, id] = resizeHandle.split(':')
    ticketsStore.resizePlacement(Number(id), side as 'start' | 'end', day)
    return
  }

  const ticketId = event.dataTransfer?.getData('ticketId')
  if (ticketId) {
    ticketsStore.placeTicket(Number(ticketId), props.year, props.month, day)
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
        :class="{ 'drag-over': dragOverDay === day }"
        @dragover="onDragOver($event, day)"
        @dragleave="onDragLeave"
        @drop="onDrop($event, day)"
      >
        <span class="day-number">{{ day }}</span>
        <div class="placed-tickets">
          <div
            v-for="info in dayTicketInfos(day)"
            :key="info.ticket.id"
            class="ticket-pill"
            :class="{ 'is-start': info.isStart, 'is-end': info.isEnd }"
            :style="{ background: ticketColor(info.ticket.assignedTo) }"
            :title="info.ticket.title"
          >
            <button
              v-if="info.isStart"
              class="resize-handle"
              draggable="true"
              @dragstart="onHandleDragStart($event, info.ticket.id, 'start')"
            >‹</button>
            <span v-if="info.isStart" class="ticket-label">{{ info.ticket.number }}</span>
            <button
              v-if="info.isEnd"
              class="resize-handle"
              draggable="true"
              @dragstart="onHandleDragStart($event, info.ticket.id, 'end')"
            >›</button>
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

.ticket-pill {
  display: flex;
  align-items: center;
  min-height: 1.4rem;
  font-size: 0.72rem;
  font-weight: bold;
  color: #fff;
  overflow: hidden;
  /* middle segment: flat edges, full width */
  border-radius: 0;
  padding: 0.1rem 0;
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
