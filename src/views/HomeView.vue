<script setup lang="ts">
import { ref, computed, toRaw, onMounted } from 'vue'
import { decodeShareLink } from '../utils/shareLink'
import { toPng } from 'html-to-image'

import MonthCalendar from '../components/MonthCalendar.vue'
import AddUserModal from '../components/AddUserModal.vue'
import AppLogo from '../components/AppLogo.vue'
import { usePeopleStore } from '../stores/people'
import { useTicketsStore } from '../stores/tickets'
import AddTicketModal from '../components/AddTicketModal.vue'
import EditTicketModal from '../components/EditTicketModal.vue'
import UploadEpicModal from '../components/UploadEpicModal.vue'
import HiBobModal from '../components/HiBobModal.vue'
import HiBobConfirmModal from '../components/HiBobConfirmModal.vue'
import SummaryTile from '../components/SummaryTile.vue'
import AddLabelModal from '../components/AddLabelModal.vue'
import AddVacationModal from '../components/AddVacationModal.vue'
import SaveModal from '../components/SaveModal.vue'
import LoadModal from '../components/LoadModal.vue'
import type { ProjectData } from '../utils/projectStorage'
import type { Ticket, CalendarDate } from '../stores/tickets'
import { importEpicCSV } from '../utils/epicCsv'
import { useDragStateStore } from '../stores/dragState'
import { useVacationsStore } from '../stores/vacations'
import type { ICSPersonGroup } from '../utils/icsParser'


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
const visibleStart = ref(currentAbs)              // first pre-selected month
const visibleEnd   = ref(currentAbs + 3 + 3)     // last pre-selected + 3 unselected
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

const openSection = ref<string | null>(null)
const closingSection = ref<Set<string>>(new Set())

function toggleSection(key: string) {
  const wasOpen = openSection.value === key
  openSection.value = wasOpen ? null : key
  if (wasOpen) {
    closingSection.value = new Set([...closingSection.value, key])
    setTimeout(() => {
      closingSection.value = new Set([...closingSection.value].filter(k => k !== key))
    }, 500)
  }
}

const collapsed = computed<Record<string, boolean>>(() => ({
  months: openSection.value !== 'months',
  people: openSection.value !== 'people',
  tickets: openSection.value !== 'tickets',
  labels: openSection.value !== 'labels',
  vacations: openSection.value !== 'vacations',
  filters: openSection.value !== 'filters',
}))

const people = usePeopleStore()
const showAddPerson = ref(false)
const editingPerson = ref<typeof people.people[0] | null>(null)

function handleAddPerson(name: string, color: string) {
  people.addPerson(name, color)
  showAddPerson.value = false
  openSection.value = 'people'
}

function handleEditPersonSave(name: string, color: string) {
  if (editingPerson.value) people.updatePerson(editingPerson.value.id, { name, color })
  editingPerson.value = null
}

function handleEditPersonDelete() {
  if (editingPerson.value) handleRemovePerson(editingPerson.value.id)
  editingPerson.value = null
}

function handleRemovePerson(id: number) {
  tickets.tickets.forEach((t) => {
    if (t.assignedTo === id) tickets.updateTicket(t.id, { assignedTo: null })
  })
  vacations.removeVacationsForPerson(id)
  people.removePerson(id)
}

const tickets = useTicketsStore()
const showAddTicket = ref(false)
const showAddLabel = ref(false)
const editingLabel = ref<Ticket | null>(null)

function handleAddLabel(text: string, color: string, startDate: CalendarDate | null, endDate: CalendarDate | null) {
  const id = tickets.addTicket({ number: '', title: text, assignedTo: null, link: '', isLabel: true, labelColor: color })
  if (startDate) {
    tickets.placeTicket(id, startDate)
    tickets.moveTicket(id, startDate, endDate ?? startDate)
  }
  showAddLabel.value = false
}

function handleSaveLabel(text: string, color: string) {
  if (editingLabel.value) tickets.updateTicket(editingLabel.value.id, { title: text, labelColor: color })
  editingLabel.value = null
}

function handleDeleteLabel() {
  if (editingLabel.value) tickets.deleteTicket(editingLabel.value.id)
  editingLabel.value = null
}

