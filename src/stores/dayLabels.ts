import { reactive } from 'vue'
import { defineStore } from 'pinia'

export const useDayLabelsStore = defineStore('dayLabels', () => {
  const labels = reactive<Record<string, string>>({})

  function key(year: number, month: number, day: number) {
    return `${year}-${month}-${day}`
  }

  function getLabel(year: number, month: number, day: number): string {
    return labels[key(year, month, day)] ?? ''
  }

  function setLabel(year: number, month: number, day: number, text: string) {
    const k = key(year, month, day)
    if (text.trim()) labels[k] = text.trim()
    else delete labels[k]
  }

  return { getLabel, setLabel }
})
