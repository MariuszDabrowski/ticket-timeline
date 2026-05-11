import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CalendarDate } from './tickets'

export const useDragStateStore = defineStore('dragState', () => {
  const moveDrag = ref<{ ticketId: number; span: number } | null>(null)
  const movePreviewDate = ref<CalendarDate | null>(null)

  function startMoveDrag(ticketId: number, span: number) {
    moveDrag.value = { ticketId, span }
    movePreviewDate.value = null
  }

  function updateMovePreview(date: CalendarDate) {
    if (moveDrag.value) movePreviewDate.value = date
  }

  function clearMoveDrag() {
    moveDrag.value = null
    movePreviewDate.value = null
  }

  return { moveDrag, movePreviewDate, startMoveDrag, updateMovePreview, clearMoveDrag }
})