function handleAddTicket(ticket: { number: string; title: string; assignedTo: number | null; link: string; startDate: CalendarDate | null; endDate: CalendarDate | null }) {
  const { startDate, endDate, ...ticketData } = ticket
  const id = tickets.addTicket(ticketData)
  if (startDate) {
    const end = endDate ?? startDate
    tickets.placeTicket(id, startDate)
    tickets.moveTicket(id, startDate, end)
  }
  showAddTicket.value = false
}

function ticketColor(assignedTo: number | null): string {
  if (assignedTo === null) return '#555'
  return people.people.find((p) => p.id === assignedTo)?.color ?? '#555'
}

const unplacedTickets = computed(() => {
  const placedIds = new Set(tickets.placements.map((p) => p.ticketId))
  return tickets.tickets
    .filter((t) => !t.isLabel && !placedIds.has(t.id))
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
})

const unplacedLabels = computed(() => {
  const placedIds = new Set(tickets.placements.map((p) => p.ticketId))
  return tickets.tickets.filter((t) => t.isLabel && !placedIds.has(t.id))
})

const showUploadEpic = ref(false)

function handleEpicImport(csvText: string, workspaceSlug: string) {
  importEpicCSV(csvText, people, tickets, workspaceSlug)
  showUploadEpic.value = false

  // Auto-select any months that have newly placed tickets
  const selected = new Set(selectedMonths.value)
  for (const p of tickets.placements) {
    for (const date of [p.startDate, p.endDate]) {
      const abs = date.year * 12 + date.month
      if (!selected.has(abs)) {
        selected.add(abs)
        if (abs < visibleStart.value) visibleStart.value = abs
        if (abs > visibleEnd.value) visibleEnd.value = abs
      }
    }
  }
  selectedMonths.value = [...selected]
}

const editingTicket = ref<Ticket | null>(null)

function handleEditTicket(data: { number: string; title: string; assignedTo: number | null; link: string; startDate: CalendarDate | null; endDate: CalendarDate | null }) {
  if (!editingTicket.value) return
  const id = editingTicket.value.id
  const { startDate, endDate, ...ticketData } = data
  tickets.updateTicket(id, ticketData)
  if (startDate) {
    const end = endDate ?? startDate
    if (!tickets.placements.find((p) => p.ticketId === id)) tickets.placeTicket(id, startDate)
    tickets.moveTicket(id, startDate, end)
  } else {
    tickets.removePlacement(id)
  }
  editingTicket.value = null
}

function handleDeleteTicket() {
  if (editingTicket.value) tickets.deleteTicket(editingTicket.value.id)
  editingTicket.value = null
}

const draggingTicketId = ref<number | null>(null)
const dragState = useDragStateStore()
const ticketListIsOver = ref(false)


const vacations = useVacationsStore()
const showAddVacation = ref(false)
const vacationModalPersonId = ref<number | null>(null)
const draggingPersonId = ref<number | null>(null)

function handleAddVacation(personId: number, startDate: CalendarDate | null, endDate: CalendarDate | null) {
  const id = vacations.addVacation(personId)
  if (startDate) vacations.placeVacation(id, startDate, endDate ?? startDate)
  showAddVacation.value = false
  vacationModalPersonId.value = null
}

function onVacationPersonClick(personId: number) {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  vacationModalPersonId.value = personId
  showAddVacation.value = true
}


const showSave = ref(false)
const showLoad = ref(false)
const currentProjectName = ref('your-project-name')

const saveData = computed<Omit<ProjectData, 'name'>>(() => ({
  tickets: toRaw(tickets.tickets),
  placements: toRaw(tickets.placements),
  people: toRaw(people.people),
  vacations: toRaw(vacations.entries),
  selectedMonths: toRaw(selectedMonths.value),
}))

