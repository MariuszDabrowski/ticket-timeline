<script setup lang="ts">
import { ref, computed, toRaw, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { decodeShareLink, buildSmartShareUrl } from '../utils/shareLink'
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
import EditVacationModal from '../components/EditVacationModal.vue'
import SaveModal from '../components/SaveModal.vue'
import LoadModal from '../components/LoadModal.vue'
import ShareInfoModal from '../components/ShareInfoModal.vue'
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
const eventListIsOver = ref(false)

const vacations = useVacationsStore()
const showAddVacation = ref(false)
const vacationModalPersonId = ref<number | null>(null)
const editingVacationId = ref<number | null>(null)
const draggingPersonId = ref<number | null>(null)
const vacationListIsOver = ref(false)

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
  vacations.removeVacation(Number(id))
  dragState.clearVacationMoveDrag()
}

function handleAddVacation(personId: number, startDate: CalendarDate | null, endDate: CalendarDate | null) {
  const id = vacations.addVacation(personId)
  if (startDate) vacations.placeVacation(id, startDate, endDate ?? startDate)
  showAddVacation.value = false
  vacationModalPersonId.value = null
}

function handleEditVacation(vacationId: number, personId: number) {
  const entry = vacations.entries.find((e) => e.id === vacationId)
  if (entry) entry.personId = personId
  editingVacationId.value = null
}

function handleDeleteVacation(vacationId: number) {
  vacations.removeVacation(vacationId)
  editingVacationId.value = null
}

function onVacationPersonClick(personId: number) {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  vacationModalPersonId.value = personId
  showAddVacation.value = true
}


const showSave = ref(false)
const showLoad = ref(false)
const showReset = ref(false)
const currentProjectName = ref('your-project-name')

// Hints system
const hintsActive = ref(window.matchMedia('(pointer: fine) and (min-width: 921px)').matches)
const hintSampleTicketId = ref<number | null>(null)
const hintSampleEventId = ref<number | null>(null)
const ticketsSectionRef = ref<HTMLElement | null>(null)

interface HintPos { x: number; y: number; arrow: 'up' | 'left' }
const hintPositions = ref<(HintPos | null)[]>([null, null, null])

let _hintRetries = 0
let _hintRetryTimer: ReturnType<typeof setTimeout> | null = null

function computeHintPositions() {
  if (_hintRetryTimer) { clearTimeout(_hintRetryTimer); _hintRetryTimer = null }

  // Fallback: resolve IDs by ticket name in case of a page reload
  if (!hintSampleTicketId.value) {
    const t = tickets.tickets.find((t) => t.number === 'Sample Ticket 1')
    if (t) hintSampleTicketId.value = t.id
  }
  if (!hintSampleEventId.value) {
    const e = tickets.tickets.find((t) => t.title === 'Sample Event 2')
    if (e) hintSampleEventId.value = e.id
  }

  const positions: (HintPos | null)[] = [null, null, null]
  if (hintSampleTicketId.value !== null) {
    const el = document.querySelector<HTMLElement>(`[data-ticket-id="${hintSampleTicketId.value}"].is-start`)
    if (el) {
      const r = el.getBoundingClientRect()
      positions[0] = { x: r.left + r.width / 2, y: r.bottom + 8, arrow: 'up' }
    }
  }
  if (hintSampleEventId.value !== null) {
    const el = document.querySelector<HTMLElement>(`[data-ticket-id="${hintSampleEventId.value}"].is-start`)
    if (el) {
      const r = el.getBoundingClientRect()
      positions[1] = { x: r.left + r.width / 2, y: r.bottom + 8, arrow: 'up' }
    }
  }
  if (ticketsSectionRef.value) {
    const r = ticketsSectionRef.value.getBoundingClientRect()
    positions[2] = { x: r.right + 18, y: r.top + r.height / 2, arrow: 'left' }
  }
  hintPositions.value = positions

  // Retry until calendar pills appear in the DOM (up to ~2 seconds)
  const pillsMissing = (hintSampleTicketId.value !== null && !positions[0]) ||
                       (hintSampleEventId.value !== null && !positions[1])
  if (hintsActive.value && pillsMissing && _hintRetries < 10) {
    _hintRetries++
    _hintRetryTimer = setTimeout(() => computeHintPositions(), 200)
  } else {
    _hintRetries = 0
  }
}

