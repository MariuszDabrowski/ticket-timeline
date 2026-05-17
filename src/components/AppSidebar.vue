<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue'
import { usePeopleStore, type Person } from '../stores/people'
import { useTicketsStore, type Ticket } from '../stores/tickets'
import { useVacationsStore, type VacationEntry } from '../stores/vacations'
import { compactCalendarLayout } from '../utils/layout'
import { colorForPerson, pillGradient } from '../utils/colors'
import { suppressNativeDragImage } from '../utils/drag'
import { useDragStateStore } from '../stores/dragState'
import { useUndoStack } from '../composables/useUndoStack'
import { useRejectionToast } from '../composables/useRejectionToast'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const props = defineProps<{
  selectedMonths: number[]
  bugReportUrl: string
}>()

const emit = defineEmits<{
  'update:selectedMonths': [value: number[]]
  'open-add-person': []
  'open-add-ticket': []
  'open-add-label': []
  'open-upload-epic': []
  'open-hibob': []
  'edit-person': [person: Person]
  'edit-ticket': [ticket: Ticket]
  'edit-label': [label: Ticket]
  'vacation-person-clicked': [personId: number]
}>()

const { showRejection } = useRejectionToast()

const selectedMonthsProxy = computed<number[]>({
  get: () => props.selectedMonths,
  set: (value) => {
    if (value.length === 0) {
      showRejection('At least one month must be selected')
      // Re-emit the existing selection as a new array reference. Vue's checkbox
      // v-model lets the browser flip the DOM before the setter runs; if we just
      // bail without emitting, the source value never "changes" so Vue doesn't
      // re-render, and the checkbox stays visually unchecked. Emitting a new
      // array reference forces a re-render and snaps it back to checked.
      emit('update:selectedMonths', [...props.selectedMonths])
      return
    }
    emit('update:selectedMonths', value)
  },
})

const people = usePeopleStore()
const tickets = useTicketsStore()
const vacations = useVacationsStore()
const dragState = useDragStateStore()
const undoStack = useUndoStack()

const ticketsSectionEl = useTemplateRef<HTMLElement>('ticketsSectionEl')

// Sidebar month picker — controls how many month checkboxes are shown
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth()
const currentAbs = currentYear * 12 + currentMonth
const visibleStart = ref(currentAbs)
// Default selection covers current + 2 ahead (3 months). Show 2 extra in the
// sidebar so the user has room to extend the timeline without us cluttering
// the list with months they're unlikely to need yet.
const visibleEnd = ref(currentAbs + 2 + 2)

function absToYearMonth(abs: number) {
  return { year: Math.floor(abs / 12), month: abs % 12 }
}

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
  if (props.selectedMonths.length === 0) return
  visibleStart.value = Math.min(...props.selectedMonths)
  visibleEnd.value = Math.max(...props.selectedMonths)
}

// Section expand/collapse
const openSection = ref<string | null>(null)
const closingSection = ref<Set<string>>(new Set())

function toggleSection(key: string) {
  const wasOpen = openSection.value === key
  openSection.value = wasOpen ? null : key
  if (wasOpen) {
    closingSection.value = new Set([...closingSection.value, key])
    setTimeout(() => {
      closingSection.value = new Set([...closingSection.value].filter((k) => k !== key))
    }, 500)
  }
}

const collapsed = computed<Record<string, boolean>>(() => ({
  months: openSection.value !== 'months',
  people: openSection.value !== 'people',
  tickets: openSection.value !== 'tickets',
  labels: openSection.value !== 'labels',
  vacations: openSection.value !== 'vacations',
}))

// Open the People section after a successful HiBob import etc.
function openPeopleSection() {
  openSection.value = 'people'
}

// Extend the visible month-checkbox range so that the given range stays in view.
// Called when loading a project or after a CSV import places tickets in months
// outside the currently rendered range.
function expandVisibleRange(start: number, end: number) {
  if (start < visibleStart.value) visibleStart.value = start
  if (end > visibleEnd.value) visibleEnd.value = end
}
defineExpose({ openPeopleSection, expandVisibleRange, ticketsSectionEl })

// Sidebar ticket-pill data — thin wrapper so existing call sites stay legible.
function ticketColor(assignedTo: number | null): string {
  return colorForPerson(assignedTo, people.people)
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

// Drag-from-calendar-back-to-sidebar drop handlers
const draggingTicketId = ref<number | null>(null)
const draggingPersonId = ref<number | null>(null)
const ticketListIsOver = ref(false)
const eventListIsOver = ref(false)
const vacationListIsOver = ref(false)

function onTicketListDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('movecalendarticket')) return
  const id = dragState.moveDrag?.ticketId
  if (id != null && tickets.tickets.find((t) => t.id === id)?.isLabel) return
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
  const prev = tickets.placements.find((p) => p.ticketId === Number(id))
  tickets.removePlacement(Number(id))
  compactCalendarLayout(tickets, vacations)
  if (prev) {
    const oldStart = prev.startDate
    const oldEnd = prev.endDate
    const oldRow = prev.row
    undoStack.push(() => {
      tickets.placeTicket(Number(id), oldStart, oldRow)
      tickets.moveTicket(Number(id), oldStart, oldEnd)
    })
  }
}

function onEventListDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('movecalendarticket')) return
  const id = dragState.moveDrag?.ticketId
  if (id != null && !tickets.tickets.find((t) => t.id === id)?.isLabel) return
  event.preventDefault()
  eventListIsOver.value = true
}

function onEventListDragLeave() {
  eventListIsOver.value = false
}

function onEventListDrop(event: DragEvent) {
  eventListIsOver.value = false
  const id = event.dataTransfer?.getData('moveCalendarTicket')
  if (!id) return
  event.preventDefault()
  const prev = tickets.placements.find((p) => p.ticketId === Number(id))
  tickets.removePlacement(Number(id))
  compactCalendarLayout(tickets, vacations)
  if (prev) {
    const oldStart = prev.startDate
    const oldEnd = prev.endDate
    const oldRow = prev.row
    undoStack.push(() => {
      tickets.placeTicket(Number(id), oldStart, oldRow)
      tickets.moveTicket(Number(id), oldStart, oldEnd)
    })
  }
}

function onVacationListDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('movecalendarvacation')) return
  event.preventDefault()
  vacationListIsOver.value = true
}

function onVacationListDragLeave() {
  vacationListIsOver.value = false
}

function onVacationListDrop(event: DragEvent) {
  vacationListIsOver.value = false
  const id = event.dataTransfer?.getData('moveCalendarVacation')
  if (!id) return
  event.preventDefault()
  const prev: VacationEntry | undefined = vacations.entries.find((v) => v.id === Number(id))
  vacations.removeVacation(Number(id))
  compactCalendarLayout(tickets, vacations)
  if (prev && prev.startDate && prev.endDate) {
    const personId = prev.personId
    const oldStart = prev.startDate
    const oldEnd = prev.endDate
    undoStack.push(() => {
      const newId = vacations.addVacation(personId)
      vacations.placeVacation(newId, oldStart, oldEnd)
    })
  }
  dragState.clearVacationMoveDrag()
}

// Click on a vacation person pill (mobile-only opens a modal; desktop is drag-only)
function onVacationPersonClick(personId: number) {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  emit('vacation-person-clicked', personId)
}
</script>

