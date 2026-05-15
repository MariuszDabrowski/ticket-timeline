<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Ticket, CalendarDate } from '../stores/tickets'
import { useFocusTrap } from '../composables/useFocusTrap'

const props = defineProps<{ existing?: Ticket }>()

const emit = defineEmits<{
  save: [text: string, color: string, startDate: CalendarDate | null, endDate: CalendarDate | null]
  delete: []
  cancel: []
}>()

const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#607d8b', '#795548',
]

const text = ref(props.existing?.title ?? '')
const selectedColor = ref(props.existing?.labelColor ?? COLORS[0]!)
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
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal" ref="trapRef" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3><span>{{ props.existing ? 'Edit Event' : 'Add Event' }}</span></h3>

      <div class="modal-body" v-simplebar>
        <div class="field">
          <label>Event name</label>
          <input
            v-model="text"
            type="text"
            placeholder="e.g. Design freeze"
            @keydown.enter.prevent="emit('save', text.trim(), selectedColor, parseDate(startDateStr), parseDate(endDateStr))"
            @keydown.escape.prevent="emit('cancel')"
          />
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

        <div class="field">
          <label>Color</label>
          <div class="swatches">
            <button
              v-for="color in COLORS"
              :key="color"
              class="swatch"
              :style="{ background: color }"
              :class="{ selected: selectedColor === color }"
              @click="selectedColor = color"
            />
          </div>
        </div>
      </div>

      <div class="actions">
        <button v-if="props.existing" class="delete-btn" @click="emit('delete')">Delete</button>
        <div class="actions-right">
          <button @click="emit('cancel')">Cancel</button>
          <button @click="emit('save', text.trim(), selectedColor, parseDate(startDateStr), parseDate(endDateStr))" :disabled="!text.trim() || !datesValid">
            {{ props.existing ? 'Save' : 'Add' }}
          </button>
        </div>
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
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}

.modal-body :deep(.simplebar-content) {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.swatch {
  width: 1.6rem;
  height: 1.6rem;
  min-width: 1.6rem;
  min-height: 1.6rem;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}

.swatch:hover { transform: scale(1.15); }

.swatch.selected {
  border-color: #fff;
  outline: 2px solid rgba(255, 255, 255, 0.3);
  outline-offset: 1px;
}

input {
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

input:focus { border-color: rgba(255, 255, 255, 0.3); }

.label-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.7;
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

input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1) opacity(0.4);
  cursor: pointer;
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
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.actions-right {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

button {
  padding: 5px 1rem;
  font-size: 0.76rem;
  font-family: 'Nunito', sans-serif;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 2px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  line-height: 1;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}

.delete-btn {
  background: linear-gradient(180deg, #c0392b 0%, #a93226 100%);
  border-color: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
