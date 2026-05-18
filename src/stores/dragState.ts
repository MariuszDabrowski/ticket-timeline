import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { CalendarDate } from './tickets'

function datesEqual(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

export const useDragStateStore = defineStore('dragState', () => {
  // Cross-drag shared state. movePreviewRow is the row index the cursor is
  // hovering during any *move* drag (ticket move, vacation move, sidebar
  // new-vacation drag) — all three share one row so the cascade preview can
  // render off a single source of truth. The two hovered ids are cleared on
  // every drag end because cascade-pushed pills can vanish out from under
  // the cursor before their own mouseleave fires.
  const movePreviewRow = ref<number | null>(null)
  const hoveredTicketId = ref<number | null>(null)
  const hoveredVacationId = ref<number | null>(null)

  // Factory: every drag type was implementing the same triple (start,
  // updatePreview, clear) over a payload + a preview date. Centralizing the
  // boilerplate means a future hover-clearing tweak (or any other shared
  // behavior) lands in one place. `withRow: true` opts the drag into the
  // shared movePreviewRow lifecycle.
  function makeDrag<T>(opts: { withRow?: boolean } = {}) {
    const drag = ref<T | null>(null)
    const previewDate = ref<CalendarDate | null>(null)

    function start(payload: T) {
      drag.value = payload
      previewDate.value = null
      if (opts.withRow) movePreviewRow.value = null
    }

    function updatePreview(date: CalendarDate) {
      if (!drag.value) return
      const cur = previewDate.value
      if (cur && datesEqual(cur, date)) return
      previewDate.value = date
    }

    function clear() {
      drag.value = null
      previewDate.value = null
      if (opts.withRow) movePreviewRow.value = null
      hoveredTicketId.value = null
      hoveredVacationId.value = null
    }

    return { drag, previewDate, start, updatePreview, clear }
  }

  const ticketMove = makeDrag<{ ticketId: number; span: number }>({ withRow: true })
  const ticketResize = makeDrag<{ ticketId: number; side: 'start' | 'end' }>()
  const vacationMove = makeDrag<{ vacationId: number; span: number }>({ withRow: true })
  const vacationResize = makeDrag<{ vacationId: number; side: 'start' | 'end' }>()
  // Sidebar drag for a brand-new vacation. Mirrors vacationMove but isn't
  // tied to an existing id — previewItems injects a virtual occupant keyed
  // 'new-vacation' so the cascade preview runs the same as a real move.
  const newVacation = makeDrag<{ personId: number }>({ withRow: true })

  function updateMovePreviewRow(row: number) {
    if (!ticketMove.drag.value && !vacationMove.drag.value && !newVacation.drag.value) return
    if (movePreviewRow.value === row) return
    movePreviewRow.value = row
  }

  const isAnyActive = computed(() =>
    ticketMove.drag.value !== null ||
    ticketResize.drag.value !== null ||
    vacationMove.drag.value !== null ||
    vacationResize.drag.value !== null ||
    newVacation.drag.value !== null,
  )

  // External API names + positional start signatures preserved verbatim so
  // every call site continues to work unchanged.
  return {
    moveDrag: ticketMove.drag,
    movePreviewDate: ticketMove.previewDate,
    movePreviewRow,
    startMoveDrag: (ticketId: number, span: number) => ticketMove.start({ ticketId, span }),
    updateMovePreview: ticketMove.updatePreview,
    updateMovePreviewRow,
    clearMoveDrag: ticketMove.clear,

    resizeDrag: ticketResize.drag,
    resizePreviewDate: ticketResize.previewDate,
    startResizeDrag: (ticketId: number, side: 'start' | 'end') => ticketResize.start({ ticketId, side }),
    updateResizePreview: ticketResize.updatePreview,
    clearResizeDrag: ticketResize.clear,

    vacationResizeDrag: vacationResize.drag,
    vacationResizePreviewDate: vacationResize.previewDate,
    startVacationResizeDrag: (vacationId: number, side: 'start' | 'end') => vacationResize.start({ vacationId, side }),
    updateVacationResizePreview: vacationResize.updatePreview,
    clearVacationResizeDrag: vacationResize.clear,

    vacationMoveDrag: vacationMove.drag,
    vacationMovePreviewDate: vacationMove.previewDate,
    startVacationMoveDrag: (vacationId: number, span: number) => vacationMove.start({ vacationId, span }),
    updateVacationMovePreview: vacationMove.updatePreview,
    clearVacationMoveDrag: vacationMove.clear,

    newVacationDrag: newVacation.drag,
    newVacationPreviewDate: newVacation.previewDate,
    startNewVacationDrag: (personId: number) => newVacation.start({ personId }),
    updateNewVacationPreview: newVacation.updatePreview,
    clearNewVacationDrag: newVacation.clear,

    hoveredTicketId,
    hoveredVacationId,

    isAnyActive,
  }
})