<template>
  <div class="sidebar-wrap">
    <aside class="sidebar" v-simplebar>
      <section :class="{ 'drawer-open': !collapsed.months, 'drawer-closing': closingSection.has('months') }">
        <button class="section-header" :aria-expanded="!collapsed.months" @click="toggleSection('months')">
          <span data-label="Months">Months</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.months" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.months }" :inert="collapsed.months || undefined">
          <div class="slide-inner">
            <div class="section-body">
              <button class="load-more-btn" @click="visibleStart -= 3">← 3 earlier</button>
              <template v-for="group in monthsByYear" :key="group.year">
                <span class="year-label">{{ group.year }}</span>
                <label v-for="abs in group.months" :key="abs" class="month-option">
                  <input type="checkbox" class="app-checkbox" :value="abs" v-model="selectedMonthsProxy" />
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
        <button class="section-header" :aria-expanded="!collapsed.people" @click="toggleSection('people')">
          <span data-label="People">People</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.people" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.people }" :inert="collapsed.people || undefined">
          <div class="slide-inner">
            <div class="section-body">
              <button class="add-btn" @click="emit('open-add-person')">Add Person</button>
              <ul v-if="people.people.length > 0" class="people-list">
                <li v-for="person in people.people" :key="person.id" class="person">
                  <span class="color-dot" :style="{ background: person.color }" />
                  <span
                    class="person-name"
                    @click="emit('edit-person', person)"
                  >{{ person.name }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        ref="ticketsSectionEl"
        :class="['ticket-section', { 'drawer-open': !collapsed.tickets, 'drawer-closing': closingSection.has('tickets'), 'drop-target': ticketListIsOver }]"
        @dragover="onTicketListDragOver"
        @dragleave="onTicketListDragLeave"
        @drop="onTicketListDrop"
      >
        <button class="section-header" :aria-expanded="!collapsed.tickets" @click="toggleSection('tickets')">
          <span data-label="Tickets">Tickets</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.tickets" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.tickets }" :inert="collapsed.tickets || undefined">
          <div class="slide-inner">
            <div class="section-body">
              <button class="add-btn" @click="emit('open-add-ticket')">Add Ticket</button>
              <ol v-if="unplacedTickets.length > 0" class="ticket-list">
                <li v-for="ticket in unplacedTickets" :key="ticket.id">
                  <span
                    class="ticket-pill"
                    :class="{ dragging: draggingTicketId === ticket.id }"
                    :style="{ background: pillGradient(ticketColor(ticket.assignedTo)) }"
                    draggable="true"
                    tabindex="0"
                    @click.stop="emit('edit-ticket', ticket)"
                    @keydown.enter.stop="emit('edit-ticket', ticket)"
                    @keydown.space.prevent.stop="emit('edit-ticket', ticket)"
                    @dragstart="(e) => { suppressNativeDragImage(e); e.dataTransfer?.setData('ticketId', String(ticket.id)); draggingTicketId = ticket.id; dragState.startMoveDrag(ticket.id, 0) }"
                    @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
                  >{{ ticket.number }}<div v-if="ticket.title" class="sidebar-pill-tooltip">{{ ticket.title }}</div></span>
                </li>
              </ol>
              <div class="import-section">
                <span class="import-label">Import</span>
                <button class="import-btn" @click="emit('open-upload-epic')">Shortcut Epic CSV</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        :class="{ 'drawer-open': !collapsed.labels, 'drawer-closing': closingSection.has('labels'), 'drop-target': eventListIsOver }"
        @dragover="onEventListDragOver"
        @dragleave="onEventListDragLeave"
        @drop="onEventListDrop"
      >
        <button class="section-header" :aria-expanded="!collapsed.labels" @click="toggleSection('labels')">
          <span data-label="Events">Events</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.labels" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.labels }" :inert="collapsed.labels || undefined">
          <div class="slide-inner">
            <div class="section-body">
              <p class="event-blurb">Used to mark events on the calendar that aren't meant to be counted as a ticket, like buffers or product testing.</p>
              <button class="add-btn" @click="emit('open-add-label')">Add Event</button>
              <ol v-if="unplacedLabels.length > 0" class="ticket-list">
                <li v-for="label in unplacedLabels" :key="label.id">
                  <span
                    class="ticket-pill event-pill"
                    :class="{ dragging: draggingTicketId === label.id }"
                    :style="{ background: pillGradient(label.labelColor ?? '#555') }"
                    draggable="true"
                    tabindex="0"
                    @click.stop="emit('edit-label', label)"
                    @keydown.enter.stop="emit('edit-label', label)"
                    @keydown.space.prevent.stop="emit('edit-label', label)"
                    @dragstart="(e) => { suppressNativeDragImage(e); e.dataTransfer?.setData('ticketId', String(label.id)); draggingTicketId = label.id; dragState.startMoveDrag(label.id, 0) }"
                    @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
                  >{{ label.title }}</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section
        :class="{ 'drawer-open': !collapsed.vacations, 'drawer-closing': closingSection.has('vacations'), 'drop-target': vacationListIsOver }"
        @dragover="onVacationListDragOver"
        @dragleave="onVacationListDragLeave"
        @drop="onVacationListDrop"
      >
        <button class="section-header" :aria-expanded="!collapsed.vacations" @click="toggleSection('vacations')">
          <span data-label="Vacations">Vacations</span>
          <span class="chevron">
            <Transition name="arrow">
              <svg v-if="collapsed.vacations" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </Transition>
          </span>
        </button>
        <div class="slide-wrap" :class="{ 'slide-closed': collapsed.vacations }" :inert="collapsed.vacations || undefined">
          <div class="slide-inner">
            <div class="section-body">
              <p v-if="people.people.length === 0" class="people-blurb">Add people to the team first.</p>
              <p v-else class="event-blurb">Drag a person onto the calendar to add a vacation.</p>
              <div v-if="people.people.length > 0" class="vacation-person-list">
                <span
                  v-for="person in people.people"
                  :key="person.id"
                  class="vacation-person-pill"
                  :class="{ dragging: draggingPersonId === person.id }"
                  draggable="true"
                  tabindex="0"
                  @click="onVacationPersonClick(person.id)"
                  @keydown.enter.stop="onVacationPersonClick(person.id)"
                  @keydown.space.prevent.stop="onVacationPersonClick(person.id)"
                  @dragstart="(e) => { suppressNativeDragImage(e); e.dataTransfer?.setData('newVacationPersonId', String(person.id)); draggingPersonId = person.id; dragState.startNewVacationDrag(person.id) }"
                  @dragend="draggingPersonId = null; dragState.clearNewVacationDrag()"
                >
                  <span class="vac-pill-dot" :style="{ background: person.color }" />
                  {{ person.name }}
                </span>
              </div>
              <div class="import-section">
                <span class="import-label">Import</span>
                <button class="import-btn" @click="emit('open-hibob')">HiBob Vacation Days</button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </aside>
    <div class="sidebar-footer">
      <div class="sidebar-footer-by">by <a class="sidebar-footer-link" href="https://www.linkedin.com/in/mariuszpdabrowski/" target="_blank" rel="noopener noreferrer">Mariusz Dabrowski</a></div>
      <div class="sidebar-footer-divider" />
      <div class="sidebar-footer-links">
        <a class="sidebar-footer-link" href="https://github.com/MariuszDabrowski/ticket-timeline" target="_blank" rel="noopener noreferrer">View on GitHub</a>
        <span class="sidebar-footer-sep">·</span>
        <a class="sidebar-footer-link" :href="bugReportUrl" target="_blank" rel="noopener noreferrer">Report a bug</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-wrap {
  width: 230px;
  flex-shrink: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: #141414;
  display: flex;
  flex-direction: column;
}

.sidebar {
  flex: 1;
  min-height: 0;
  background: transparent;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  contain: layout style;
}

.sidebar-footer {
  flex-shrink: 0;
  padding: 0.6rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.7rem;
  line-height: 1.5;
}

.sidebar-footer-by {
  color: rgba(255, 255, 255, 0.22);
}

.sidebar-footer-divider {
  height: 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
}

.sidebar-footer-links {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.sidebar-footer-link {
  color: rgba(255, 255, 255, 0.28);
  text-decoration: none;
  transition: color 0.15s;
}

.sidebar-footer-link:hover {
  color: rgba(255, 255, 255, 0.6);
}

.sidebar-footer-sep {
  color: rgba(255, 255, 255, 0.15);
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
  contain: paint;
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
  padding: 0 0 1rem;
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
  padding: 0 1rem 0.35rem;
  margin: 0;
}

.event-blurb {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
  padding: 0 1rem 1rem;
  margin: 0;
}

.add-btn {
  font-size: 14px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 1px solid rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  padding: 6px 0.75rem 5px;
  margin: 0.1rem 1rem;
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
  margin-top: 0.25rem;
}

.person {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 13px;
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

section.drop-target {
  background: rgba(255, 255, 255, 0.04);
  outline: 1px dashed rgba(255, 255, 255, 0.2);
}

.ticket-list {
  list-style: none;
  padding: 0.1rem 1rem 0.15rem 1rem;
  margin-top: 0.75rem;
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

.ticket-list li::before {
  content: counter(ticket-counter) '.';
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.72rem;
  flex-shrink: 0;
  min-width: 1rem;
  text-align: right;
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

.ticket-pill:focus-visible {
  outline: 2px solid rgba(167, 139, 250, 0.7);
  outline-offset: 2px;
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

.import-section {
  margin-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 1rem;
}

.import-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.2);
  padding: 0 1rem 0.1rem;
}

.import-btn {
  -webkit-appearance: none;
  appearance: none;
  background: none;
  border: none;
  padding: 0.12rem 1rem;
  font-size: 13px;
  font-family: 'Nunito', sans-serif;
  cursor: pointer;
  text-align: left;
  color: rgba(255, 255, 255, 0.4);
  width: 100%;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
  transition: color 0.15s, text-decoration-color 0.15s;
}

.import-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  text-decoration-color: rgba(255, 255, 255, 0.35);
}

.import-btn::after {
  display: none;
}

.vacation-person-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0 1rem;
}

.vacation-person-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.18rem 0.65rem 0.18rem 0.45rem;
  border-radius: 999px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  cursor: grab;
  width: fit-content;
  background: repeating-linear-gradient(45deg, #2a2a2a 0px, #2a2a2a 3px, #323232 3px, #323232 9px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.07);
  transition: opacity 0.15s;
}

.vacation-person-pill:focus-visible {
  outline: 2px solid rgba(167, 139, 250, 0.7);
  outline-offset: 2px;
}

.vacation-person-pill:active {
  cursor: grabbing;
}

.vacation-person-pill.dragging {
  opacity: 0.4;
}

.vac-pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

section .section-header > span:first-child {
  position: relative;
}

section .section-header > span:first-child::after {
  content: attr(data-label);
  position: absolute;
  left: 0;
  top: 0;
  background: var(--shine-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 500% auto;
  animation: textShine var(--shine-duration) ease-in-out infinite alternate;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  white-space: nowrap;
}

section.drawer-open .section-header > span:first-child::after,
section.drawer-closing .section-header > span:first-child::after {
  opacity: 1;
}

@media (max-width: 920px) {
  .sidebar-wrap {
    width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sidebar {
    overflow-y: visible;
  }

  /* Hide the desktop sidebar footer on mobile; HomeView shows a duplicate at the bottom of the page. */
  .sidebar-footer {
    display: none;
  }
}
</style>

