<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Person } from '../stores/people'
import type { CalendarDate } from '../stores/tickets'
import BaseModal from './BaseModal.vue'
import PersonPicker from './PersonPicker.vue'

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
      <div class="app-field">
        <label class="app-label">Person</label>
        <div v-if="people.length === 0" class="empty-note">Add people to the team first.</div>
        <PersonPicker v-else :people="people" v-model="selectedPersonId" />
      </div>
      <div class="app-field">
        <label class="app-label">Dates</label>
        <div class="date-row">
          <input class="app-input" v-model="startDateStr" type="date" />
          <span class="date-sep">to</span>
          <input class="app-input" v-model="endDateStr" type="date" :min="startDateStr" />
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

.date-row .app-input {
  flex: 1;
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
