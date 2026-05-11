<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import AddUserModal from '../components/AddUserModal.vue'
import { usePeopleStore } from '../stores/people'
import { useTicketsStore } from '../stores/tickets'
import AddTicketModal from '../components/AddTicketModal.vue'
import EditTicketModal from '../components/EditTicketModal.vue'
import UploadEpicModal from '../components/UploadEpicModal.vue'
import HiBobModal from '../components/HiBobModal.vue'
import HiBobConfirmModal from '../components/HiBobConfirmModal.vue'
import type { Ticket } from '../stores/tickets'
import { importEpicCSV } from '../utils/epicCsv'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
import { useVacationsStore } from '../stores/vacations'
import type { ICSPersonGroup } from '../utils/icsParser'

const vFocus = { mounted: (el: HTMLElement) => nextTick(() => el.focus()) }

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth()

// Absolute month key: year * 12 + month — spans across year boundaries
const currentAbs = currentYear * 12 + currentMonth
const selectedMonths = ref<number[]>([0, 1, 2, 3].map((i) => currentAbs + i))

// Range of months visible as checkboxes in the sidebar
const visibleStart = ref(currentYear * 12)        // Jan of current year
const visibleEnd   = ref(currentYear * 12 + 11)   // Dec of current year
function absToYearMonth(abs: number) {
  return { year: Math.floor(abs / 12), month: abs % 12 }
}

// Months to show in the sidebar, grouped by year
const monthsByYear = computed(() => {
  const groups: { year: number; months: number[] }[] = []
  for (let abs = visibleStart.value; abs <= visibleEnd.value; abs++) {
    const { year } = absToYearMonth(abs)
    const last = groups[groups.length - 1]
    if (last && last.year === year) last.months.push(abs)
    else groups.push({ year, months: [abs] })
  }
  return groups
})

function trimToSelection() {
  if (selectedMonths.value.length === 0) return
  visibleStart.value = Math.min(...selectedMonths.value)
  visibleEnd.value = Math.max(...selectedMonths.value)
}

const sortedMonths = computed(() =>
  [...selectedMonths.value].sort((a, b) => a - b).map(absToYearMonth)
)

const collapsed = ref<Record<string, boolean>>({
  options: false,
  months: false,
  people: false,
  tickets: false,
  sync: false,
})

const people = usePeopleStore()
const showAddPerson = ref(false)

function handleAddPerson(name: string) {
  people.addPerson(name)
  showAddPerson.value = false
}

function handleRemovePerson(id: number) {
  tickets.tickets.forEach((t) => {
    if (t.assignedTo === id) tickets.updateTicket(t.id, { assignedTo: null })
  })
  people.removePerson(id)
}

const editingPersonId = ref<number | null>(null)
const editingPersonName = ref('')

function startEditingPerson(id: number, name: string) {
  editingPersonId.value = id
  editingPersonName.value = name
}