let _hintScrollRaf: number | null = null
function onScrollForHints() {
  if (!hintsActive.value) return
  if (_hintScrollRaf !== null) return
  _hintScrollRaf = requestAnimationFrame(() => {
    _hintScrollRaf = null
    computeHintPositions()
  })
}

let hintDismissListener: (() => void) | null = null

function setupHintDismissal() {
  if (hintDismissListener) return
  hintDismissListener = () => {
    dismissHints()
    document.removeEventListener('pointerdown', hintDismissListener!, true)
    hintDismissListener = null
  }
  // Use setTimeout so the pointerdown that triggered showHelp() doesn't immediately dismiss
  setTimeout(() => {
    if (hintDismissListener) document.addEventListener('pointerdown', hintDismissListener, true)
  }, 0)
}

function dismissHints() {
  hintsActive.value = false
}

function showHelp() {
  hintsActive.value = true
  nextTick(() => computeHintPositions())
  setupHintDismissal()
}

function resetAll() {
  people.loadData([])
  tickets.loadData({ tickets: [], placements: [] })
  vacations.loadData([])
  showReset.value = false
}

const saveData = computed<Omit<ProjectData, 'name'>>(() => ({
  tickets: toRaw(tickets.tickets),
  placements: toRaw(tickets.placements),
  people: toRaw(people.people),
  vacations: toRaw(vacations.entries),
  selectedMonths: toRaw(selectedMonths.value),
}))

const shareResult = computed(() =>
  buildSmartShareUrl({
    name: currentProjectName.value,
    tickets: toRaw(tickets.tickets),
    placements: toRaw(tickets.placements),
    people: toRaw(people.people),
    vacations: toRaw(vacations.entries),
    selectedMonths: toRaw(selectedMonths.value),
  })
)
const bugReportUrl = computed(() => {
  const base = 'https://github.com/MariuszDabrowski/ticket-timeline/issues/new'
  const { url, tier } = shareResult.value
  const shareSection = tier !== 'too-long' && url
    ? `## Share link\n\n${url}\n\n`
    : `## Share link\n\n<!-- Project is too large to encode as a share link -->\n\n`
  const body = `## What happened?\n\n<!-- A clear description of the bug -->\n\n## Steps to reproduce\n\n1. \n2. \n3. \n\n## Screenshot\n\n<!-- Drag and drop a screenshot here -->\n\n${shareSection}## Environment\n\n- **Device:** \n- **OS:** \n- **Browser:** `
  return `${base}?template=bug_report.md&body=${encodeURIComponent(body)}`
})

type CopyStatus = 'idle' | 'copied'
const copyStatus = ref<CopyStatus>('idle')
const showShareInfo = ref(false)
function copyShareLink() {
  const { url, tier } = shareResult.value
  if (tier === 'too-long' || !url) return
  navigator.clipboard.writeText(url)
  copyStatus.value = 'copied'
  setTimeout(() => (copyStatus.value = 'idle'), 2500)
}

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

