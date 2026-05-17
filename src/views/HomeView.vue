<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, toRaw } from 'vue'
import { decodeShareLink } from '../utils/shareLink'
import { useShareLink } from '../composables/useShareLink'
import { useUndoStack } from '../composables/useUndoStack'
import { useRejectionToast } from '../composables/useRejectionToast'
import { seedSampleData } from '../utils/seedSampleData'

import MonthCalendar from '../components/MonthCalendar.vue'
import AddUserModal from '../components/AddUserModal.vue'
import AppLogo from '../components/AppLogo.vue'
import { usePeopleStore } from '../stores/people'
import { useTicketsStore, findFirstFreeRow, combineRowOccupants } from '../stores/tickets'
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
import HintBubble from '../components/HintBubble.vue'
import AppSidebar from '../components/AppSidebar.vue'
import type { ProjectData } from '../utils/projectStorage'
import type { Ticket, CalendarDate } from '../stores/tickets'
import { compareCalendarDates } from '../stores/tickets'
import { parseEpicCSV, type EpicCsvImport } from '../utils/epicCsv'
import { useVacationsStore } from '../stores/vacations'
import type { ICSPersonGroup } from '../utils/icsParser'
import PeopleConfirmModal from '../components/PeopleConfirmModal.vue'
import { classifyIncoming, uniquifyName, type Classification, type IncomingPerson, type Decision } from '../utils/peopleMatch'


// Absolute month key: year * 12 + month — spans across year boundaries
const currentAbs = new Date().getFullYear() * 12 + new Date().getMonth()
const selectedMonths = ref<number[]>([0, 1, 2, 3].map((i) => currentAbs + i))

function absToYearMonth(abs: number) {
  return { year: Math.floor(abs / 12), month: abs % 12 }
}

const sortedMonths = computed(() =>
  [...selectedMonths.value].sort((a, b) => a - b).map(absToYearMonth)
)

const sidebarRef = ref<InstanceType<typeof AppSidebar> | null>(null)

const isSampleData = ref(false)

const people = usePeopleStore()
const showAddPerson = ref(false)
const editingPerson = ref<typeof people.people[0] | null>(null)

function handleAddPerson(name: string, color: string) {
  people.addPerson(name, color)
  showAddPerson.value = false
  sidebarRef.value?.openPeopleSection()
  dismissHint()
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
    const end = endDate ?? startDate
    const row = findFirstFreeRow(combineRowOccupants(tickets.placements, vacations.entries), startDate, end)
    tickets.placeTicket(id, startDate, row)
    tickets.moveTicket(id, startDate, end)
  }
  showAddLabel.value = false
  dismissHint()
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
    const row = findFirstFreeRow(combineRowOccupants(tickets.placements, vacations.entries), startDate, end)
    tickets.placeTicket(id, startDate, row)
    tickets.moveTicket(id, startDate, end)
  }
  showAddTicket.value = false
  dismissHint()
}

const showUploadEpic = ref(false)

// PeopleConfirmModal state. Shared by CSV (epic) and HiBob flows; whichever
// path opens the modal stashes its follow-up in `pendingPeopleConfirm` so
// the user's decisions can be applied and the import resumed.
const peopleConfirmRows = ref<Classification[]>([])
const pendingPeopleConfirm = ref<((decisions: Decision[]) => void) | null>(null)

function expandSelectedMonthsForPlacements() {
  const selected = new Set(selectedMonths.value)
  let minAbs = Infinity
  let maxAbs = -Infinity
  for (const p of tickets.placements) {
    for (const date of [p.startDate, p.endDate]) {
      const abs = date.year * 12 + date.month
      if (!selected.has(abs)) {
        selected.add(abs)
        if (abs < minAbs) minAbs = abs
        if (abs > maxAbs) maxAbs = abs
      }
    }
  }
  selectedMonths.value = [...selected]
  if (minAbs !== Infinity) sidebarRef.value?.expandVisibleRange(minAbs, maxAbs)
}