function handleLoad(data: ProjectData) {
  people.loadData(data.people)
  tickets.loadData({ tickets: data.tickets, placements: data.placements })
  vacations.loadData(data.vacations ?? [])
  if (data.name) currentProjectName.value = data.name
  if (Array.isArray(data.selectedMonths) && data.selectedMonths.length > 0) {
    selectedMonths.value = data.selectedMonths
    visibleStart.value = Math.min(...data.selectedMonths)
    visibleEnd.value = Math.max(...data.selectedMonths)
  }
  showLoad.value = false
}

onMounted(() => {
  const match = window.location.hash.match(/[#&]share=([^&]+)/)
  if (!match) return
  const data = decodeShareLink(match[1]!)
  if (data) {
    handleLoad(data)
    history.replaceState(null, '', window.location.pathname)
  }
})

const monthsRowRef = ref<HTMLElement | null>(null)
const exportingImage = ref(false)

async function handleExportImage(includeSummary: boolean) {
  if (!monthsRowRef.value || exportingImage.value) return
  exportingImage.value = true
  const row = monthsRowRef.value
  const panel = row.parentElement as HTMLElement

  const summaryEl = row.firstElementChild as HTMLElement | null
  if (!includeSummary && summaryEl) summaryEl.style.display = 'none'

  // Temporarily remove overflow clipping so html-to-image renders the full content width
  const prevOverflow = panel.style.overflow
  panel.style.overflow = 'visible'

  try {
    const dataUrl = await toPng(row, {
      pixelRatio: 2,
      width: row.scrollWidth,
      height: row.scrollHeight,
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'ticket-timeline.png'
    a.click()
  } finally {
    panel.style.overflow = prevOverflow
    if (!includeSummary && summaryEl) summaryEl.style.display = ''
    exportingImage.value = false
  }
}

const showHiBob = ref(false)
const hibobGroups = ref<ICSPersonGroup[]>([])

function handleHiBobParsed(groups: ICSPersonGroup[]) {
  hibobGroups.value = groups
  showHiBob.value = false
}

function handleHiBobConfirm(
  matches: { personId: number; group: ICSPersonGroup }[],
  newPeople: { name: string; group: ICSPersonGroup }[],
) {
  for (const { name, group } of newPeople) {
    const personId = people.addPerson(name)
    matches.push({ personId, group })
  }
  if (newPeople.length > 0) openSection.value = 'people'
  vacations.addVacations(
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
    <header class="app-header">
      <span class="app-logo">
        <AppLogo class="app-logo-icon" />
        Ticket Timeline
      </span>
      <div class="header-actions">
        <button class="header-btn" @click="showLoad = true">Load</button>
        <button class="header-btn" @click="showSave = true">Save</button>
      </div>
    </header>
    <div class="below-header">
    <aside class="sidebar" v-simplebar>
      <section :class="{ 'drawer-open': !collapsed.months, 'drawer-closing': closingSection.has('months') }">
        <button class="section-header" @click="toggleSection('months')">
          <span>Months</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.months" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.months }">
          <div class="slide-inner">
            <div class="section-body">
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
          </div>
        </div>
      </section>

      <section :class="{ 'drawer-open': !collapsed.people, 'drawer-closing': closingSection.has('people') }">
        <button class="section-header" @click="toggleSection('people')">
          <span>People</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.people" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.people }">
          <div class="slide-inner">
            <div class="section-body">
              <p class="people-blurb">Importing tickets from Shortcut will auto-populate this list.</p>
              <button class="add-btn" @click="showAddPerson = true">Add Person</button>
              <ul v-if="people.people.length > 0" class="people-list">
                <li v-for="person in people.people" :key="person.id" class="person">
                  <span class="color-dot" :style="{ background: person.color }" />
                  <span
                    class="person-name"
                    @click="editingPerson = person"
                  >{{ person.name }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        :class="['ticket-section', { 'drawer-open': !collapsed.tickets, 'drawer-closing': closingSection.has('tickets'), 'drop-target': ticketListIsOver }]"
        @dragover="onTicketListDragOver"
        @dragleave="onTicketListDragLeave"
        @drop="onTicketListDrop"
      >
        <button class="section-header" @click="toggleSection('tickets')">
          <span>Tickets</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.tickets" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.tickets }">
          <div class="slide-inner">
            <div class="section-body">
              <button class="add-btn" @click="showAddTicket = true">Add Ticket</button>
              <button class="add-btn" @click="showUploadEpic = true">Upload Epic CSV</button>
              <ol v-if="unplacedTickets.length > 0" class="ticket-list">
                <li v-for="ticket in unplacedTickets" :key="ticket.id">
                  <span
                    class="ticket-pill"
                    :class="{ dragging: draggingTicketId === ticket.id }"
                    :style="{ background: ticketColor(ticket.assignedTo) }"
                    draggable="true"
                    @click.stop="editingTicket = ticket"
                    @dragstart="(e) => { e.dataTransfer?.setData('ticketId', String(ticket.id)); draggingTicketId = ticket.id; dragState.startMoveDrag(ticket.id, 0) }"
                    @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
                  >{{ ticket.number }}<div v-if="ticket.title" class="sidebar-pill-tooltip">{{ ticket.title }}</div></span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section :class="{ 'drawer-open': !collapsed.labels, 'drawer-closing': closingSection.has('labels') }">
        <button class="section-header" @click="toggleSection('labels')">
          <span>Events</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.labels" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.labels }">
          <div class="slide-inner">
            <div class="section-body">
              <p class="event-blurb">Used to mark events on the calendar that aren't meant to be counted as a ticket, like buffers or product testing.</p>
              <button class="add-btn" @click="showAddLabel = true">Add Event</button>
              <ol v-if="unplacedLabels.length > 0" class="ticket-list">
                <li v-for="label in unplacedLabels" :key="label.id">
                  <span
                    class="ticket-pill event-pill"
                    :class="{ dragging: draggingTicketId === label.id }"
                    :style="{ background: label.labelColor }"
                    draggable="true"
                    @click.stop="editingLabel = label"
                    @dragstart="(e) => { e.dataTransfer?.setData('ticketId', String(label.id)); draggingTicketId = label.id; dragState.startMoveDrag(label.id, 0) }"
                    @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
                  >{{ label.title }}</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section :class="{ 'drawer-open': !collapsed.vacations, 'drawer-closing': closingSection.has('vacations') }">
        <button class="section-header" @click="toggleSection('vacations')">
          <span>Vacations</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.vacations" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.vacations }">
          <div class="slide-inner">
            <div class="section-body">
              <button class="add-btn" @click="showHiBob = true">HiBob Vacation Days</button>
              <button
                v-if="vacations.entries.length > 0"
                class="add-btn clear-sync-btn"
                @click="vacations.clearVacations()"
              >Clear All Vacations</button>
              <p v-if="people.people.length === 0" class="people-blurb" style="padding-top:0.3rem">Add people to the team first.</p>
              <ul v-else class="people-list vacation-people-list">
                <li v-for="person in people.people" :key="person.id" class="person">
                  <span class="color-dot" :style="{ background: person.color }" />
                  <span
                    class="person-name vacation-person-draggable"
                    :class="{ dragging: draggingPersonId === person.id }"
                    draggable="true"
                    @click="onVacationPersonClick(person.id)"
                    @dragstart="(e) => { e.dataTransfer?.setData('newVacationPersonId', String(person.id)); draggingPersonId = person.id }"
                    @dragend="draggingPersonId = null"
                  >{{ person.name }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

    </aside>


    <main class="panel">
      <p v-if="selectedMonths.length === 0" class="empty">Select a month from the sidebar.</p>
      <div class="months-row" ref="monthsRowRef">
        <div class="months-stack">
          <div
            v-for="m in sortedMonths"
            :key="`${m.year}-${m.month}`"
          >
            <MonthCalendar
              :year="m.year"
              :month="m.month"
            />
          </div>
          <div class="months-row-end" />
        </div>
        <div class="summary-column">
          <div class="panel-section">
            <div class="panel-header-static">
              <span>Project Brief</span>
            </div>
            <div class="panel-body">
              <SummaryTile :project-name="currentProjectName" :selected-months="selectedMonths" />
            </div>
          </div>

        </div>
      </div>
    </main>
    </div>
  </div>

  <Transition name="modal">
    <AddUserModal
      v-if="showAddPerson"
      @submit="handleAddPerson"
      @cancel="showAddPerson = false"
    />
  </Transition>

  <Transition name="modal">
    <AddUserModal
      v-if="editingPerson"
      :key="`edit-person-${editingPerson.id}`"
      :existing="editingPerson"
      @submit="handleEditPersonSave"
      @delete="handleEditPersonDelete"
      @cancel="editingPerson = null"
    />
  </Transition>

  <Transition name="modal">
    <AddTicketModal
      v-if="showAddTicket"
      :people="people.people"
      @submit="handleAddTicket"
      @cancel="showAddTicket = false"
    />
  </Transition>

  <Transition name="modal">
    <AddLabelModal
      v-if="showAddLabel"
      @save="handleAddLabel"
      @delete="() => {}"
      @cancel="showAddLabel = false"
    />
  </Transition>

  <Transition name="modal">
    <AddLabelModal
      v-if="editingLabel"
      :existing="editingLabel"
      @save="handleSaveLabel"
      @delete="handleDeleteLabel"
      @cancel="editingLabel = null"
    />
  </Transition>

  <Transition name="modal">
    <UploadEpicModal
      v-if="showUploadEpic"
      @import="handleEpicImport"
      @cancel="showUploadEpic = false"
    />
  </Transition>

  <Transition name="modal">
    <EditTicketModal
      v-if="editingTicket"
      :ticket="editingTicket"
      :people="people.people"
      :placement="tickets.placements.find((p) => p.ticketId === editingTicket!.id) ?? null"
      @submit="handleEditTicket"
      @delete="handleDeleteTicket"
      @cancel="editingTicket = null"
    />
  </Transition>

  <Transition name="modal">
    <SaveModal
      v-if="showSave"
      :data="saveData"
      :initial-name="currentProjectName"
      :exporting-image="exportingImage"
      @close="showSave = false"
      @save="(name) => currentProjectName = name"
      @export-image="(v) => handleExportImage(v)"
    />
  </Transition>

  <Transition name="modal">
    <LoadModal
      v-if="showLoad"
      @load="handleLoad"
      @close="showLoad = false"
    />
  </Transition>

  <Transition name="modal">
    <AddVacationModal
      v-if="showAddVacation"
      :people="people.people"
      :preselected-person-id="vacationModalPersonId"
      @save="handleAddVacation"
      @cancel="showAddVacation = false; vacationModalPersonId = null"
    />
  </Transition>

  <Transition name="modal">
    <HiBobModal
      v-if="showHiBob"
      @parsed="handleHiBobParsed"
      @cancel="showHiBob = false"
    />
  </Transition>

  <Transition name="modal">
    <HiBobConfirmModal
      v-if="hibobGroups.length > 0"
      :groups="hibobGroups"
      :people="people.people"
      @confirm="(matches, newPeople) => handleHiBobConfirm(matches, newPeople)"
      @cancel="hibobGroups = []"
    />
  </Transition>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 2rem 0 1rem;
  flex-shrink: 0;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E"),
    linear-gradient(90deg, #191919 0%, #2a2a2a 60%, #242424 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0),
    0 2px 20px rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.app-logo {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 20px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.02em;
  transform: translateX(-3px);
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.07);
}

.app-logo-icon {
  width: 32px;
  height: auto;
  flex-shrink: 0;
  filter:
    drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))
    drop-shadow(0 -1px 0 rgba(255, 255, 255, 0.1));
}

.header-actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 0.4rem;
}

.header-btn {
  padding: 5px 1rem;
  font-family: 'Nunito', sans-serif;
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 2px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: rgba(255, 255, 255, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 1px rgba(255, 255, 255, 0.07),
    0 2px 5px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.25s ease;
}

.header-btn .icon {
  font-size: 14px;
  opacity: 0.8;
}


.below-header {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 230px;
  flex-shrink: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: #141414;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  contain: layout style;
}

section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.18);
  transition: background 0.25s ease;
}

section.drawer-open,
section.drawer-closing {
  background: rgba(0, 0, 0, 0.18);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.75rem 1rem;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
  text-align: left;
  color: rgba(255, 255, 255, 0.8);
  transition: background 0.25s ease;
}

.section-header::after {
  display: none;
}

section:not(.drawer-open):not(.drawer-closing) .section-header:hover {
  background: rgba(0, 0, 0, 0.18);
}

.chevron {
  position: relative;
  width: 24px;
  height: 24px;
  overflow: hidden;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.1);
  filter:
    drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.9))
    drop-shadow(0 1px 0px rgba(255, 255, 255, 0.08));
}

.chevron svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
}

