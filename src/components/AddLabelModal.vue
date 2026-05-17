<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Ticket, CalendarDate } from '../stores/tickets'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ existing?: Ticket }>()

const emit = defineEmits<{
  save: [text: string, color: string, startDate: CalendarDate | null, endDate: CalendarDate | null]
  delete: []
  cancel: []
}>()

const COLORS = [
  '#c0392b', '#c0672d', '#b8860b', '#1a8a4a',
  '#148a72', '#2472a4', '#7d3c98', '#b5154a',
  '#455a64', '#5d4037',
]

const text = ref(props.existing?.title ?? '')
const selectedColor = ref(props.existing?.labelColor ?? COLORS[0]!)
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
</script>

<template>
  <BaseModal :title="props.existing ? 'Edit Event' : 'Add Event'" size="compact" @close="emit('cancel')">
    <div class="modal-body form-body" v-simplebar>
      <div class="app-field">
        <label class="app-label">Event name</label>
        <input
          class="app-input"
          v-model="text"
          type="text"
          placeholder="e.g. Design freeze"
          @keydown.enter.prevent="emit('save', text.trim(), selectedColor, parseDate(startDateStr), parseDate(endDateStr))"
          @keydown.escape.prevent="emit('cancel')"
        />
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

      <div class="app-field">
        <label class="app-label">Color</label>
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

    <template #actions>
      <button v-if="props.existing" class="btn btn-danger leading" @click="emit('delete')">Delete</button>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn" @click="emit('save', text.trim(), selectedColor, parseDate(startDateStr), parseDate(endDateStr))" :disabled="!text.trim() || !datesValid">
        {{ props.existing ? 'Save' : 'Add' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
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
