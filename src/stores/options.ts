import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useOptionsStore = defineStore('options', () => {
  const hideWeekends = ref(true)
  const showCanadianHolidays = ref(true)
  const showAmericanHolidays = ref(true)
  const showAllTooltips = ref(false)
  const hiddenPersonIds = ref<Set<number>>(new Set())
  const hiddenStates = ref<Set<string>>(new Set())

  function togglePersonVisibility(id: number) {
    if (hiddenPersonIds.value.has(id)) {
      hiddenPersonIds.value.delete(id)
    } else {
      hiddenPersonIds.value.add(id)
    }
  }

  function toggleStateVisibility(state: string) {
    if (hiddenStates.value.has(state)) {
      hiddenStates.value.delete(state)
    } else {
      hiddenStates.value.add(state)
    }
  }

  return { hideWeekends, showCanadianHolidays, showAmericanHolidays, showAllTooltips, hiddenPersonIds, togglePersonVisibility, hiddenStates, toggleStateVisibility }
})
