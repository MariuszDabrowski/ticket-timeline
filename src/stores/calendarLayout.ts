import { reactive, computed } from 'vue'
import { defineStore } from 'pinia'

export const useCalendarLayoutStore = defineStore('calendarLayout', () => {
  // Each MonthCalendar registers its per-row slot counts keyed by "year-month"
  const rowCounts = reactive(new Map<string, Record<number, number>>())

  function register(key: string, counts: Record<number, number>) {
    rowCounts.set(key, counts)
  }

  function unregister(key: string) {
    rowCounts.delete(key)
  }

  // Global maximum slot count per row index across all registered months
  const maxSlotsPerRow = computed<Record<number, number>>(() => {
    const result: Record<number, number> = {}
    for (const counts of rowCounts.values()) {
      for (const rowStr in counts) {
        const row = Number(rowStr)
        result[row] = Math.max(result[row] ?? 0, counts[row] ?? 0)
      }
    }
    return result
  })

  return { register, unregister, maxSlotsPerRow }
})
