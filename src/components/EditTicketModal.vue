<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Ticket, Placement, CalendarDate } from '../stores/tickets'
import type { Person } from '../stores/people'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  ticket: Ticket
  people: Person[]
  placement: Placement | null
}>()

const emit = defineEmits<{
  submit: [ticket: { number: string; title: string; assignedTo: number | null; link: string; startDate: CalendarDate | null; endDate: CalendarDate | null }]
  cancel: []
  delete: []
}>()

const number = ref(props.ticket.number)
const title = ref(props.ticket.title)
const assignedTo = ref<number | null>(props.ticket.assignedTo)
const link = ref(props.ticket.link)

function calToStr(d: CalendarDate): string {
  return `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

function parseDate(str: string): CalendarDate | null {
  if (!str) return null
  const [year, month, day] = str.split('-').map(Number) as [number, number, number]
  return { year, month: month - 1, day }
}

const startDateStr = ref(props.placement ? calToStr(props.placement.startDate) : '')
const endDateStr = ref(props.placement ? calToStr(props.placement.endDate) : '')

const datesValid = computed(() => {
  if (!startDateStr.value && !endDateStr.value) return true
  if (startDateStr.value && endDateStr.value) return endDateStr.value >= startDateStr.value
  return false
})

function clearDates() {
  startDateStr.value = ''
  endDateStr.value = ''
}

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
  <BaseModal title="Edit Ticket" size="compact" @close="emit('cancel')">
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
        <label class="app-label link-label">
          Ticket Link
          <a v-if="link.trim()" :href="link.trim()" target="_blank" rel="noopener" class="open-link" title="Open link">↗</a>
        </label>
        <input class="app-input" v-model="link" type="url" placeholder="https://..." @keydown.enter.prevent="handleSubmit" />
      </div>

      <div class="app-field schedule-field">
        <div class="schedule-label-row">
          <label class="app-label">Schedule</label>
          <button v-if="startDateStr || endDateStr" type="button" class="clear-btn" @click="clearDates">
            Remove from calendar
          </button>
        </div>
        <div class="date-row">
          <input class="app-input" v-model="startDateStr" type="date" />
          <span class="date-sep">to</span>
          <input class="app-input" v-model="endDateStr" type="date" :min="startDateStr" />
        </div>
        <p v-if="!datesValid" class="date-error">End date must be on or after start date.</p>
      </div>
    </div>

    <template #actions>
      <button class="btn btn-danger leading" @click="emit('delete')">Delete</button>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn" @click="handleSubmit" :disabled="!number.trim() || !title.trim() || !datesValid">Save</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.link-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.open-link {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: none;
  line-height: 1;
  transition: color 0.15s;
}

.open-link:hover {
  color: #fff;
}

.schedule-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.clear-btn {
  all: unset;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s;
  font-family: 'Nunito', sans-serif;
}

.clear-btn:hover {
  color: rgba(255, 255, 255, 0.7);
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