.arrow-enter-active {
  transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
}

.arrow-leave-active {
  transition: transform 0.5s cubic-bezier(0.4, 0, 1, 1), opacity 0.35s ease;
}

.arrow-enter-from {
  transform: translateY(-500%);
  opacity: 0;
}

.arrow-enter-to {
  transform: translateY(0);
}

.arrow-leave-from {
  transform: translateY(0);
  opacity: 1;
}

.arrow-leave-to {
  transform: translateY(500%);
  opacity: 0;
}

.slide-wrap {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-wrap.slide-closed {
  grid-template-rows: 0fr;
  pointer-events: none;
}

.slide-inner {
  overflow: hidden;
  min-height: 0;
  opacity: 1;
  transition: opacity 0.35s ease 0.18s;
}

.slide-closed .slide-inner {
  opacity: 0;
  transition: opacity 0.18s ease;
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.15rem 0 0.85rem;
}

.section-body > * {
  flex-shrink: 0;
}

.load-more-btn {
  -webkit-appearance: none;
  appearance: none;
  background: none;
  border: none;
  padding: 0.15rem 1rem;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  color: rgba(255, 255, 255, 0.55);
  width: 100%;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
  transition: color 0.15s, text-decoration-color 0.15s;
}

.load-more-btn:hover {
  background: none;
  color: rgba(255, 255, 255, 0.9);
  text-decoration-color: rgba(255, 255, 255, 0.4);
}

.load-more-btn:hover::after {
  display: none;
}

.trim-btn {
}

.year-label {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 0.4rem 1rem 0.2rem;
  display: block;
}

.month-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  cursor: pointer;
  padding: 0.15rem 1rem;
  color: rgba(255, 255, 255, 0.55);
  border-radius: 0;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
  transition: color 0.15s, text-decoration-color 0.15s;
}