function seedDefaultData() {
  const now = new Date()

  function toCalDate(d: Date): CalendarDate {
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }
  }
  function calAddDays(d: Date, n: number): Date {
    const r = new Date(d); r.setDate(r.getDate() + n); return r
  }

  // Find the first Monday of the current month (first full week),
  // then place: week1=vacation, week2=tickets, week3=event
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDow = firstOfMonth.getDay()
  const monday1 = calAddDays(firstOfMonth, (8 - firstDow) % 7)
  const monday2 = calAddDays(monday1, 7)
  const monday3 = calAddDays(monday2, 7)

  // Vacation: Tue–Thu (3 days centered in week 1)
  const vacStart = toCalDate(calAddDays(monday1, 1))
  const vacEnd   = toCalDate(calAddDays(monday1, 3))

  // Tickets: Tue–Thu (3 days) and Thu–Fri (2 days), centered in week 2
  const t1Start  = toCalDate(calAddDays(monday2, 1))
  const t1End    = toCalDate(calAddDays(monday2, 3))
  const t2Start  = toCalDate(calAddDays(monday2, 3))
  const t2End    = toCalDate(calAddDays(monday2, 4))

  // Sample Event 2: Tue–Wed (2 days centered in week 3)
  const e2Start  = toCalDate(calAddDays(monday3, 1))
  const e2End    = toCalDate(calAddDays(monday3, 2))

  const user1Id = people.addPerson('Sample User 1', '#3498db')
  const user2Id = people.addPerson('Sample User 2', '#e91e63')

  const t1Id = tickets.addTicket({ number: 'Sample Ticket 1', title: 'Sample Ticket 1', assignedTo: user1Id, link: '' })
  tickets.placeTicket(t1Id, t1Start)
  tickets.moveTicket(t1Id, t1Start, t1End)

  const t2Id = tickets.addTicket({ number: 'Sample Ticket 2', title: 'Sample Ticket 2', assignedTo: user2Id, link: '' })
  tickets.placeTicket(t2Id, t2Start)
  tickets.moveTicket(t2Id, t2Start, t2End)

  tickets.addTicket({ number: '', title: 'Sample Event 1', assignedTo: null, link: '', isLabel: true, labelColor: '#9b59b6' })

  const e2Id = tickets.addTicket({ number: '', title: 'Sample Event 2', assignedTo: null, link: '', isLabel: true, labelColor: '#1abc9c' })
  tickets.placeTicket(e2Id, e2Start)
  tickets.moveTicket(e2Id, e2Start, e2End)

  const vacId = vacations.addVacation(user2Id)
  vacations.placeVacation(vacId, vacStart, vacEnd)

  hintSampleTicketId.value = t1Id
  hintSampleEventId.value = e2Id
}