// Walks incoming people and splits into three groups:
//   - resolved: email-known matches (auto-merge silently)
//   - autoCreate: no match anywhere (silent create — no decision to make)
//   - needsConfirm: exact-name / fuzzy / ambiguous (user must decide)
// Only side effects happen at commit time, not here.
function resolveIncomingPeople(
  incoming: IncomingPerson[],
): {
  resolved: Map<IncomingPerson, number>
  autoCreate: Classification[]
  needsConfirm: Classification[]
} {
  const resolved = new Map<IncomingPerson, number>()
  const autoCreate: Classification[] = []
  const needsConfirm: Classification[] = []
  for (const p of incoming) {
    const c = classifyIncoming(p, people.people)
    if (c.tier === 'email-known' && c.suggestedPersonId !== undefined) {
      resolved.set(p, c.suggestedPersonId)
    } else if (c.tier === 'none') {
      autoCreate.push(c)
    } else {
      needsConfirm.push(c)
    }
  }
  return { resolved, autoCreate, needsConfirm }
}

// Spin up a new Person for one incoming person and record its email if any.
function createPersonFor(c: Classification): number {
  const id = people.addPerson(uniquifyName(c.incoming.name, people.people))
  if (c.incoming.email) people.addEmail(id, c.incoming.email)
  return id
}

// Materialize user decisions: merges record the incoming email on the matched
// person; creates spin up a new Person with uniquifyName so two real Jonathans
// don't collapse. Resolves each Decision back into the shared map keyed by
// IncomingPerson ref. Returns the count of newly-created people.
//
// toRaw unwraps the IncomingPerson the modal echoed back: Vue deep-wraps
// objects stored in ref(), so `d.incoming` is a Proxy while the doImport
// callback looks up by the original (non-Proxy) ref from the closure's
// `incoming` array. Without this unwrap, Map.get returns undefined for every
// merge-confirmed person and their vacations/tickets get silently skipped.
function applyDecisions(resolved: Map<IncomingPerson, number>, decisions: Decision[]): number {
  let created = 0
  for (const d of decisions) {
    const incoming = toRaw(d.incoming)
    let personId: number
    if (d.action === 'merge' && d.personId !== undefined) {
      personId = d.personId
    } else {
      personId = people.addPerson(uniquifyName(incoming.name, people.people))
      created++
    }
    if (incoming.email) people.addEmail(personId, incoming.email)
    resolved.set(incoming, personId)
  }
  return created
}

// Common entry for any import source. Given the unique incoming people list
// and a doImport callback (consumes resolved map + count of newly-created
// people), either runs immediately if there's nothing to confirm, or opens
// PeopleConfirmModal first. All side effects happen at commit time so a
// cancel leaves no trace.
function startImport(
  incoming: IncomingPerson[],
  doImport: (resolved: Map<IncomingPerson, number>, createdCount: number) => void,
) {
  const { resolved, autoCreate, needsConfirm } = resolveIncomingPeople(incoming)

  const commit = (decisions: Decision[]) => {
    let created = 0
    for (const c of autoCreate) {
      resolved.set(c.incoming, createPersonFor(c))
      created++
    }
    created += applyDecisions(resolved, decisions)
    doImport(resolved, created)
  }

  if (needsConfirm.length === 0) {
    commit([])
    return
  }
  peopleConfirmRows.value = needsConfirm
  pendingPeopleConfirm.value = commit
}

function handlePeopleConfirm(decisions: Decision[]) {
  const cb = pendingPeopleConfirm.value
  pendingPeopleConfirm.value = null
  peopleConfirmRows.value = []
  cb?.(decisions)
}

function handlePeopleCancel() {
  pendingPeopleConfirm.value = null
  peopleConfirmRows.value = []
}

function clearAllProjectData() {
  people.loadData([])
  tickets.loadData({ tickets: [], placements: [] })
  vacations.loadData([])
  currentProjectName.value = ''
  isSampleData.value = false
}

