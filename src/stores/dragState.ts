import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CalendarDate } from './tickets'

export const useDragStateStore = defineStore('dragState', () => {
  const moveDrag = ref<{ ticketId: number; span: number } | null>(null)
  const movePreviewDate = ref<CalendarDate | null>(null)

  const resizeDrag = ref<{ ticketId: number; side: 'start' | 'end' } | null>(null)
  const resizePreviewDate = ref<CalendarDate | null>(null)

  function startMoveDrag(ticketId: number, span: number) {
    moveDrag.value = { ticketId, span }
    movePreviewDate.value = null
  }

  function updateMovePreview(date: CalendarDate) {
    if (!moveDrag.value) return
    const cur = movePreviewDate.value
    if (cur && cur.year === date.year && cur.month === date.month && cur.day === date.day) return
    movePreviewDate.value = date
  }

  function clearMoveDrag() {
    moveDrag.value = null
    movePreviewDate.value = null
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
  }

  const hoveredTicketId = ref<number | null>(null)
  const hoveredVacationId = ref<number | null>(null)

  return {
    moveDrag, movePreviewDate, startMoveDrag, updateMovePreview, clearMoveDrag,
    resizeDrag, resizePreviewDate, startResizeDrag, updateResizePreview, clearResizeDrag,
    hoveredTicketId, hoveredVacationId,
  }
})
