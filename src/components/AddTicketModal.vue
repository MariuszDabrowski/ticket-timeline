<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Person } from '../stores/people'
import type { CalendarDate } from '../stores/tickets'
import { useFocusTrap } from '../composables/useFocusTrap'

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
const { trapRef, onKeydown } = useFocusTrap()

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
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal" ref="trapRef" role="dialog" aria-modal="true" aria-labelledby="add-ticket-modal-title" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3 id="add-ticket-modal-title"><span>Add Ticket</span></h3>

      <div class="modal-body" v-simplebar>
        <div class="field">
          <label>Ticket ID</label>
          <input v-model="number" type="text" placeholder="e.g. PROJ-123" @keydown.enter.prevent="handleSubmit" />
        </div>

        <div class="field">
          <label>Title</label>
          <input v-model="title" type="text" placeholder="Ticket title" @keydown.enter.prevent="handleSubmit" />
        </div>

        <div class="field">
          <label>Assigned To</label>
          <select v-model="assignedTo">
            <option :value="null">Unassigned</option>
            <option v-for="person in props.people" :key="person.id" :value="person.id">
              {{ person.name }}
            </option>
          </select>
        </div>

        <div class="field">
          <label>Ticket Link</label>
          <input v-model="link" type="url" placeholder="https://..." @keydown.enter.prevent="handleSubmit" />
        </div>

        <div class="field schedule-field">
          <label>Schedule <span class="label-hint">— optional</span></label>
          <div class="date-row">
            <input v-model="startDateStr" type="date" />
            <span class="date-sep">to</span>
            <input v-model="endDateStr" type="date" :min="startDateStr" />
          </div>
          <p v-if="!datesValid" class="date-error">End date must be on or after start date.</p>
        </div>
      </div>

      <div class="actions">
        <button class="btn" @click="emit('cancel')">Cancel</button>
        <button class="btn" @click="handleSubmit" :disabled="!number.trim() || !title.trim() || !datesValid">Add</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background-color: #1a1a1a;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 420px;
  max-width: calc(100vw - 2rem);
}

h3 {
  padding: 0.65rem 1rem;
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  line-height: 1;
}

h3 span {
  background: linear-gradient(to right, #a78bfa 20%, #38bdf8 35%, #22d3ee 65%, #818cf8 80%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 500% auto;
  animation: textShine 5s ease-in-out infinite alternate;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
  padding-top: 2px;
}

@keyframes textShine {
  0%   { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}
.modal-body :deep(.simplebar-content) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.label-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.7;
}

input,
select {
  padding: 0.45rem 0.65rem;
  font-size: 14px;
  font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  outline: none;
  transition: border-color 0.15s;
}

select {
  padding-right: 2rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.5)' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.65rem center;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

select option {
  background: #1a1a1a;
  color: #fff;
}

input:focus,
select:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1) opacity(0.4);
  cursor: pointer;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-row input {
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

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

</style>
