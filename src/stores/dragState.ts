import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CalendarDate } from './tickets'

export const useDragStateStore = defineStore('dragState', () => {
  const moveDrag = ref<{ ticketId: number; span: number } | null>(null)
  const movePreviewDate = ref<CalendarDate | null>(null)
  // Row index the cursor is hovering during a ticket move. Set by drop targets
  // each dragover frame; read by the cascade-push preview so every visible
  // month renders the same would-be layout.
  const movePreviewRow = ref<number | null>(null)

  const resizeDrag = ref<{ ticketId: number; side: 'start' | 'end' } | null>(null)
  const resizePreviewDate = ref<CalendarDate | null>(null)

  function startMoveDrag(ticketId: number, span: number) {
    moveDrag.value = { ticketId, span }
    movePreviewDate.value = null
    movePreviewRow.value = null
  }

  function updateMovePreview(date: CalendarDate) {
    if (!moveDrag.value) return
    const cur = movePreviewDate.value
    if (cur && cur.year === date.year && cur.month === date.month && cur.day === date.day) return
    movePreviewDate.value = date
  }

  function updateMovePreviewRow(row: number) {
    // Set the preview row for whichever move drag is active (ticket move,
    // vacation move, or sidebar new-vacation drag) — all three run the same
    // cascade preview off this value.
    if (!moveDrag.value && !vacationMoveDrag.value && !newVacationDrag.value) return
    if (movePreviewRow.value === row) return
    movePreviewRow.value = row
  }

  function clearMoveDrag() {
    moveDrag.value = null
    movePreviewDate.value = null
    movePreviewRow.value = null
    // Clear hover too — cascade-pushed pills can vanish under the cursor
    // before their mouseleave fires, leaving a stale hovered id that dims
    // every other pill until the next manual hover.
    hoveredTicketId.value = null
    hoveredVacationId.value = null
  }

  function startResizeDrag(ticketId: number, side: 'start' | 'end') {
    resizeDrag.value = { ticketId, side }
    resizePreviewDate.value = null
  }

  function updateResizePreview(date: CalendarDate) {
    if (!resizeDrag.value) return
    const cur = resizePreviewDate.value
    if (cur && cur.year === date.year && cur.month === date.month && cur.day === date.day) return
    resizePreviewDate.value = date
  }

  function clearResizeDrag() {
    resizeDrag.value = null
    resizePreviewDate.value = null
    hoveredTicketId.value = null
    hoveredVacationId.value = null
  }

  const vacationResizeDrag = ref<{ vacationId: number; side: 'start' | 'end' } | null>(null)
  const vacationResizePreviewDate = ref<CalendarDate | null>(null)

  function startVacationResizeDrag(vacationId: number, side: 'start' | 'end') {
    vacationResizeDrag.value = { vacationId, side }
    vacationResizePreviewDate.value = null
  }

  function updateVacationResizePreview(date: CalendarDate) {
    if (!vacationResizeDrag.value) return
    const cur = vacationResizePreviewDate.value
    if (cur && cur.year === date.year && cur.month === date.month && cur.day === date.day) return
    vacationResizePreviewDate.value = date
  }

  function clearVacationResizeDrag() {
    vacationResizeDrag.value = null
    vacationResizePreviewDate.value = null
    hoveredTicketId.value = null
    hoveredVacationId.value = null
  }

  const vacationMoveDrag = ref<{ vacationId: number; span: number } | null>(null)
  const vacationMovePreviewDate = ref<CalendarDate | null>(null)

  function startVacationMoveDrag(vacationId: number, span: number) {
    vacationMoveDrag.value = { vacationId, span }
    vacationMovePreviewDate.value = null
    movePreviewRow.value = null
  }

  function updateVacationMovePreview(date: CalendarDate) {
    if (!vacationMoveDrag.value) return
    const cur = vacationMovePreviewDate.value
    if (cur && cur.year === date.year && cur.month === date.month && cur.day === date.day) return
    vacationMovePreviewDate.value = date
  }

  function clearVacationMoveDrag() {
    vacationMoveDrag.value = null
    vacationMovePreviewDate.value = null
    movePreviewRow.value = null
    hoveredTicketId.value = null
    hoveredVacationId.value = null
  }

  // Sidebar drag for a brand-new vacation. Mirrors vacationMoveDrag but isn't
  // tied to an existing vacation id — previewItems injects a virtual occupant
  // keyed 'new-vacation' so the cascade preview runs the same as a real move.
  const newVacationDrag = ref<{ personId: number } | null>(null)
  const newVacationPreviewDate = ref<CalendarDate | null>(null)

  function startNewVacationDrag(personId: number) {
    newVacationDrag.value = { personId }
    newVacationPreviewDate.value = null
    movePreviewRow.value = null
  }

  function updateNewVacationPreview(date: CalendarDate) {
    if (!newVacationDrag.value) return
    const cur = newVacationPreviewDate.value
    if (cur && cur.year === date.year && cur.month === date.month && cur.day === date.day) return
    newVacationPreviewDate.value = date
  }

  function clearNewVacationDrag() {
    newVacationDrag.value = null
    newVacationPreviewDate.value = null
    movePreviewRow.value = null
    hoveredTicketId.value = null
    hoveredVacationId.value = null
  }

  const hoveredTicketId = ref<number | null>(null)
  const hoveredVacationId = ref<number | null>(null)

  return {
    moveDrag, movePreviewDate, movePreviewRow, startMoveDrag, updateMovePreview, updateMovePreviewRow, clearMoveDrag,
    resizeDrag, resizePreviewDate, startResizeDrag, updateResizePreview, clearResizeDrag,
    vacationResizeDrag, vacationResizePreviewDate, startVacationResizeDrag, updateVacationResizePreview, clearVacationResizeDrag,
    vacationMoveDrag, vacationMovePreviewDate, startVacationMoveDrag, updateVacationMovePreview, clearVacationMoveDrag,
    newVacationDrag, newVacationPreviewDate, startNewVacationDrag, updateNewVacationPreview, clearNewVacationDrag,
    hoveredTicketId, hoveredVacationId,
  }
})
