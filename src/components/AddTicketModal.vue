<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Person } from '../stores/people'
import type { CalendarDate } from '../stores/tickets'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  people: Person[]
}>()

const emit = defineEmits<{
  submit: [ticket: { number: string; title: string; assignedTo: number | null; link: string; startDate: CalendarDate | null; endDate: CalendarDate | null }]
  cancel: []
}>()

const number = ref('')
const title = ref('')
const assignedTo = ref<number | null>(null)
const link = ref('')
const startDateStr = ref('')
const endDateStr = ref('')

function parseDate(str: string): CalendarDate | null {
  if (!str) return null
  const [year, month, day] = str.split('-').map(Number) as [number, number, number]
  return { year, month: month - 1, day }
}

const datesValid = computed(() => {
  if (!startDateStr.value && !endDateStr.value) return true
  if (startDateStr.value && endDateStr.value) return endDateStr.value >= startDateStr.value
  return false
})

function handleSubmit() {
  if (!number.value.trim() || !title.value.trim() || !datesValid.value) return
  emit('submit', {
    number: number.value.trim(),
    title: title.value.trim(),
    assignedTo: assignedTo.value,
    link: link.value.trim(),
    startDate: parseDate(startDateStr.value),
    endDate: parseDate(endDateStr.value),
  })
}
</script>

<template>
  <BaseModal title="Add Ticket" size="compact" @close="emit('cancel')">
    <div class="modal-body form-body" v-simplebar>
      <div class="app-field">
        <label class="app-label">Ticket ID</label>
        <input class="app-input" v-model="number" type="text" placeholder="e.g. PROJ-123" @keydown.enter.prevent="handleSubmit" />
      </div>

      <div class="app-field">
        <label class="app-label">Title</label>
        <input class="app-input" v-model="title" type="text" placeholder="Ticket title" @keydown.enter.prevent="handleSubmit" />
      </div>

      <div class="app-field">
        <label class="app-label">Assigned To</label>
        <select class="app-select" v-model="assignedTo">
          <option :value="null">Unassigned</option>
          <option v-for="person in props.people" :key="person.id" :value="person.id">
            {{ person.name }}
          </option>
        </select>
      </div>

      <div class="app-field">
        <label class="app-label">Ticket Link</label>
        <input class="app-input" v-model="link" type="url" placeholder="https://..." @keydown.enter.prevent="handleSubmit" />
      </div>

      <div class="app-field schedule-field">
        <label class="app-label">Schedule <span class="app-label-hint">— optional</span></label>
        <div class="date-row">
          <input class="app-input" v-model="startDateStr" type="date" />
          <span class="date-sep">to</span>
          <input class="app-input" v-model="endDateStr" type="date" :min="startDateStr" />
        </div>
        <p v-if="!datesValid" class="date-error">End date must be on or after start date.</p>
      </div>
    </div>

    <template #actions>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn" @click="handleSubmit" :disabled="!number.trim() || !title.trim() || !datesValid">Add</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* Field-form body — wider side padding + larger gap than default. */
.form-body {
  padding: 0 1.5rem;
  gap: 1rem;
}
.form-body :deep(.simplebar-content) {
  gap: 1rem;
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

.schedule-field {
  display: none;
}

@media (pointer: coarse) {
  .schedule-field {
    display: flex;
  }
}
</style>
