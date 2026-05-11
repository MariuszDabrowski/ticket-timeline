<script setup lang="ts">
import { ref, computed } from 'vue'
import MonthCalendar from '../components/MonthCalendar.vue'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const currentYear = new Date().getFullYear()
const selectedMonths = ref<number[]>([])

const sortedMonths = computed(() => [...selectedMonths.value].sort((a, b) => a - b))
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <h3>Months {{ currentYear }}</h3>
      <label v-for="(name, index) in MONTH_NAMES" :key="index" class="month-option">
        <input type="checkbox" :value="index" v-model="selectedMonths" />
        {{ name }}
      </label>
    </aside>
    <main class="panel">
      <p v-if="selectedMonths.length === 0" class="empty">Select a month from the sidebar.</p>
      <MonthCalendar
        v-for="month in sortedMonths"
        :key="month"
        :year="currentYear"
        :month="month"
      />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 160px;
  flex-shrink: 0;
  border-right: 1px solid #ccc;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar h3 {
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.month-option {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.panel {
  flex: 1;
  overflow-y: auto;
}

.empty {
  padding: 1rem;
  color: #888;
  font-size: 0.9rem;
}
</style>
