<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Person } from '../stores/people'
import type { CalendarDate } from '../stores/tickets'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ people: Person[]; preselectedPersonId?: number | null }>()
const emit = defineEmits<{ save: [personId: number, startDate: CalendarDate | null, endDate: CalendarDate | null]; cancel: [] }>()

const selectedPersonId = ref<number | null>(props.preselectedPersonId ?? props.people[0]?.id ?? null)
const startDateStr = ref('')
const endDateStr = ref('')

function parseDate(str: string): CalendarDate | null {
  if (!str) return null
  const [year, month, day] = str.split('-').map(Number) as [number, number, number]
  return { year, month: month - 1, day }
}

const datesValid = computed(() => {
  if (!startDateStr.value || !endDateStr.value) return false
  return endDateStr.value >= startDateStr.value
})
</script>

<template>
  <BaseModal title="Add Vacation" size="compact" @close="emit('cancel')">
    <div class="modal-body form-body" v-simplebar>
      <div class="field">
        <label>Person</label>
        <div v-if="people.length === 0" class="empty-note">Add people to the team first.</div>
        <div v-else class="person-list">
          <button
            v-for="person in people"
            :key="person.id"
            class="person-btn"
            :class="{ selected: selectedPersonId === person.id }"
            @click="selectedPersonId = person.id"
          >
            <span class="dot" :style="{ background: person.color }" />
            {{ person.name }}
          </button>
        </div>
      </div>
      <div class="field">
        <label>Dates</label>
        <div class="date-row">
          <input v-model="startDateStr" type="date" />
          <span class="date-sep">to</span>
          <input v-model="endDateStr" type="date" :min="startDateStr" />
        </div>
        <p v-if="startDateStr && endDateStr && !datesValid" class="date-error">End date must be on or after start date.</p>
      </div>
    </div>

    <template #actions>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button
        class="btn"
        @click="selectedPersonId !== null && emit('save', selectedPersonId, parseDate(startDateStr), parseDate(endDateStr))"
        :disabled="selectedPersonId === null || people.length === 0 || !startDateStr || !endDateStr || !datesValid"
      >Add</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-body {
  padding: 1.25rem 1.5rem;
  gap: 1rem;
}
.form-body :deep(.simplebar-content) {
  gap: 1rem;
  padding-bottom: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.person-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.person-btn {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.65rem;
  font-size: 14px;
  font-family: 'Nunito', sans-serif;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.person-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.9);
}

.person-btn.selected {
  border-color: rgba(167, 139, 250, 0.5);
  background: rgba(167, 139, 250, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.person-btn::after {
  display: none;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.empty-note {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-row input {
  flex: 1;
  padding: 0.45rem 0.65rem;
  font-size: 14px;
  font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  outline: none;
  transition: border-color 0.15s;
}

.date-row input:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1) opacity(0.4);
  cursor: pointer;
}

.date-sep {
  font-size: 13px;
  opacity: 0.5;
  flex-shrink: 0;
}

.date-error {
  font-size: 12px;
  color: #e74c3c;
}
</style>