.month-option:hover {
  color: rgba(255, 255, 255, 0.9);
  text-decoration-color: rgba(255, 255, 255, 0.4);
}

.people-blurb {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
  padding: 0.3rem 1rem 0.5rem;
  margin: 0;
}

.event-blurb {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
  padding: 0 1rem 0.5rem;
  margin: 0;
}

.add-btn {
  font-size: 14px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 1px solid rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  padding: 10px 0.75rem 8px;
  margin: 0.15rem 1rem;
  width: calc(100% - 2rem);
  text-align: left;
  color: rgba(255, 255, 255, 0.7);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease, color 0.2s ease;
  letter-spacing: 0px;
  line-height: 1;
}

.add-btn:hover {
  color: rgba(255, 255, 255, 0.95);
}

.people-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  margin-top: 0.4rem;
}

.person {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 14px;
  padding: 0.15rem 1rem;
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.15s;
}

.person:hover {
  color: rgba(255, 255, 255, 0.9);
}

.person-name {
  flex: 1;
  cursor: pointer;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ticket-section {
  transition: background 0.1s;
}

.ticket-section.drop-target {
  background: rgba(255, 255, 255, 0.04);
  outline: 1px dashed rgba(255, 255, 255, 0.2);
}

.ticket-list {
  list-style: none;
  padding: 0.1rem 1rem 0.25rem 1rem;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
}

.ticket-list li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  counter-increment: ticket-counter;
}

