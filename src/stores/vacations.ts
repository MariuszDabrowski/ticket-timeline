import { ref } from 'vue'
import { defineStore } from 'pinia'
import { compareCalendarDates } from './tickets'
import type { CalendarDate } from './tickets'

export interface VacationEntry {
  id: number
  personId: number
  startDate: CalendarDate
  endDate: CalendarDate
}

export const useVacationsStore = defineStore('vacations', () => {
  const entries = ref<VacationEntry[]>([])
  let nextId = 0

  function setVacations(incoming: Omit<VacationEntry, 'id'>[]) {
    entries.value = incoming.map((e) => ({ ...e, id: nextId++ }))
  }

  function clearVacations() {
    entries.value = []
  }

  function getVacationsForMonth(year: number, month: number): VacationEntry[] {
    const monthStart: CalendarDate = { year, month, day: 1 }
    const monthEnd: CalendarDate = { year, month, day: new Date(year, month + 1, 0).getDate() }
    return entries.value.filter(
      (e) =>
        compareCalendarDates(e.startDate, monthEnd) <= 0 &&
        compareCalendarDates(e.endDate, monthStart) >= 0,
    )
  }

  return { entries, setVacations, clearVacations, getVacationsForMonth }
})
