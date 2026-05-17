import { ref, computed, toRaw } from 'vue'
import { usePeopleStore } from '../stores/people'
import { useTicketsStore } from '../stores/tickets'
import { useVacationsStore } from '../stores/vacations'
import {
  classifyIncoming,
  uniquifyName,
  type Classification,
  type IncomingPerson,
  type Decision,
} from '../utils/peopleMatch'

// Orchestrates the people-confirm dance and the existing-data import gate
// shared by every importer in the app (CSV epic + HiBob ICS + future
// sources). Owns:
//
//   - Sample/real data detection (hasAnyCalendarData, clearAllProjectData)
//   - The Replace/Merge/Cancel prompt that fires when an import lands on a
//     non-empty calendar (showImportPrompt + on{Replace,Merge,Cancel})
//   - Classification (autoMerge / autoCreate / needsConfirm)
//   - Side-effecting commit that creates new people, records emails, and
//     resolves the IncomingPerson → personId map
//   - PeopleConfirmModal state (peopleConfirmRows, handlePeopleConfirm /
//     handlePeopleCancel)
//
// Importers use it as:
//
//   const { startImport, withImportGate, ... } = useImportFlow()
//   withImportGate(() => {
//     startImport(incomingPeople, (resolved, createdCount) => {
//       // place tickets/vacations using resolved
//     })
//   })
export function useImportFlow() {
  const people = usePeopleStore()
  const tickets = useTicketsStore()
  const vacations = useVacationsStore()

  // PeopleConfirmModal state. Shared by every import source; the active
  // importer stashes its commit callback in `pendingPeopleConfirm` so the
  // modal's confirm/cancel can resume or abort the import.
  const peopleConfirmRows = ref<Classification[]>([])
  const pendingPeopleConfirm = ref<((decisions: Decision[]) => void) | null>(null)

  // Pure classification step. Buckets each incoming person by what the
  // orchestrator should do at commit time:
  //   - autoMerge: email-known or single exact-name match (silent merge)
  //   - autoCreate: no match anywhere (silent create)
  //   - needsConfirm: fuzzy / ambiguous (user must decide)
  //
  // Exact-name auto-merges only when there's a single unambiguous candidate —
  // multiple existing people with the same name promote to 'ambiguous' inside
  // classifyIncoming, which still routes to confirm.
  //
  // No store mutations here; every side effect runs in commit so cancelling
  // the people-confirm modal leaves zero trace.
  function resolveIncomingPeople(incoming: IncomingPerson[]): {
    autoMerge: Array<{ incoming: IncomingPerson; personId: number }>
    autoCreate: Classification[]
    needsConfirm: Classification[]
  } {
    const autoMerge: Array<{ incoming: IncomingPerson; personId: number }> = []
    const autoCreate: Classification[] = []
    const needsConfirm: Classification[] = []
    for (const p of incoming) {
      const c = classifyIncoming(p, people.people)
      if ((c.tier === 'email-known' || c.tier === 'exact-name') && c.suggestedPersonId !== undefined) {
        autoMerge.push({ incoming: p, personId: c.suggestedPersonId })
      } else if (c.tier === 'none') {
        autoCreate.push(c)
      } else {
        needsConfirm.push(c)
      }
    }
    return { autoMerge, autoCreate, needsConfirm }
  }

  function createPersonFor(c: Classification): number {
    const id = people.addPerson(uniquifyName(c.incoming.name, people.people))
    if (c.incoming.email) people.addEmail(id, c.incoming.email)
    return id
  }

  // Materialize user decisions. toRaw unwraps the IncomingPerson the modal
  // echoed back — Vue deep-wraps objects stored in ref(), so `d.incoming` is
  // a Proxy while the doImport callback looks up by the original ref from
  // the closure's incoming array. Without this, Map.get returns undefined
  // for every merge-confirmed person and their downstream rows get dropped.
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

  // Common entry: classify, optionally open PeopleConfirmModal, and finally
  // hand the resolved Map<IncomingPerson, number> to the caller's apply
  // step. createdCount tells the caller whether to open the sidebar's
  // People section after import.
  function startImport(
    incoming: IncomingPerson[],
    doImport: (resolved: Map<IncomingPerson, number>, createdCount: number) => void,
  ) {
    const { autoMerge, autoCreate, needsConfirm } = resolveIncomingPeople(incoming)

    const commit = (decisions: Decision[]) => {
      const resolved = new Map<IncomingPerson, number>()
      for (const m of autoMerge) {
        resolved.set(m.incoming, m.personId)
        // Record the incoming email on the matched person so future imports
        // of the same email go email-known (silent) rather than re-routing
        // through exact-name. Deferred until here so a cancel above leaves
        // no trace.
        if (m.incoming.email) people.addEmail(m.personId, m.incoming.email)
      }
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

  // Existing-data gate: if the calendar already has any data (seeded sample
  // OR the user's real work), ask up front whether to replace or merge.
  // Replace clears immediately (not deferred) — classification needs to see
  // the right roster, and a deferred clear could wipe a Person whose id was
  // already resolved against. Cancelling here aborts; cancelling later in
  // PeopleConfirmModal leaves whatever state this gate's decision produced.
  const showImportPrompt = ref(false)
  const pendingImportRun = ref<(() => void) | null>(null)

  const hasAnyCalendarData = computed(() =>
    people.people.length > 0 ||
    tickets.tickets.length > 0 ||
    vacations.entries.length > 0,
  )

  // Caller is responsible for the bookkeeping (project name, isSampleData
  // flag) that lives outside the stores. Pass a callback that runs after
  // the stores are cleared.
  let onClearProject: (() => void) | null = null
  function setOnClearProject(cb: () => void) {
    onClearProject = cb
  }

  function clearAllProjectData() {
    people.loadData([])
    tickets.loadData({ tickets: [], placements: [] })
    vacations.loadData([])
    onClearProject?.()
  }

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

  return {
    // Confirm-modal state + actions
    peopleConfirmRows,
    handlePeopleConfirm,
    handlePeopleCancel,
    // Import-gate state + actions
    showImportPrompt,
    hasAnyCalendarData,
    withImportGate,
    onImportReplace,
    onImportMerge,
    onImportCancel,
    setOnClearProject,
    // Core orchestration
    startImport,
  }
}
