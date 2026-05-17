import { computed, type Ref } from 'vue'
import { useOptionsStore } from '../stores/options'
import { getCanadianHolidays, getAmericanHolidays } from '../utils/holidays'

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_HEADERS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Pure month-grid computation: which days are visible, which column each day
// sits in, which week-row it belongs to, and a same-day "is today" check.
// Listens to options.hideWeekends so toggling the option re-flows the grid.
//
// year / month are passed as Refs so the composable stays reactive when the
// caller iterates over month tuples (HomeView renders one MonthCalendar per
// visible month).
export function useMonthGrid(year: Ref<number>, month: Ref<number>) {
  const options = useOptionsStore()

  const monthName = computed(() => MONTH_NAMES[month.value])
  const daysInMonth = computed(() => new Date(year.value, month.value + 1, 0).getDate())

  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()
  const isToday = (day: number) =>
    year.value === todayYear && month.value === todayMonth && day === todayDay

  function isWeekend(day: number): boolean {
    const dow = new Date(year.value, month.value, day).getDay()
    return dow === 0 || dow === 6
  }

  const dayHeaders = computed(() => options.hideWeekends ? WEEKDAY_HEADERS_SHORT : WEEKDAY_HEADERS)
  const columnCount = computed(() => options.hideWeekends ? 5 : 7)

  const visibleDays = computed(() => {
    const days: number[] = []
    for (let d = 1; d <= daysInMonth.value; d++) {
      if (options.hideWeekends && isWeekend(d)) continue
      days.push(d)
    }
    return days
  })

  const startOffset = computed(() => {
    if (options.hideWeekends) {
      for (let d = 1; d <= daysInMonth.value; d++) {
        const dow = new Date(year.value, month.value, d).getDay()
        if (dow !== 0 && dow !== 6) return dow - 1 // Mon=0 … Fri=4
      }
      return 0
    }
    return new Date(year.value, month.value, 1).getDay()
  })

  // Maps each visible weekday number to its 0-based index among weekdays
  // (used for colPos when weekends are hidden).
  const weekdayIndexMap = computed(() => {
    if (!options.hideWeekends) return new Map<number, number>()
    const map = new Map<number, number>()
    let idx = 0
    for (let d = 1; d <= daysInMonth.value; d++) {
      const dow = new Date(year.value, month.value, d).getDay()
      if (dow !== 0 && dow !== 6) map.set(d, idx++)
    }
    return map
  })

  const firstVisibleDay = computed(() => visibleDays.value[0] ?? 1)
  const lastVisibleDay = computed(() => visibleDays.value[visibleDays.value.length - 1] ?? daysInMonth.value)

  const holidayMap = computed(() => {
    const map = new Map<number, string>()
    for (const h of getCanadianHolidays(year.value)) {
      if (h.date.month === month.value) map.set(h.date.day, `CA ${h.name}`)
    }
    for (const h of getAmericanHolidays(year.value)) {
      if (h.date.month === month.value) map.set(h.date.day, `US ${h.name}`)
    }
    return map
  })

  function colPos(day: number): number {
    if (options.hideWeekends) {
      const idx = weekdayIndexMap.value.get(day) ?? 0
      return (startOffset.value + idx) % columnCount.value
    }
    return (startOffset.value + day - 1) % columnCount.value
  }

  function dayRowIndex(visibleDayIndex: number): number {
    return Math.floor((startOffset.value + visibleDayIndex) / columnCount.value)
  }

  return {
    monthName,
    daysInMonth,
    dayHeaders,
    columnCount,
    visibleDays,
    startOffset,
    firstVisibleDay,
    lastVisibleDay,
    holidayMap,
    isToday,
    isWeekend,
    colPos,
    dayRowIndex,
  }
}