const hasAnyCalendarData = computed(() =>
  people.people.length > 0 ||
  tickets.tickets.length > 0 ||
  vacations.entries.length > 0,
)

// Import gate: if the calendar has any existing data (seeded sample OR the
// user's real work), ask up front whether to replace it or merge the import
// alongside. The clear happens immediately on Replace (NOT deferred):
// classification needs to see the right roster, and a deferred clear could
// wipe a Person whose id we'd already resolved against. Cancelling here
// aborts the import entirely; cancelling later in PeopleConfirmModal leaves
// whatever state the gate decision produced.
const showImportPrompt = ref(false)
const pendingImportRun = ref<(() => void) | null>(null)

function withImportGate(run: () => void) {
  if (!hasAnyCalendarData.value) {
    run()
    return
  }
  pendingImportRun.value = run
  showImportPrompt.value = true
}

function onImportReplace() {
  showImportPrompt.value = false
  clearAllProjectData()
  const run = pendingImportRun.value
  pendingImportRun.value = null
  run?.()
}

function onImportMerge() {
  showImportPrompt.value = false
  const run = pendingImportRun.value
  pendingImportRun.value = null
  run?.()
}

function onImportCancel() {
  showImportPrompt.value = false
  pendingImportRun.value = null
}

function handleEpicImport(csvText: string, workspaceSlug: string) {
  const parsed: EpicCsvImport | null = parseEpicCSV(csvText, tickets, vacations, workspaceSlug)
  showUploadEpic.value = false
  if (!parsed) return

  withImportGate(() => {
    startImport(parsed.incomingPeople, (resolved, createdCount) => {
      const emailMap = new Map<string, number>()
      for (const [incoming, id] of resolved) {
        if (incoming.email) emailMap.set(incoming.email.toLowerCase(), id)
      }
      parsed.apply(emailMap)
      expandSelectedMonthsForPlacements()
      if (createdCount > 0) sidebarRef.value?.openPeopleSection()
    })
  })
}

const editingTicket = ref<Ticket | null>(null)
const conflictToast = ref('')
let conflictToastTimer: ReturnType<typeof setTimeout> | null = null

function showConflictToast(msg: string) {
  conflictToast.value = msg
  if (conflictToastTimer) clearTimeout(conflictToastTimer)
  conflictToastTimer = setTimeout(() => { conflictToast.value = '' }, 5000)
}

