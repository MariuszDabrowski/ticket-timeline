<script setup lang="ts">
import { ref, computed, toRaw, nextTick } from 'vue'
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
import ExportModal from '../components/ExportModal.vue'
import ImportModal from '../components/ImportModal.vue'
import type { ProjectData } from '../utils/projectStorage'
import type { Ticket, CalendarDate } from '../stores/tickets'
import { importEpicCSV } from '../utils/epicCsv'
import { stateIcon } from '../utils/stateIcons'
import { useDragStateStore } from '../stores/dragState'
import { useOptionsStore } from '../stores/options'
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

function toggleSection(key: string) {
  openSection.value = openSection.value === key ? null : key
}

const collapsed = computed<Record<string, boolean>>(() => ({
  options: openSection.value !== 'options',
  months: openSection.value !== 'months',
  people: openSection.value !== 'people',
  tickets: openSection.value !== 'tickets',
  labels: openSection.value !== 'labels',
  sync: openSection.value !== 'sync',
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

function handleAddLabel(text: string, color: string) {
  tickets.addTicket({ number: '', title: text, assignedTo: null, link: '', isLabel: true, labelColor: color })
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

function handleAddTicket(ticket: { number: string; title: string; assignedTo: number | null; link: string; state: string | undefined; startDate: CalendarDate | null; endDate: CalendarDate | null }) {
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

function handleEditTicket(data: { number: string; title: string; assignedTo: number | null; link: string; state: string | undefined; startDate: CalendarDate | null; endDate: CalendarDate | null }) {
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
const options = useOptionsStore()
const ticketListIsOver = ref(false)

const ticketStates = computed(() => {
  const seen = new Set<string>()
  for (const t of tickets.tickets) if (t.state) seen.add(t.state)
  return [...seen].sort()
})

const calendarCountByPerson = computed(() => {
  const counts = new Map<number, number>()
  for (const placement of tickets.placements) {
    const ticket = tickets.tickets.find((t) => t.id === placement.ticketId)
    if (!ticket || ticket.isLabel || ticket.assignedTo === null) continue
    counts.set(ticket.assignedTo, (counts.get(ticket.assignedTo) ?? 0) + 1)
  }
  return counts
})

const calendarCountByState = computed(() => {
  const counts = new Map<string, number>()
  for (const placement of tickets.placements) {
    const ticket = tickets.tickets.find((t) => t.id === placement.ticketId)
    if (!ticket || ticket.isLabel || !ticket.state) continue
    counts.set(ticket.state, (counts.get(ticket.state) ?? 0) + 1)
  }
  return counts
})

const hasCalendarTickets = computed(() => tickets.placements.length > 0)

const unplacedTicketsByState = computed(() => {
  const grouped = new Map<string, Ticket[]>()
  const noState: Ticket[] = []
  for (const ticket of unplacedTickets.value) {
    if (ticket.state) {
      if (!grouped.has(ticket.state)) grouped.set(ticket.state, [])
      grouped.get(ticket.state)!.push(ticket)
    } else {
      noState.push(ticket)
    }
  }
  const result: { state: string | null; tickets: Ticket[]; start: number }[] = []
  let start = 1
  for (const state of ticketStates.value) {
    const group = grouped.get(state)
    if (group && group.length > 0) {
      result.push({ state, tickets: group, start })
      start += group.length
    }
  }
  if (noState.length > 0) result.push({ state: null, tickets: noState, start })
  return result
})

const openPanel = ref<'brief' | 'filters' | null>('brief')
function togglePanel(key: 'brief' | 'filters') {
  openPanel.value = openPanel.value === key ? null : key
}

const vacations = useVacationsStore()
const showExport = ref(false)
const showImport = ref(false)

const exportData = computed<Omit<ProjectData, 'name'>>(() => ({
  tickets: toRaw(tickets.tickets),
  placements: toRaw(tickets.placements),
  people: toRaw(people.people),
  vacations: toRaw(vacations.entries),
  selectedMonths: toRaw(selectedMonths.value),
}))

function handleImport(data: ProjectData) {
  people.loadData(data.people)
  tickets.loadData({ tickets: data.tickets, placements: data.placements })
  vacations.loadData(data.vacations ?? [])
  if (Array.isArray(data.selectedMonths) && data.selectedMonths.length > 0) {
    selectedMonths.value = data.selectedMonths
    visibleStart.value = Math.min(...data.selectedMonths)
    visibleEnd.value = Math.max(...data.selectedMonths)
  }
  showImport.value = false
}

const monthsRowRef = ref<HTMLElement | null>(null)
const monthsStackRef = ref<HTMLElement | null>(null)
const exportingImage = ref(false)
const flashToday = ref(false)

async function jumpToToday() {
  if (!selectedMonths.value.includes(currentAbs)) {
    selectedMonths.value = [...selectedMonths.value, currentAbs]
  }
  if (currentAbs < visibleStart.value) visibleStart.value = currentAbs
  if (currentAbs > visibleEnd.value) visibleEnd.value = currentAbs
  await nextTick()
  const calEl = monthsStackRef.value?.querySelector(`[data-calendar="${currentYear}-${currentMonth}"]`)
  calEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  flashToday.value = true
  setTimeout(() => { flashToday.value = false }, 2500)
}

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
        <button class="header-btn" @click="showImport = true">Import</button>
        <button class="header-btn" @click="showExport = true">Export</button>
      </div>
    </header>
    <div class="below-header">
    <aside class="sidebar">
      <section>
        <button class="section-header" @click="toggleSection('months')">
          <span>Months</span>
          <span class="chevron" :class="{ rotated: !collapsed.months }">›</span>
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
        <button class="section-header" @click="toggleSection('options')">
          <span>Options</span>
          <span class="chevron" :class="{ rotated: !collapsed.options }">›</span>
        </button>
        <div v-show="!collapsed.options" class="section-body">
          <label class="option">
            <input type="checkbox" v-model="options.hideWeekends" />
            Hide Weekends
          </label>
          <label class="option">
            <input type="checkbox" v-model="options.showAllTooltips" />
            Show Day Notes
          </label>
        </div>
      </section>

      <section>
        <button class="section-header" @click="toggleSection('people')">
          <span>People</span>
          <span class="chevron" :class="{ rotated: !collapsed.people }">›</span>
        </button>
        <div v-show="!collapsed.people" class="section-body">
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
      </section>

      <section
        class="ticket-section"
        :class="{ 'drop-target': ticketListIsOver }"
        @dragover="onTicketListDragOver"
        @dragleave="onTicketListDragLeave"
        @drop="onTicketListDrop"
      >
        <button class="section-header" @click="toggleSection('tickets')">
          <span>Tickets</span>
          <span class="chevron" :class="{ rotated: !collapsed.tickets }">›</span>
        </button>
        <div v-show="!collapsed.tickets" class="section-body">
          <button class="add-btn" @click="showAddTicket = true">Add Ticket</button>
          <button class="add-btn" @click="showUploadEpic = true">Upload Epic CSV</button>
          <div v-if="ticketStates.length > 0" class="state-legend">
            <div v-for="state in ticketStates" :key="state" class="legend-row">
              <span class="material-symbols-rounded legend-icon">{{ stateIcon(state) }}</span>
              <span class="legend-label">{{ state }}</span>
            </div>
          </div>
          <div v-if="unplacedTickets.length > 0" class="ticket-groups">
            <template v-for="group in unplacedTicketsByState" :key="group.state ?? '__none__'">
              <ol class="ticket-list" :start="group.start">
                <li v-for="ticket in group.tickets" :key="ticket.id">
                  <span
                    class="ticket-pill"
                    :class="{ dragging: draggingTicketId === ticket.id }"
                    :style="{ background: ticketColor(ticket.assignedTo) }"
                    draggable="true"
                    @click.stop="editingTicket = ticket"
                    @dragstart="(e) => { e.dataTransfer?.setData('ticketId', String(ticket.id)); draggingTicketId = ticket.id; dragState.startMoveDrag(ticket.id, 0) }"
                    @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
                  ><span v-if="ticket.state" class="material-symbols-rounded pill-state-icon">{{ stateIcon(ticket.state) }}</span>{{ ticket.number }}<div v-if="ticket.title" class="sidebar-pill-tooltip">{{ ticket.title }}</div></span>
                </li>
              </ol>
            </template>
          </div>
        </div>
      </section>

      <section>
        <button class="section-header" @click="toggleSection('labels')">
          <span>Labels</span>
          <span class="chevron" :class="{ rotated: !collapsed.labels }">›</span>
        </button>
        <div v-show="!collapsed.labels" class="section-body">
          <p class="label-blurb">Used to mark events on the calendar that aren't meant to be counted as a ticket, like buffers or product testing.</p>
          <button class="add-btn" @click="showAddLabel = true">Add Label</button>
          <ol v-if="unplacedLabels.length > 0" class="ticket-list">
            <li v-for="label in unplacedLabels" :key="label.id">
              <span
                class="ticket-pill label-pill"
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
      </section>

      <section>
        <button class="section-header" @click="toggleSection('sync')">
          <span>Sync</span>
          <span class="chevron" :class="{ rotated: !collapsed.sync }">›</span>
        </button>
        <div v-show="!collapsed.sync" class="section-body">
          <button class="add-btn" @click="showHiBob = true">HiBob Vacation Days</button>
          <button
            v-if="vacations.entries.length > 0"
            class="add-btn clear-sync-btn"
            @click="vacations.clearVacations()"
          >Clear Synced Data</button>
        </div>
      </section>

    </aside>


    <main class="panel">
      <p v-if="selectedMonths.length === 0" class="empty">Select a month from the sidebar.</p>
      <div class="months-row" ref="monthsRowRef">
        <div class="months-stack" ref="monthsStackRef">
          <div
            v-for="m in sortedMonths"
            :key="`${m.year}-${m.month}`"
            :data-calendar="`${m.year}-${m.month}`"
          >
            <MonthCalendar
              :year="m.year"
              :month="m.month"
              :flash-today="flashToday && m.year === currentYear && m.month === currentMonth"
            />
          </div>
          <div class="months-row-end" />
        </div>
        <div class="summary-column">
          <button class="jump-today-btn" @click="jumpToToday">Jump to Today</button>
          <div class="panel-section">
            <button class="panel-header" @click="togglePanel('filters')">
              <span>Calendar Filters</span>
              <span class="panel-chevron" :class="{ rotated: openPanel === 'filters' }">›</span>
            </button>
            <div v-show="openPanel === 'filters'" class="panel-body panel-body--filters">
              <template v-if="hasCalendarTickets">
                <p class="filter-hint">Uncheck to hide tickets on the calendar. Counts reflect only tickets placed on the calendar — those still in the sidebar are not included.</p>
                <div class="filter-divider" />
                <template v-if="people.people.some(p => calendarCountByPerson.get(p.id))">
                  <span class="filter-group-label">People</span>
                  <label v-for="person in people.people.filter(p => calendarCountByPerson.get(p.id))" :key="person.id" class="filter-option">
                    <input
                      type="checkbox"
                      :checked="!!calendarCountByPerson.get(person.id) && !options.hiddenPersonIds.has(person.id)"
                      :disabled="!calendarCountByPerson.get(person.id)"
                      @change="options.togglePersonVisibility(person.id)"
                    />
                    <span class="filter-dot" :style="{ background: person.color }" />
                    <span class="filter-name" :style="{ opacity: !calendarCountByPerson.get(person.id) ? 0.35 : 1 }">{{ person.name }}</span>
                    <span class="filter-count" :style="{ opacity: !calendarCountByPerson.get(person.id) ? 0.3 : 0.8 }">{{ calendarCountByPerson.get(person.id) ?? 0 }}</span>
                  </label>
                </template>
                <template v-if="ticketStates.some(s => calendarCountByState.get(s))">
                  <span class="filter-group-label" :style="{ marginTop: people.people.some(p => calendarCountByPerson.get(p.id)) ? '0.6rem' : '0' }">States</span>
                  <label v-for="state in ticketStates.filter(s => calendarCountByState.get(s))" :key="state" class="filter-option">
                    <input
                      type="checkbox"
                      :checked="!!calendarCountByState.get(state) && !options.hiddenStates.has(state)"
                      :disabled="!calendarCountByState.get(state)"
                      @change="options.toggleStateVisibility(state)"
                    />
                    <span class="filter-name" :style="{ opacity: !calendarCountByState.get(state) ? 0.35 : 1 }">{{ state }}</span>
                    <span class="filter-count" :style="{ opacity: !calendarCountByState.get(state) ? 0.3 : 0.8 }">{{ calendarCountByState.get(state) ?? 0 }}</span>
                  </label>
                </template>
              </template>
              <p v-else-if="people.people.length > 0 || ticketStates.length > 0" class="filter-hint filter-hint--empty">Add some tickets to the calendar to begin filtering.</p>
              <p v-else class="filter-hint filter-hint--empty">Add tickets to the calendar to get started.</p>
            </div>
          </div>

          <div class="panel-section">
            <button class="panel-header" @click="togglePanel('brief')">
              <span>Project Brief</span>
              <span class="panel-chevron" :class="{ rotated: openPanel === 'brief' }">›</span>
            </button>
            <div v-show="openPanel === 'brief'" class="panel-body">
              <SummaryTile />
            </div>
          </div>
        </div>
      </div>
    </main>
    </div>
  </div>

  <AddUserModal
    v-if="showAddPerson"
    @submit="handleAddPerson"
    @cancel="showAddPerson = false"
  />

  <AddUserModal
    v-if="editingPerson"
    :key="`edit-person-${editingPerson.id}`"
    :existing="editingPerson"
    @submit="handleEditPersonSave"
    @delete="handleEditPersonDelete"
    @cancel="editingPerson = null"
  />

  <AddTicketModal
    v-if="showAddTicket"
    :people="people.people"
    :states="ticketStates"
    @submit="handleAddTicket"
    @cancel="showAddTicket = false"
  />

  <AddLabelModal
    v-if="showAddLabel"
    @save="handleAddLabel"
    @delete="() => {}"
    @cancel="showAddLabel = false"
  />

  <AddLabelModal
    v-if="editingLabel"
    :existing="editingLabel"
    @save="handleSaveLabel"
    @delete="handleDeleteLabel"
    @cancel="editingLabel = null"
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
    :states="ticketStates"
    :placement="tickets.placements.find((p) => p.ticketId === editingTicket!.id) ?? null"
    @submit="handleEditTicket"
    @delete="handleDeleteTicket"
    @cancel="editingTicket = null"
  />

  <ExportModal
    v-if="showExport"
    :data="exportData"
    :exporting-image="exportingImage"
    @close="showExport = false"
    @export-image="(v) => handleExportImage(v)"
  />

  <ImportModal
    v-if="showImport"
    @load="handleImport"
    @close="showImport = false"
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
    @confirm="(matches, newPeople) => handleHiBobConfirm(matches, newPeople)"
    @cancel="hibobGroups = []"
  />
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
  padding: 0 1rem;
  flex-shrink: 0;
  background: linear-gradient(90deg, #191919 0%, #2a2a2a 60%, #242424 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 2px 14px rgba(0, 0, 0, 0.1);
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
  color: #fff;
  letter-spacing: 0.02em;
  transform: translateX(-3px);
}

.app-logo-icon {
  width: 32px;
  height: auto;
  flex-shrink: 0;
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
  background: linear-gradient(180deg, #363636 0%, #222222 100%);
  color: #fff;
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
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.25rem 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
  text-align: left;
  color: #fff;
}

.section-header::after {
  display: none;
}

.section-header > span:not(.chevron) {
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
  transition: text-decoration-color 0.15s;
}

.section-header:hover > span:not(.chevron) {
  text-decoration-color: rgba(255, 255, 255, 0.4);
}

.chevron {
  font-size: 20px;
  line-height: 1;
  transition: transform 0.2s ease;
  transform: rotate(90deg);
  opacity: 0.7;
  color: rgba(255, 255, 255, 0.8);
}

.chevron.rotated {
  transform: rotate(-90deg);
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.15rem 0 0.85rem;
}

.load-more-btn {
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
  color: rgba(255, 255, 255, 0.9);
  text-decoration-color: rgba(255, 255, 255, 0.4);
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
  transition: color 0.15s;
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

.label-blurb {
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

.ticket-groups {
  counter-reset: ticket-counter;
  margin-top: 0.5rem;
}

.pill-state-icon {
  font-size: 14px;
  line-height: 1;
  margin-right: 0.2em;
  vertical-align: middle;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  opacity: 0.92;
}

.state-legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 1rem 0.35rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  margin-bottom: 0.15rem;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.legend-icon {
  font-size: 16px;
  line-height: 1;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20;
}

.legend-label {
  flex: 1;
}

.ticket-list {
  list-style: none;
  padding: 0.1rem 1rem 0.25rem 1rem;
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
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: bold;
  color: #fff;
  cursor: grab;
  white-space: nowrap;
  overflow: visible;
  max-width: 100%;
}

.ticket-pill:active {
  cursor: grabbing;
}

.ticket-pill.dragging {
  opacity: 0.4;
}

.ticket-pill.dragging .sidebar-pill-tooltip {
  display: none;
}

.jump-today-btn {
  padding: 6px 1rem;
  font-size: 0.76rem;
  font-family: 'Nunito', sans-serif;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px dashed rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  line-height: 1;
  align-self: flex-start;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.jump-today-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}

.panel {
  flex: 1;
  overflow: auto;
  position: relative;
  z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
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
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: 0.65rem 1rem;
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  color: #fff;
  text-align: left;
}

.panel-header::after {
  display: none;
}

.panel-header > span:first-child {
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
  transition: text-decoration-color 0.15s;
}

.panel-header:hover > span:first-child {
  text-decoration-color: rgba(255, 255, 255, 0.4);
}

.panel-chevron {
  font-size: 20px;
  line-height: 1;
  transition: transform 0.2s ease;
  transform: rotate(90deg);
  opacity: 0.7;
  color: rgba(255, 255, 255, 0.8);
}

.panel-chevron.rotated {
  transform: rotate(-90deg);
}

.panel-body {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  max-height: calc(100vh - 6rem);
  overflow-y: auto;
}

.panel-body--filters {
  display: flex;
  flex-direction: column;
  padding: 0.4rem 0 0.75rem;
  font-size: 0.85rem;
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

.option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  padding: 0.15rem 1rem;
  color: rgba(255, 255, 255, 0.55);
  transition: color 0.15s;
}

.filter-group-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  padding: 0 1rem;
  margin-bottom: 0.35rem;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  padding: 0.15rem 1rem;
  color: rgba(255, 255, 255, 0.9);
  transition: color 0.15s;
}

.filter-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.filter-name {
  flex: 1;
}

.filter-count {
  font-size: 13px;
  opacity: 0.8;
  flex-shrink: 0;
}

.filter-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
  padding: 0.5rem 1rem 0.35rem;
  line-height: 1.4;
}

.filter-hint--empty {
  padding-bottom: 0.5rem;
}

.filter-divider {
  height: 1px;
  background: rgba(128, 128, 128, 0.2);
  margin: 0.5rem 1rem 0.75rem;
}

/* Custom checkboxes */
.option input[type='checkbox'],
.month-option input[type='checkbox'],
.filter-option input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  position: relative;
  transition: background 0.15s, border-color 0.15s;
}

.option input[type='checkbox']:checked,
.month-option input[type='checkbox']:checked,
.filter-option input[type='checkbox']:checked {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(255, 255, 255, 0.6);
}

.option input[type='checkbox']:checked::after,
.month-option input[type='checkbox']:checked::after,
.filter-option input[type='checkbox']:checked::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 1px;
  width: 5px;
  height: 8px;
  border: 2px solid #141414;
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}

.option input[type='checkbox']:hover,
.month-option input[type='checkbox']:hover,
.filter-option input[type='checkbox']:not(:disabled):hover {
  border-color: rgba(255, 255, 255, 0.45);
}

.empty {
  padding: 1rem;
  color: #888;
  font-size: 0.9rem;
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