function commitPersonName() {
  if (editingPersonId.value !== null && editingPersonName.value.trim()) {
    people.updatePersonName(editingPersonId.value, editingPersonName.value.trim())
  }
  editingPersonId.value = null
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

const showUploadEpic = ref(false)

function handleEpicImport(csvText: string, workspaceSlug: string) {
  importEpicCSV(csvText, people, tickets, workspaceSlug)
  showUploadEpic.value = false
}

const editingTicket = ref<Ticket | null>(null)

function handleEditTicket(data: { number: string; title: string; assignedTo: number | null; link: string }) {
  if (editingTicket.value) tickets.updateTicket(editingTicket.value.id, data)
  editingTicket.value = null
}

function handleDeleteTicket() {
  if (editingTicket.value) tickets.deleteTicket(editingTicket.value.id)
  editingTicket.value = null
}

const draggingTicketId = ref<number | null>(null)
const dragState = useDragStateStore()
const options = useOptionsStore()
const ticketListIsOver = ref(false)

const vacations = useVacationsStore()
const showHiBob = ref(false)
const hibobGroups = ref<ICSPersonGroup[]>([])

function handleHiBobParsed(groups: ICSPersonGroup[]) {
  hibobGroups.value = groups
  showHiBob.value = false
}

function handleHiBobConfirm(matches: { personId: number; group: ICSPersonGroup }[]) {
  vacations.setVacations(
    matches.flatMap(({ personId, group }) =>
      group.events.map((ev) => ({
        personId,
        startDate: ev.startDate,
        endDate: ev.endDate,
      }))
    )
  )
  hibobGroups.value = []
}


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
          <label class="option">
            <input type="checkbox" v-model="options.showAllTooltips" />
            Show Day Notes
          </label>
        </div>
      </section>

      <section>
        <button class="section-header" @click="collapsed.months = !collapsed.months">
          <span>Months</span>
          <span class="chevron" :class="{ rotated: collapsed.months }">›</span>
        </button>
        <div v-show="!collapsed.months" class="section-body">
          <button class="load-more-btn" @click="visibleStart -= 3">← 3 earlier</button>
          <template v-for="group in monthsByYear" :key="group.year">
            <span class="year-label">{{ group.year }}</span>
            <label v-for="abs in group.months" :key="abs" class="month-option">
              <input type="checkbox" :value="abs" v-model="selectedMonths" />
              {{ MONTH_NAMES[absToYearMonth(abs).month] }}
            </label>
          </template>
          <button class="load-more-btn" @click="visibleEnd += 3">3 later →</button>
          <button
            v-if="selectedMonths.length > 0"
            class="load-more-btn trim-btn"
            @click="trimToSelection"
          >Hide unselected</button>
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
              <input
                v-if="editingPersonId === person.id"
                class="person-name-input"
                v-model="editingPersonName"
                @blur="commitPersonName"
                @keydown.enter="commitPersonName"
                @keydown.escape="editingPersonId = null"
                v-focus
              />
              <span
                v-else
                class="person-name"
                title="Click to rename"
                @click="startEditingPerson(person.id, person.name)"
              >{{ person.name }}</span>
              <button class="remove-person-btn" @click="handleRemovePerson(person.id)" title="Remove person">×</button>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <button class="section-header" @click="collapsed.sync = !collapsed.sync">
          <span>Sync</span>
          <span class="chevron" :class="{ rotated: collapsed.sync }">›</span>
        </button>
        <div v-show="!collapsed.sync" class="section-body">
          <button class="add-btn" @click="showHiBob = true">↓ HiBob Vacation Days</button>
          <button
            v-if="vacations.entries.length > 0"
            class="add-btn clear-sync-btn"
            @click="vacations.clearVacations()"
          >✕ Clear Synced Data</button>
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
          <button class="add-btn" @click="showUploadEpic = true">+ Upload Epic CSV</button>
          <ol class="ticket-list">
            <li v-for="ticket in unplacedTickets" :key="ticket.id">
              <span
                class="ticket-pill"
                :class="{ dragging: draggingTicketId === ticket.id }"
                :style="{ background: ticketColor(ticket.assignedTo) }"
                :title="ticket.title"
                draggable="true"
                @click.stop="editingTicket = ticket"
                @dragstart="(e) => { e.dataTransfer?.setData('ticketId', String(ticket.id)); draggingTicketId = ticket.id; dragState.startMoveDrag(ticket.id, 0) }"
                @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
              >{{ ticket.number }}</span>
            </li>
          </ol>
        </div>
      </section>
    </aside>


    <main class="panel">
      <p v-if="selectedMonths.length === 0" class="empty">Select a month from the sidebar.</p>
      <div class="months-row">
        <MonthCalendar
          v-for="m in sortedMonths"
          :key="`${m.year}-${m.month}`"
          :year="m.year"
          :month="m.month"
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

  <UploadEpicModal
    v-if="showUploadEpic"
    @import="handleEpicImport"
    @cancel="showUploadEpic = false"
  />

  <EditTicketModal
    v-if="editingTicket"
    :ticket="editingTicket"
    :people="people.people"
    @submit="handleEditTicket"
    @delete="handleDeleteTicket"
    @cancel="editingTicket = null"
  />

  <HiBobModal
    v-if="showHiBob"
    @parsed="handleHiBobParsed"
    @cancel="showHiBob = false"
  />

  <HiBobConfirmModal
    v-if="hibobGroups.length > 0"
    :groups="hibobGroups"
    :people="people.people"
    @confirm="handleHiBobConfirm"
    @cancel="hibobGroups = []"
  />
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 230px;
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
  color: inherit;
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

.load-more-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.78rem;
  cursor: pointer;
  text-align: left;
  color: inherit;
  opacity: 0.6;
}

.load-more-btn:hover {
  opacity: 1;
}

.trim-btn {
  margin-top: 0.25rem;
  opacity: 0.4;
  font-style: italic;
}

.year-label {
  font-size: 0.72rem;
  font-weight: bold;
  opacity: 0.45;
  margin-top: 0.25rem;
  display: block;
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
  color: inherit;
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

.person-name {
  flex: 1;
  cursor: pointer;
}

.person-name:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
}

.person-name-input {
  flex: 1;
  font-size: 0.9rem;
  border: none;
  border-bottom: 1px solid #888;
  background: transparent;
  color: inherit;
  padding: 0;
  outline: none;
  min-width: 0;
}

.remove-person-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.1rem;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}

.person:hover .remove-person-btn {
  opacity: 1;
}

.remove-person-btn:hover {
  color: #c0392b;
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
  list-style: decimal;
  margin-top: 0.5rem;
  padding-left: 1.2rem;
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

.clear-sync-btn {
  color: #c0392b;
  border-color: #c0392b;
  opacity: 0.8;
}

.clear-sync-btn:hover {
  opacity: 1;
}
</style>