.sidebar-pill-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  width: 180px;
  white-space: normal;
  line-height: 1.45;
  background: rgba(30, 30, 30, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 50;
  opacity: 0;
  transition: opacity 0.15s;
}

.sidebar-pill-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 1rem;
  border: 5px solid transparent;
  border-top-color: rgba(30, 30, 30, 0.97);
}

.ticket-pill:hover .sidebar-pill-tooltip {
  opacity: 1;
}

.ticket-list li::before {
  content: counter(ticket-counter) '.';
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.72rem;
  flex-shrink: 0;
  min-width: 1rem;
  text-align: right;
}

.ticket-pill {
  position: relative;
  display: inline-block;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  cursor: grab;
  white-space: nowrap;
  overflow: visible;
  max-width: 100%;
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.07);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

.ticket-pill:active {
  cursor: grabbing;
}

.ticket-pill.dragging {
  opacity: 0.4;
}

.ticket-pill.event-pill {
  position: relative;
  overflow: hidden;
}

.ticket-pill.event-pill::after {
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
}

.ticket-pill.dragging .sidebar-pill-tooltip {
  display: none;
}

.panel {
  flex: 1;
  overflow: auto;
  position: relative;
  z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
}

.months-row {
  display: flex;
  align-items: flex-start;
}

.summary-column {
  position: sticky;
  top: 2rem;
  align-self: flex-start;
  width: 280px;
  flex-shrink: 0;
  margin: 68px 2rem 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.panel-section {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.18);
}

