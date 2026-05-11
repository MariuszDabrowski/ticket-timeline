import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useOptionsStore = defineStore('options', () => {
  const hideWeekends = ref(false)
  const showCanadianHolidays = ref(false)
  const showAmericanHolidays = ref(false)

  return { hideWeekends, showCanadianHolidays, showAmericanHolidays }
})
