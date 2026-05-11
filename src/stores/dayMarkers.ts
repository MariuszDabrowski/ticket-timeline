import { reactive } from 'vue'
import { defineStore } from 'pinia'

export interface DayMarker {
  color: string
  note: string
}

export const useDayMarkersStore = defineStore('dayMarkers', () => {
  const markers = reactive<Record<string, DayMarker>>({})

  function key(year: number, month: number, day: number) {
    return `${year}-${month}-${day}`
  }

  function getMarker(year: number, month: number, day: number): DayMarker | null {
    return markers[key(year, month, day)] ?? null
  }

  function setMarker(year: number, month: number, day: number, marker: DayMarker | null) {
    const k = key(year, month, day)
    if (marker) markers[k] = marker
    else delete markers[k]
  }

  return { getMarker, setMarker }
})