.panel-header-static {
  padding: 0.65rem 1rem;
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #fff;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.05) 100%);
}

.panel-header-static span {
  background: linear-gradient(to right, #a78bfa 20%, #38bdf8 35%, #22d3ee 65%, #818cf8 80%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
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

.panel-body {
  border-top: 1px solid rgba(0, 0, 0, 0.2);
  max-height: calc(100vh - 6rem);
  overflow-y: auto;
}

.months-stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1;
  min-width: 0;
  padding: 0 2rem;
  box-sizing: border-box;
}


.months-row-end {
  width: 1.5rem;
  flex-shrink: 0;
}


/* Custom checkboxes */
.month-option input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  position: relative;
  overflow: visible;
  transition: background 0.15s, border-color 0.15s;
}

.month-option input[type='checkbox']:checked {
  background: rgba(167, 139, 250, 0.25);
  border-color: rgba(167, 139, 250, 0.6);
}

@keyframes checkDraw {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0% 0 0); }
}

.month-option input[type='checkbox']:checked::after {
  content: '';
  position: absolute;
  left: 6px;
  top: -3px;
  width: 6px;
  height: 12px;
  border: 2px solid rgba(200, 180, 255, 0.9);
  border-top: none;
  border-left: none;
  border-radius: 0 2px 2px 0;
  transform: rotate(45deg);
  animation: checkDraw 0.2s ease-out forwards;
}

.month-option input[type='checkbox']:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.empty {
  padding: 1rem;
  color: #888;
  font-size: 0.9rem;
}

.vacation-people-list {
  margin-top: 0.4rem;
}

.vacation-person-draggable {
  cursor: grab;
}

.vacation-person-draggable:active {
  cursor: grabbing;
}

.vacation-person-draggable.dragging {
  opacity: 0.4;
}

section.drawer-open .section-header > span:first-child {
  background: linear-gradient(to right, #a78bfa 20%, #38bdf8 35%, #22d3ee 65%, #818cf8 80%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 500% auto;
  animation: textShine 5s ease-in-out infinite alternate;
}

.clear-sync-btn {
  color: rgba(255, 255, 255, 0.45);
}

.clear-sync-btn:hover {
  color: rgba(231, 76, 60, 0.9);
}

@media (max-width: 1220px) {
  .months-row {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-column {
    width: auto;
    align-self: stretch;
    margin: 0;
    position: static;
    order: -1;
    padding: 2rem;
  }

  .panel-body {
    max-height: none;
  }
}

@media (max-width: 460px) {
  .app-header {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
    padding: 0.6rem 1rem;
    gap: 0.5rem;
  }
}

@media (max-width: 920px) {
  .below-header {
    flex-direction: column;
    overflow: auto;
  }

  .sidebar {
    width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-y: visible;
  }

  .panel {
    overflow: visible;
    flex: none;
  }

  .summary-column {
    padding: 0;
    margin: 1rem;
    align-self: auto;
  }

  .months-stack {
    padding: 0 1rem;
    overflow-x: auto;
  }
}
</style>
