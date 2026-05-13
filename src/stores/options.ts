import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useOptionsStore = defineStore('options', () => {
  const hideWeekends = ref(true)
  const showCanadianHolidays = ref(true)
  const showAmericanHolidays = ref(true)
  const showAllTooltips = ref(false)
  const hiddenPersonIds = ref<Set<number>>(new Set())

  function togglePersonVisibility(id: number) {
    if (hiddenPersonIds.value.has(id)) {
      hiddenPersonIds.value.delete(id)
    } else {
      hiddenPersonIds.value.add(id)
    }
  }

  return { hideWeekends, showCanadianHolidays, showAmericanHolidays, showAllTooltips, hiddenPersonIds, togglePersonVisibility }
})