onMounted(() => {
  const match = window.location.hash.match(/[#&]share=([^&]+)/)
  if (match) {
    const data = decodeShareLink(match[1]!)
    if (data) {
      handleLoad(data)
      history.replaceState(null, '', window.location.pathname)
    }
    hintsActive.value = false
    return
  }
  if (people.people.length === 0 && tickets.tickets.length === 0) {
    seedDefaultData()
  }
  if (hintsActive.value) {
    setTimeout(() => computeHintPositions(), 350)
    setupHintDismissal()
  }
  document.addEventListener('scroll', onScrollForHints, true)
})

watch(
  () => tickets.placements.length,
  (len) => {
    if (len > 0 && hintsActive.value && !hintPositions.value[0]) {
      nextTick(() => computeHintPositions())
    }
  }
)

onUnmounted(() => {
  document.removeEventListener('scroll', onScrollForHints, true)
  if (_hintScrollRaf !== null) cancelAnimationFrame(_hintScrollRaf)
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
  tickets.removePlacement(Number(id))
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
        <button class="header-btn" @click="showSave = true">Save</button>
        <button class="header-btn" @click="showLoad = true">Load</button>
        <button class="header-btn help-btn" @click="showHelp">Help</button>
        <button class="header-btn" @click="showReset = true">Reset</button>
      </div>
    </header>
    <div class="below-header">
    <div class="sidebar-wrap">
    <aside class="sidebar" v-simplebar>
      <section :class="{ 'drawer-open': !collapsed.months, 'drawer-closing': closingSection.has('months') }">
        <button class="section-header" @click="toggleSection('months')">
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
        ref="ticketsSectionRef"
        :class="['ticket-section', { 'drawer-open': !collapsed.tickets, 'drawer-closing': closingSection.has('tickets'), 'drop-target': ticketListIsOver }]"
        @dragover="onTicketListDragOver"
        @dragleave="onTicketListDragLeave"
        @drop="onTicketListDrop"
      >
        <button class="section-header" @click="toggleSection('tickets')">
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
              <button class="add-btn" @click="showAddTicket = true">Add Ticket</button>
              <ol v-if="unplacedTickets.length > 0" class="ticket-list">
                <li v-for="ticket in unplacedTickets" :key="ticket.id">
                  <span
                    class="ticket-pill"
                    :class="{ dragging: draggingTicketId === ticket.id }"
                    :style="{ background: ticketColor(ticket.assignedTo) }"
                    draggable="true"
                    tabindex="0"
                    @click.stop="editingTicket = ticket"
                    @keydown.enter.stop="editingTicket = ticket"
                    @keydown.space.prevent.stop="editingTicket = ticket"
                    @dragstart="(e) => { e.dataTransfer?.setData('ticketId', String(ticket.id)); draggingTicketId = ticket.id; dragState.startMoveDrag(ticket.id, 0) }"
                    @dragend="draggingTicketId = null; dragState.clearMoveDrag()"
                  >{{ ticket.number }}<div v-if="ticket.title" class="sidebar-pill-tooltip">{{ ticket.title }}</div></span>
                </li>
              </ol>
              <div class="import-section">
                <span class="import-label">Import</span>
                <button class="import-btn" @click="showUploadEpic = true">Shortcut Epic CSV</button>
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
        <button class="section-header" @click="toggleSection('labels')">
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
              <button class="add-btn" @click="showAddLabel = true">Add Event</button>
              <ol v-if="unplacedLabels.length > 0" class="ticket-list">
                <li v-for="label in unplacedLabels" :key="label.id">
                  <span
                    class="ticket-pill event-pill"
                    :class="{ dragging: draggingTicketId === label.id }"
                    :style="{ background: label.labelColor }"
                    draggable="true"
                    tabindex="0"
                    @click.stop="editingLabel = label"
                    @keydown.enter.stop="editingLabel = label"
                    @keydown.space.prevent.stop="editingLabel = label"
                    @dragstart="(e) => { e.dataTransfer?.setData('ticketId', String(label.id)); draggingTicketId = label.id; dragState.startMoveDrag(label.id, 0) }"
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
        <button class="section-header" @click="toggleSection('vacations')">
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
                  @dragstart="(e) => { e.dataTransfer?.setData('newVacationPersonId', String(person.id)); draggingPersonId = person.id }"
                  @dragend="draggingPersonId = null"
                >
                  <span class="vac-pill-dot" :style="{ background: person.color }" />
                  {{ person.name }}
                </span>
              </div>
              <div class="import-section">
                <span class="import-label">Import</span>
                <button class="import-btn" @click="showHiBob = true">HiBob Vacation Days</button>
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
              @edit-vacation="editingVacationId = $event"
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
              <SummaryTile />
            </div>
          </div>

          <div class="share-panel">
            <button
              class="share-btn"
              :class="{ 'share-btn--copied': copyStatus === 'copied' }"
              :disabled="shareResult.tier === 'too-long'"
              @click="copyShareLink"
            >
              <div class="share-btn-icon-wrap">
                <svg class="share-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="M318-120q-82 0-140-58t-58-140q0-40 15-76t43-64l134-133 56 56-134 134q-17 17-25.5 38.5T200-318q0 49 34.5 83.5T318-200q23 0 45-8.5t39-25.5l133-134 57 57-134 133q-28 28-64 43t-76 15Zm79-220-57-57 223-223 57 57-223 223Zm251-28-56-57 134-133q17-17 25-38t8-44q0-50-34-85t-84-35q-23 0-44.5 8.5T558-726L425-592l-57-56 134-134q28-28 64-43t76-15q82 0 139.5 58T839-641q0 39-14.5 75T782-502L648-368Z"/>
                </svg>
              </div>
              <div class="share-btn-body">
                <div class="share-btn-labels">
                  <span class="label-idle">
                    <template v-if="shareResult.tier === 'too-long'">Project too large to share</template>
                    <template v-else>Copy share link</template>
                  </span>
                  <span class="label-copied">Link copied</span>
                </div>
              </div>
            </button>
            <button class="info-btn" @click="showShareInfo = true">?</button>
          </div>

        </div>
      </div>
    </main>
    <div class="sidebar-footer sidebar-footer--mobile">
      <div class="sidebar-footer-by">by <a class="sidebar-footer-link" href="https://www.linkedin.com/in/mariuszpdabrowski/" target="_blank" rel="noopener noreferrer">Mariusz Dabrowski</a></div>
      <div class="sidebar-footer-divider" />
      <div class="sidebar-footer-links">
        <a class="sidebar-footer-link" href="https://github.com/MariuszDabrowski/ticket-timeline" target="_blank" rel="noopener noreferrer">View on GitHub</a>
        <span class="sidebar-footer-sep">·</span>
        <a class="sidebar-footer-link" :href="bugReportUrl" target="_blank" rel="noopener noreferrer">Report a bug</a>
      </div>
    </div>
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
    <EditVacationModal
      v-if="editingVacationId !== null"
      :vacation-id="editingVacationId"
      :current-person-id="vacations.entries.find(e => e.id === editingVacationId)?.personId ?? 0"
      :people="people.people"
      @save="handleEditVacation"
      @delete="handleDeleteVacation"
      @cancel="editingVacationId = null"
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

  <ShareInfoModal v-if="showShareInfo" @close="showShareInfo = false" />

  <Transition name="modal">
    <div v-if="showReset" class="reset-backdrop" @click.self="showReset = false">
      <div class="reset-modal">
        <h3><span>Reset Calendar</span></h3>
        <div class="reset-body">
          <p>This will permanently clear all people, tickets, events, and vacations from the calendar.</p>
          <p class="reset-warning">This action cannot be undone.</p>
        </div>
        <div class="reset-actions">
          <button @click="showReset = false">Cancel</button>
          <button class="reset-confirm-btn" @click="resetAll">Clear Everything</button>
        </div>
      </div>
    </div>
  </Transition>

  <Teleport to="body">
    <Transition name="hints-fade">
    <div v-if="hintsActive" class="hints-layer">
      <div
        v-if="hintPositions[0]"
        class="hint-anchor"
        :style="{ left: hintPositions[0].x + 'px', top: hintPositions[0].y + 'px' }"
      >
        <div class="hint-bubble hint-arrow-up">
          <svg class="hint-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z"/></svg>
          <span>Click on tickets and events to edit them</span>
        </div>
      </div>
      <div
        v-if="hintPositions[1]"
        class="hint-anchor"
        :style="{ left: hintPositions[1].x + 'px', top: hintPositions[1].y + 'px' }"
      >
        <div class="hint-bubble hint-arrow-up">
          <svg class="hint-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z"/></svg>
          <span>Drag the tickets around, or use the handles to expand</span>
        </div>
      </div>
      <div
        v-if="hintPositions[2]"
        class="hint-anchor hint-anchor-left"
        :style="{ left: hintPositions[2].x + 'px', top: hintPositions[2].y + 'px' }"
      >
        <div class="hint-bubble hint-arrow-left">
          <svg class="hint-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z"/></svg>
          <span>Create new items here, drag them onto the calendar when ready</span>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
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

.header-btn-danger {
  color: rgba(231, 76, 60, 0.7);
}

.help-btn {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

@media (max-width: 920px), (pointer: coarse) {
  .help-btn { display: none; }
  .hints-layer { display: none; }
}

.hints-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 80;
  clip-path: inset(52px 0 0 0);
}

.hint-anchor {
  position: absolute;
  transform: translateX(-50%);
}

.hint-anchor-left {
  transform: translateY(-50%);
}

.hint-bubble {
  position: relative;
  background:
    linear-gradient(to top left, rgba(0, 0, 0, 0.3) 0%, transparent 55%),
    #665c22;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 0.7rem;
  max-width: 175px;
  font-size: 0.72rem;
  line-height: 1.5;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.2);
  font-family: 'Nunito', sans-serif;
  animation: hintFadeIn 0.3s ease-out both;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  text-align: left;
  gap: 0.4rem;
}

.hint-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: #ffdf07;
}

@keyframes hintFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.hint-arrow-up::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  bottom: 100%;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid #665c22;
}

.hint-arrow-left::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  right: 100%;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-right: 7px solid #665c22;
}

