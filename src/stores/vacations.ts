import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { compareCalendarDates } from './tickets'
import type { CalendarDate } from './tickets'

export interface VacationEntry {
  id: number
  personId: number
  startDate: CalendarDate | null  // null = unplaced (sidebar only)
  endDate: CalendarDate | null
  row: number  // shared row space with ticket placements; ignored when unplaced
}

export const useVacationsStore = defineStore('vacations', () => {
  const entries = ref<VacationEntry[]>([])
  let nextId = 0

  const unplacedVacations = computed(() => entries.value.filter((e) => e.startDate === null))

  function addVacation(personId: number): number {
    const id = nextId++
    entries.value.push({ id, personId, startDate: null, endDate: null, row: 0 })
    return id
  }

  function placeVacation(id: number, startDate: CalendarDate, endDate: CalendarDate, row = 0) {
    const entry = entries.value.find((e) => e.id === id)
    if (entry) {
      entry.startDate = startDate
      entry.endDate = endDate
      entry.row = row
    }
  }

  function moveVacation(id: number, startDate: CalendarDate, endDate: CalendarDate, row?: number) {
    const entry = entries.value.find((e) => e.id === id)
    if (entry) {
      entry.startDate = startDate
      entry.endDate = endDate
      if (row !== undefined) entry.row = row
    }
  }

  function removeVacation(id: number) {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

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
        e.startDate !== null &&
        e.endDate !== null &&
        compareCalendarDates(e.startDate, monthEnd) <= 0 &&
        compareCalendarDates(e.endDate, monthStart) >= 0,
    )
  }

  function removeVacationsForPerson(personId: number) {
    entries.value = entries.value.filter((e) => e.personId !== personId)
  }

  function addVacations(incoming: Omit<VacationEntry, 'id'>[]) {
    const affectedIds = new Set(incoming.map((e) => e.personId))
    entries.value = [
      ...entries.value.filter((e) => !affectedIds.has(e.personId)),
      ...incoming.map((e) => ({ ...e, id: nextId++ })),
    ]
  }

  function loadData(loaded: VacationEntry[]) {
    entries.value = loaded
    nextId = loaded.length > 0 ? Math.max(...loaded.map((e) => e.id)) + 1 : 0
  }

  return {
    entries, unplacedVacations,
    addVacation, placeVacation, moveVacation, removeVacation,
    setVacations, clearVacations, getVacationsForMonth,
    removeVacationsForPerson, addVacations, loadData,
  }
})
