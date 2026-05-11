<script setup lang="ts">
import { ref, computed } from 'vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import AddUserModal from '../components/AddUserModal.vue'
import { usePeopleStore } from '../stores/people'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const currentYear = new Date().getFullYear()
const selectedMonths = ref<number[]>([])
const sortedMonths = computed(() => [...selectedMonths.value].sort((a, b) => a - b))

const people = usePeopleStore()
const showModal = ref(false)

function handleAddPerson(name: string) {
  people.addPerson(name)
  showModal.value = false
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <section>
        <h3>Months {{ currentYear }}</h3>
        <label v-for="(name, index) in MONTH_NAMES" :key="index" class="month-option">
          <input type="checkbox" :value="index" v-model="selectedMonths" />
          {{ name }}
        </label>
      </section>

      <section>
        <h3>People</h3>
        <button class="add-btn" @click="showModal = true">+ Add Person</button>
        <ul class="people-list">
          <li v-for="person in people.people" :key="person.id" class="person">
            <span class="color-dot" :style="{ background: person.color }" />
            {{ person.name }}
          </li>
        </ul>
      </section>
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

  <AddUserModal
    v-if="showModal"
    @submit="handleAddPerson"
    @cancel="showModal = false"
  />
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid #ccc;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h3 {
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

.add-btn {
  font-size: 0.85rem;
  cursor: pointer;
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.3rem 0.6rem;
  width: 100%;
  text-align: left;
}

.people-list {
  list-style: none;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.person {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
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