.reset-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.reset-modal {
  background-color: #1a1a1a;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 360px;
  max-width: calc(100vw - 2rem);
}

.reset-modal h3 {
  padding: 0.65rem 1rem;
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  line-height: 1;
  margin: 0;
}

.reset-modal h3 span {
  background: linear-gradient(to right, #a78bfa 20%, #38bdf8 35%, #22d3ee 65%, #818cf8 80%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 500% auto;
  animation: textShine 5s ease-in-out infinite alternate;
  padding-top: 2px;
}

.reset-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.55;
}

.reset-warning {
  color: rgba(231, 76, 60, 0.8);
  font-size: 0.82rem;
}

.reset-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.reset-actions button {
  padding: 5px 1rem;
  font-size: 0.76rem;
  font-family: 'Nunito', sans-serif;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 2px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  line-height: 1;
}

.reset-confirm-btn {
  background: linear-gradient(180deg, #c0392b 0%, #a93226 100%) !important;
  border-color: rgba(0, 0, 0, 0.55) !important;
  color: rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1) !important;
}

.below-header {
  display: flex;
  flex: 1;
  overflow: hidden;
}

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

.sidebar-footer.sidebar-footer--mobile {
  display: none;
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
  padding: 0 1rem 0.35rem;
  margin: 0;
}

