import { reactive, computed } from 'vue'
import { defineStore } from 'pinia'

interface RowCounts {
  tickets: Record<number, number>
  vacations: Record<number, number>
}

export const useCalendarLayoutStore = defineStore('calendarLayout', () => {
  const rowCounts = reactive(new Map<string, RowCounts>())

  function register(key: string, tickets: Record<number, number>, vacations: Record<number, number> = {}) {
    rowCounts.set(key, { tickets, vacations })
  }

  function unregister(key: string) {
    rowCounts.delete(key)
  }

  const maxTicketSlotsPerRow = computed<Record<number, number>>(() => {
    const result: Record<number, number> = {}
    for (const { tickets } of rowCounts.values()) {
      for (const rowStr in tickets) {
        const row = Number(rowStr)
        result[row] = Math.max(result[row] ?? 0, tickets[row] ?? 0)
      }
    }
    return result
  })

  const maxVacationSlotsPerRow = computed<Record<number, number>>(() => {
    const result: Record<number, number> = {}
    for (const { vacations } of rowCounts.values()) {
      for (const rowStr in vacations) {
        const row = Number(rowStr)
        result[row] = Math.max(result[row] ?? 0, vacations[row] ?? 0)
      }
    }
    return result
  })

  // Kept for backward compat — total slots per row
  const maxSlotsPerRow = computed<Record<number, number>>(() => {
    const result: Record<number, number> = {}
    for (const row in maxTicketSlotsPerRow.value) {
      result[row] = (maxTicketSlotsPerRow.value[row] ?? 0) + (maxVacationSlotsPerRow.value[Number(row)] ?? 0)
    }
    for (const row in maxVacationSlotsPerRow.value) {
      if (!(row in result)) result[Number(row)] = maxVacationSlotsPerRow.value[Number(row)] ?? 0
    }
    return result
  })

  return { register, unregister, maxTicketSlotsPerRow, maxVacationSlotsPerRow, maxSlotsPerRow }
})
