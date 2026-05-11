import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useOptionsStore = defineStore('options', () => {
  const hideWeekends = ref(true)
  const showCanadianHolidays = ref(true)
  const showAmericanHolidays = ref(true)

  return { hideWeekends, showCanadianHolidays, showAmericanHolidays }
})