function handleEditTicket(data: { number: string; title: string; assignedTo: number | null; link: string; startDate: CalendarDate | null; endDate: CalendarDate | null }) {
  if (!editingTicket.value) return
  const id = editingTicket.value.id
  const { startDate, endDate, ...ticketData } = data

  if (ticketData.assignedTo !== null && startDate) {
    const end = endDate ?? startDate
    const hasConflict = vacations.entries.some((v) =>
      v.personId === ticketData.assignedTo &&
      v.startDate !== null && v.endDate !== null &&
      compareCalendarDates(v.startDate, end) <= 0 &&
      compareCalendarDates(startDate, v.endDate) <= 0
    )
    if (hasConflict) {
      const personName = people.people.find((p) => p.id === ticketData.assignedTo)?.name ?? 'This person'
      showConflictToast(`Can't assign to ${personName} — they're on vacation during those dates and the ticket would be hidden.`)
      return
    }
  }

  tickets.updateTicket(id, ticketData)
  if (startDate) {
    const end = endDate ?? startDate
    if (!tickets.placements.find((p) => p.ticketId === id)) {
      const row = findFirstFreeRow(combineRowOccupants(tickets.placements, vacations.entries), startDate, end)
      tickets.placeTicket(id, startDate, row)
    }
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

const vacations = useVacationsStore()
const undoStack = useUndoStack()
const { message: rejectionMessage, showRejection } = useRejectionToast()
const showAddVacation = ref(false)
const vacationModalPersonId = ref<number | null>(null)
const editingVacationId = ref<number | null>(null)

function handleAddVacation(personId: number, startDate: CalendarDate | null, endDate: CalendarDate | null) {
  const id = vacations.addVacation(personId)
  if (startDate) vacations.placeVacation(id, startDate, endDate ?? startDate)
  showAddVacation.value = false
  vacationModalPersonId.value = null
}

function handleEditVacation(vacationId: number, personId: number) {
  const entry = vacations.entries.find((e) => e.id === vacationId)
  if (!entry) {
    editingVacationId.value = null
    return
  }

  // Reject if the new person has any ticket overlapping the vacation dates —
  // otherwise the swap would silently clip those tickets on the vacation days.
  // Skip the check when the person isn't actually changing or when the vacation
  // hasn't been placed yet (no dates).
  if (
    entry.personId !== personId &&
    entry.startDate && entry.endDate &&
    tickets.hasTicketOverlappingRange(personId, entry.startDate, entry.endDate)
  ) {
    const person = people.people.find((p) => p.id === personId)
    showRejection(`Can't assign vacation to ${person?.name ?? 'this person'} — they have a ticket during these dates.`)
    return
  }

  entry.personId = personId
  editingVacationId.value = null
}

function handleDeleteVacation(vacationId: number) {
  vacations.removeVacation(vacationId)
  editingVacationId.value = null
}


const showSave = ref(false)
const showLoad = ref(false)
const showReset = ref(false)
const currentProjectName = ref('your-project-name')

// Hints system
const hintsActive = ref(window.matchMedia('(pointer: fine) and (min-width: 921px)').matches)
const HINT_DISMISSED_KEY = 'ticket-timeline:hint-dismissed'
const hintDismissed = ref(localStorage.getItem(HINT_DISMISSED_KEY) === '1')
const hintFadingOut = ref(false)
const anyHintVisible = computed(() => hintsActive.value && !hintDismissed.value)
const layoutRef = ref<HTMLElement | null>(null)
const hintTop = ref<number | null>(null)

function computeHintPosition() {
  const ticketsSectionEl = sidebarRef.value?.ticketsSectionEl
  if (!ticketsSectionEl || !layoutRef.value) return
  const hdr = ticketsSectionEl.querySelector('.section-header')
  const r = hdr?.getBoundingClientRect() ?? ticketsSectionEl.getBoundingClientRect()
  const lr = layoutRef.value.getBoundingClientRect()
  hintTop.value = r.top + r.height / 2 - lr.top
}

function dismissHint() {
  hintFadingOut.value = true
  setTimeout(() => {
    hintDismissed.value = true
    hintFadingOut.value = false
    localStorage.setItem(HINT_DISMISSED_KEY, '1')
  }, 400)
}

function resetAll() {
  people.loadData([])
  tickets.loadData({ tickets: [], placements: [] })
  vacations.loadData([])
  undoStack.clear()
  isSampleData.value = false
  currentProjectName.value = ''
  showReset.value = false
}

const saveData = computed<Omit<ProjectData, 'name'>>(() => ({
  tickets: [...tickets.tickets],
  placements: [...tickets.placements],
  people: [...people.people],
  vacations: [...vacations.entries],
  selectedMonths: [...selectedMonths.value],
}))

const { shareResult, copyStatus, copyShareLink, bugReportUrl } = useShareLink(() => ({
  name: currentProjectName.value,
  tickets: [...tickets.tickets],
  placements: [...tickets.placements],
  people: [...people.people],
  vacations: [...vacations.entries],
  selectedMonths: [...selectedMonths.value],
}))
const showShareInfo = ref(false)

const anyModalOpen = computed(() =>
  showSave.value || showLoad.value || showReset.value ||
  showAddPerson.value || editingPerson.value !== null ||
  showHiBob.value || hibobGroups.value.length > 0 ||
  peopleConfirmRows.value.length > 0 || showImportPrompt.value ||
  showShareInfo.value || editingVacationId.value !== null ||
  showAddVacation.value || showAddLabel.value ||
  editingLabel.value !== null || editingTicket.value !== null
)
function handleLoad(data: ProjectData) {
  people.loadData(data.people)
  tickets.loadData({ tickets: data.tickets, placements: data.placements })
  vacations.loadData(data.vacations ?? [])
  undoStack.clear()
  isSampleData.value = false
  if (data.name) currentProjectName.value = data.name
  if (Array.isArray(data.selectedMonths) && data.selectedMonths.length > 0) {
    selectedMonths.value = data.selectedMonths
    sidebarRef.value?.expandVisibleRange(
      Math.min(...data.selectedMonths),
      Math.max(...data.selectedMonths),
    )
  }
  showLoad.value = false
}

function seedDefaultData() {
  seedSampleData(people, tickets, vacations)
  isSampleData.value = true
}

function onKeydown(e: KeyboardEvent) {
  // Cmd/Ctrl+Z — undo the last drag operation
  if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    const target = e.target as HTMLElement | null
    const tag = target?.tagName
    // Don't hijack undo from text inputs or any modal that's open
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
    if (anyModalOpen.value) return
    if (undoStack.canUndo.value) {
      e.preventDefault()
      undoStack.undo()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)

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
    nextTick(() => computeHintPosition())
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
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
    // Lazy-load html-to-image so it only ships in the bundle for users who export
    const { toPng } = await import('html-to-image')
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

function handleHiBobConfirm(selectedGroups: ICSPersonGroup[]) {
  hibobGroups.value = []
  if (selectedGroups.length === 0) return

  // HiBob carries no email, so every group flows through PeopleConfirmModal
  // for at least a name-match decision. Build IncomingPersons in lockstep
  // with selectedGroups so we can join back by index after resolution.
  const incoming: IncomingPerson[] = selectedGroups.map((g) => ({
    name: g.personName,
    email: null,
  }))

  withImportGate(() => {
    startImport(incoming, (resolved, createdCount) => {
      const occupants = combineRowOccupants(tickets.placements, vacations.entries)
      const newVacations = selectedGroups.flatMap((group, i) => {
        const personId = resolved.get(incoming[i]!)
        if (personId === undefined) return []
        return group.events.map((ev) => {
          const row = findFirstFreeRow(occupants, ev.startDate, ev.endDate)
          occupants.push({ startDate: ev.startDate, endDate: ev.endDate, row })
          return {
            personId,
            startDate: ev.startDate,
            endDate: ev.endDate,
            row,
          }
        })
      })
      vacations.addVacations(newVacations)
      if (createdCount > 0) sidebarRef.value?.openPeopleSection()
    })
  })
}


</script>

<template>
  <Transition name="drop-toast">
    <div v-if="rejectionMessage" class="rejection-toast">
      {{ rejectionMessage }}
    </div>
  </Transition>
  <div class="layout" ref="layoutRef">
    <header class="app-header">
      <span class="app-logo">
        <AppLogo class="app-logo-icon" />
        Ticket Timeline
      </span>
      <div class="header-actions">
        <button class="btn header-btn" @click="showSave = true">Save</button>
        <button class="btn header-btn" @click="showLoad = true">Load</button>
        <button class="btn header-btn" @click="showReset = true">Reset</button>
      </div>
    </header>
    <div class="below-header">
    <AppSidebar
      ref="sidebarRef"
      v-model:selected-months="selectedMonths"
      :bug-report-url="bugReportUrl"
      @open-add-person="showAddPerson = true"
      @open-add-ticket="showAddTicket = true"
      @open-add-label="showAddLabel = true"
      @open-upload-epic="showUploadEpic = true"
      @open-hibob="showHiBob = true"
      @edit-person="(p) => editingPerson = p"
      @edit-ticket="(t) => editingTicket = t"
      @edit-label="(l) => editingLabel = l"
      @vacation-person-clicked="(personId) => { vacationModalPersonId = personId; showAddVacation = true }"
    />

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
              <span class="shine-text">Project Brief</span>
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
                    <template v-else>Copy shareable link</template>
                  </span>
                  <span class="label-copied">Link copied</span>
                </div>
              </div>
            </button>
            <button class="info-btn" aria-label="About the share link" @click="showShareInfo = true">?</button>
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
      @confirm="handleHiBobConfirm"
      @cancel="hibobGroups = []"
    />
  </Transition>

  <Transition name="modal">
    <PeopleConfirmModal
      v-if="peopleConfirmRows.length > 0"
      :rows="peopleConfirmRows"
      :people="people.people"
      @confirm="handlePeopleConfirm"
      @cancel="handlePeopleCancel"
    />
  </Transition>

  <Teleport to="body">
    <Transition name="modal">
      <ShareInfoModal v-if="showShareInfo" @close="showShareInfo = false" />
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="toast">
      <div v-if="conflictToast" class="conflict-toast" @click="conflictToast = ''">
        {{ conflictToast }}
      </div>
    </Transition>
  </Teleport>

  <Transition name="modal">
    <div v-if="showReset" class="reset-backdrop" @click.self="showReset = false">
      <div class="reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
        <h3 id="reset-modal-title"><span class="shine-text">Reset Calendar</span></h3>
        <div class="reset-body">
          <p>This will permanently clear all people, tickets, events, and vacations from the calendar.</p>
          <p class="reset-warning">This action cannot be undone.</p>
        </div>
        <div class="reset-actions">
          <button class="btn" @click="showReset = false">Cancel</button>
          <button class="btn reset-confirm-btn" @click="resetAll">Clear Everything</button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showImportPrompt" class="reset-backdrop" @click.self="onImportCancel">
      <div class="reset-modal" role="dialog" aria-modal="true" aria-labelledby="import-prompt-title" @keydown.escape.prevent="onImportCancel">
        <h3 id="import-prompt-title"><span class="shine-text">Calendar Has Data</span></h3>
        <div class="reset-body">
          <p>Your calendar already has data. Would you like to merge the import in alongside it, or replace it?</p>
          <p class="reset-warning">Replace will permanently clear all current people, tickets, events, and vacations. This cannot be undone.</p>
        </div>
        <div class="reset-actions">
          <button class="btn" @click="onImportCancel">Cancel</button>
          <button class="btn" @click="onImportMerge">Merge</button>
          <button class="btn reset-confirm-btn" @click="onImportReplace">Replace</button>
        </div>
      </div>
    </div>
  </Transition>

  <HintBubble
    v-if="anyHintVisible && !anyModalOpen && hintTop !== null"
    :top="hintTop"
    :fading-out="hintFadingOut"
    @dismiss="dismissHint"
  />
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
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
    0 1px 4px rgba(0, 0, 0, 0.5);
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
  color: rgba(255, 255, 255, 0.55);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 1px rgba(255, 255, 255, 0.07),
    0 2px 5px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.25s ease;
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

.reset-confirm-btn {
  background: linear-gradient(180deg, #c0392b 0%, #a93226 100%);
  color: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
}

.below-header {
  display: flex;
  flex: 1;
  overflow: hidden;
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
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
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


.empty {
  padding: 1rem;
  color: #888;
  font-size: 0.9rem;
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
    scrollbar-width: none;
  }

  .below-header::-webkit-scrollbar {
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

:global(.conflict-toast) {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: #1a1a1a;
  border: 1px solid rgba(231, 76, 60, 0.45);
  color: rgba(255, 200, 195, 0.95);
  font-family: 'Nunito', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.6rem 1rem;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  max-width: calc(100vw - 2rem);
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
}

.rejection-toast {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  white-space: nowrap;
}

.drop-toast-enter-active { transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.drop-toast-leave-active { transition: opacity 0.3s ease; }
.drop-toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
.drop-toast-leave-to { opacity: 0; }

:global(.toast-enter-active) { transition: opacity 0.2s ease, transform 0.2s ease; }
:global(.toast-leave-active) { transition: opacity 0.3s ease, transform 0.3s ease; }
:global(.toast-enter-from) { opacity: 0; transform: translateX(-50%) translateY(8px); }
:global(.toast-leave-to) { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
