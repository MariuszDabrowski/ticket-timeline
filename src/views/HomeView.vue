<script setup lang="ts">
import { ref, computed } from 'vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import AddUserModal from '../components/AddUserModal.vue'
import { usePeopleStore } from '../stores/people'
import { useTicketsStore } from '../stores/tickets'
import AddTicketModal from '../components/AddTicketModal.vue'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth()
const selectedMonths = ref<number[]>([currentMonth, currentMonth + 1])

const collapsed = ref<Record<string, boolean>>({
  options: false,
  months: false,
  people: false,
  tickets: false,
})
const sortedMonths = computed(() => [...selectedMonths.value].sort((a, b) => a - b))

const people = usePeopleStore()
const showAddPerson = ref(false)

function handleAddPerson(name: string) {
  people.addPerson(name)
  showAddPerson.value = false
}

const tickets = useTicketsStore()
const showAddTicket = ref(false)

function handleAddTicket(ticket: { number: string; title: string; assignedTo: number | null; link: string }) {
  tickets.addTicket(ticket)
  showAddTicket.value = false
}

function ticketColor(assignedTo: number | null): string {
  if (assignedTo === null) return '#ccc'
  return people.people.find((p) => p.id === assignedTo)?.color ?? '#ccc'
}

const unplacedTickets = computed(() => {
  const placedIds = new Set(tickets.placements.map((p) => p.ticketId))
  return tickets.tickets.filter((t) => !placedIds.has(t.id))
})

const draggingTicketId = ref<number | null>(null)
const dragState = useDragStateStore()
const options = useOptionsStore()
const ticketListIsOver = ref(false)

function onTicketListDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('movecalendarticket')) return
  event.preventDefault()
  ticketListIsOver.value = true
}

function onTicketListDragLeave() {
  ticketListIsOver.value = false
}

function onTicketListDrop(event: DragEvent) {
  ticketListIsOver.value = false
  const id = event.dataTransfer?.getData('moveCalendarTicket')
  if (!id) return
  event.preventDefault()
  tickets.removePlacement(Number(id))
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <section>
        <button class="section-header" @click="collapsed.options = !collapsed.options">
          <span>Options</span>
          <span class="chevron" :class="{ rotated: collapsed.options }">›</span>
        </button>
        <div v-show="!collapsed.options" class="section-body">
          <label class="option">
            <input type="checkbox" v-model="options.hideWeekends" />
            Hide Weekends
          </label>
          <label class="option">
            <input type="checkbox" v-model="options.showCanadianHolidays" />
            Canadian Holidays
          </label>
          <label class="option">
            <input type="checkbox" v-model="options.showAmericanHolidays" />
            American Holidays
          </label>
        </div>
      </section>

      <section>
        <button class="section-header" @click="collapsed.months = !collapsed.months">
          <span>Months {{ currentYear }}</span>
          <span class="chevron" :class="{ rotated: collapsed.months }">›</span>
        </button>
        <div v-show="!collapsed.months" class="section-body">
          <label v-for="(name, index) in MONTH_NAMES" :key="index" class="month-option">
            <input type="checkbox" :value="index" v-model="selectedMonths" />
            {{ name }}
          </label>
        </div>
      </section>

      <section>
        <button class="section-header" @click="collapsed.people = !collapsed.people">
          <span>People</span>
          <span class="chevron" :class="{ rotated: collapsed.people }">›</span>
        </button>
        <div v-show="!collapsed.people" class="section-body">
          <button class="add-btn" @click="showAddPerson = true">+ Add Person</button>
          <ul class="people-list">
            <li v-for="person in people.people" :key="person.id" class="person">
              <span class="color-dot" :style="{ background: person.color }" />
              {{ person.name }}
            </li>
          </ul>
        </div>
      </section>

      <section
        class="ticket-section"
        :class="{ 'drop-target': ticketListIsOver }"
        @dragover="onTicketListDragOver"
        @dragleave="onTicketListDragLeave"
        @drop="onTicketListDrop"
      >
        <button class="section-header" @click="collapsed.tickets = !collapsed.tickets">
          <span>Tickets</span>
          <span class="chevron" :class="{ rotated: collapsed.tickets }">›</span>
        </button>
        <div v-show="!collapsed.tickets" class="section-body">
          <button class="add-btn" @click="showAddTicket = true">+ Add Ticket</button>
          <ul class="ticket-list">
            <li v-for="ticket in unplacedTickets" :key="ticket.id">
              <span
                class="ticket-pill"
                :class="{ dragging: draggingTicketId === ticket.id }"
                :style="{ background: ticketColor(ticket.assignedTo) }"
                :title="ticket.title"
                draggable="true"
                @dragstart="(e) => { e.dataTransfer?.setData('ticketId', String(ticket.id)); draggingTicketId = ticket.id; dragState.startMoveDrag(ticket.id, 0) }"
                @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
              >{{ ticket.number }}</span>
            </li>
          </ul>
        </div>
      </section>
    </aside>


    <main class="panel">
      <p v-if="selectedMonths.length === 0" class="empty">Select a month from the sidebar.</p>
      <div class="months-row">
        <MonthCalendar
          v-for="month in sortedMonths"
          :key="month"
          :year="currentYear"
          :month="month"
        />
      </div>
    </main>
  </div>

  <AddUserModal
    v-if="showAddPerson"
    @submit="handleAddPerson"
    @cancel="showAddPerson = false"
  />

  <AddTicketModal
    v-if="showAddTicket"
    :people="people.people"
    @submit="handleAddTicket"
    @cancel="showAddTicket = false"
  />
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid #ccc;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  text-align: left;
  margin-bottom: 0.5rem;
}

.chevron {
  font-size: 1rem;
  line-height: 1;
  transition: transform 0.15s;
  transform: rotate(90deg);
}

.chevron.rotated {
  transform: rotate(-90deg);
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.month-option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.add-btn {
  font-size: 0.85rem;
  cursor: pointer;
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.3rem 0.6rem;
  width: 100%;
  text-align: left;
}

.people-list {
  list-style: none;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.person {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ticket-section {
  border-radius: 4px;
  transition: background 0.1s, outline 0.1s;
}

.ticket-section.drop-target {
  background: #f0f4ff;
  outline: 2px dashed #99b;
}

.ticket-list {
  list-style: none;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.ticket-pill {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: bold;
  color: #fff;
  cursor: grab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.ticket-pill:active {
  cursor: grabbing;
}

.ticket-pill.dragging {
  opacity: 0.4;
  outline: 2px dashed currentColor;
  outline-offset: 2px;
}

.panel {
  flex: 1;
  overflow: auto;
}

.months-row {
  display: flex;
  align-items: flex-start;
}

.option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
  user-select: none;
}

.empty {
  padding: 1rem;
  color: #888;
  font-size: 0.9rem;
}
</style>
