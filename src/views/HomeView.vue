<script setup lang="ts">
import { ref, computed } from 'vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import AddUserModal from '../components/AddUserModal.vue'
import { usePeopleStore } from '../stores/people'
import { useTicketsStore } from '../stores/tickets'
import AddTicketModal from '../components/AddTicketModal.vue'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth()
const selectedMonths = ref<number[]>([currentMonth, currentMonth + 1])
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
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <section>
        <h3>Months {{ currentYear }}</h3>
        <label v-for="(name, index) in MONTH_NAMES" :key="index" class="month-option">
          <input type="checkbox" :value="index" v-model="selectedMonths" />
          {{ name }}
        </label>
      </section>

      <section>
        <h3>People</h3>
        <button class="add-btn" @click="showAddPerson = true">+ Add Person</button>
        <ul class="people-list">
          <li v-for="person in people.people" :key="person.id" class="person">
            <span class="color-dot" :style="{ background: person.color }" />
            {{ person.name }}
          </li>
        </ul>
      </section>

      <section>
        <h3>Tickets</h3>
        <button class="add-btn" @click="showAddTicket = true">+ Add Ticket</button>
        <ul class="ticket-list">
          <li v-for="ticket in tickets.tickets" :key="ticket.id">
            <span
              class="ticket-pill"
              :style="{ background: ticketColor(ticket.assignedTo) }"
              :title="ticket.title"
              draggable="true"
              @dragstart="(e) => e.dataTransfer?.setData('ticketId', String(ticket.id))"
            >{{ ticket.number }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <main class="panel">
      <p v-if="selectedMonths.length === 0" class="empty">Select a month from the sidebar.</p>
      <MonthCalendar
        v-for="month in sortedMonths"
        :key="month"
        :year="currentYear"
        :month="month"
      />
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

h3 {
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
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

.panel {
  flex: 1;
  overflow-y: auto;
}

.empty {
  padding: 1rem;
  color: #888;
  font-size: 0.9rem;
}
</style>