.event-blurb {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.75);
  padding: 0 1rem 0.35rem;
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

.share-panel {
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
  margin-top: 0.75rem;
}

.share-btn {
  flex: 1;
  display: flex;
  align-items: stretch;
  padding: 0;
  overflow: hidden;
  font-size: 14px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 1px solid rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  text-align: left;
  color: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: color 0.2s ease;
  line-height: 1;
  font-family: 'Nunito', sans-serif;
}

.share-btn:hover:not(:disabled) { color: rgba(255, 255, 255, 0.95); }
.share-btn--copied { color: #27ae60 !important; }
.share-btn:disabled { opacity: 0.4; cursor: default; }

.share-btn-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(0, 0, 0, 0.3);
}

.share-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.75;
}

.share-btn-body {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 10px 0.75rem 8px;
}

.share-btn-labels {
  flex: 1;
  position: relative;
  overflow: hidden;
  height: 1.1em;
}

.label-idle,
.label-copied {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  white-space: nowrap;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.label-idle { transform: translateY(0); }
.label-copied { transform: translateY(-100%); }
.share-btn--copied .label-idle { transform: translateY(100%); }
.share-btn--copied .label-copied { transform: translateY(0); }

.info-btn {
  flex-shrink: 0;
  width: 32px;
  font-size: 13px;
  font-weight: 700;
  font-family: 'Nunito', sans-serif;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border: 1px solid rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.4);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.info-btn:hover { color: rgba(255, 255, 255, 0.85); }

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
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.45) 0%, rgba(56, 189, 248, 0.35) 50%, rgba(129, 140, 248, 0.45) 100%);
  background-size: 200% auto;
  animation: checkboxGradient 2.5s ease-in-out infinite alternate;
  border-color: rgba(167, 139, 250, 0.6);
}

@keyframes checkboxGradient {
  0%   { background-position: 0% center; }
  100% { background-position: 100% center; }
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
  background: linear-gradient(to right, #a78bfa 20%, #38bdf8 35%, #22d3ee 65%, #818cf8 80%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 500% auto;
  animation: textShine 5s ease-in-out infinite alternate;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  white-space: nowrap;
}

section.drawer-open .section-header > span:first-child::after,
section.drawer-closing .section-header > span:first-child::after {
  opacity: 1;
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

  .sidebar-wrap {
    width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sidebar {
    overflow-y: visible;
  }

  .sidebar-wrap .sidebar-footer:not(.sidebar-footer--mobile) {
    display: none;
  }

  .sidebar-footer.sidebar-footer--mobile {
    display: flex;
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

:global(.hints-fade-leave-active) { transition: opacity 0.4s ease; }
:global(.hints-fade-leave-to) { opacity: 0; }
</style>
