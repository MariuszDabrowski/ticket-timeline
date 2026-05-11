<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTicketsStore } from '../stores/tickets'
import { usePeopleStore } from '../stores/people'

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

function placedTickets(day: number) {
  return ticketsStore
    .getPlacementsForDay(props.year, props.month, day)
    .map((p) => ticketsStore.tickets.find((t) => t.id === p.ticketId))
    .filter(Boolean)
}

function onDragOver(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = day
}

function onDragLeave() {
  dragOverDay.value = null
}

function onDrop(event: DragEvent, day: number) {
  event.preventDefault()
  dragOverDay.value = null
  const ticketId = event.dataTransfer?.getData('ticketId')
  if (!ticketId) return
  ticketsStore.placeTicket(Number(ticketId), props.year, props.month, day)
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
          <span
            v-for="ticket in placedTickets(day)"
            :key="ticket!.id"
            class="ticket-pill"
            :style="{ background: ticketColor(ticket!.assignedTo) }"
            :title="ticket!.title"
          >{{ ticket!.number }}</span>
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
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: bold;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  cursor: default;
}
</style>
