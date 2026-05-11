<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  year: number
  month: number
}>()

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const monthName = computed(() => MONTH_NAMES[props.month])
const startOffset = computed(() => new Date(props.year, props.month, 1).getDay())
const daysInMonth = computed(() => new Date(props.year, props.month + 1, 0).getDate())
</script>

<template>
  <div class="month-calendar">
    <h2>{{ monthName }} {{ year }}</h2>
    <div class="grid">
      <div v-for="day in DAY_HEADERS" :key="day" class="cell header">{{ day }}</div>
      <div v-for="n in startOffset" :key="`empty-${n}`" class="cell" />
      <div v-for="day in daysInMonth" :key="day" class="cell day">{{ day }}</div>
    </div>
  </div>
</template>

<style scoped>
.month-calendar {
  padding: 1rem;
  border-bottom: 1px solid #ccc;
}

h2 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
  font-weight: bold;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cell {
  padding: 0.25rem;
  font-size: 0.85rem;
  min-height: 80px;
  vertical-align: top;
}

.header {
  font-weight: bold;
  text-align: center;
  min-height: unset;
}

.day {
  text-align: left;
  border-top: 1px solid #ccc;
}
</style>
