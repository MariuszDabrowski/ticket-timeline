<script setup lang="ts">
import { ref } from 'vue'
import type { DayMarker } from '../stores/dayMarkers'

const props = defineProps<{
  year: number
  month: number
  day: number
  existing: DayMarker | null
}>()

const emit = defineEmits<{
  save: [marker: DayMarker | null]
  cancel: []
}>()

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#607d8b', '#795548',
]

const selectedColor = ref(props.existing?.color ?? COLORS[0]!)
const note = ref(props.existing?.note ?? '')
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal">
      <h3>{{ MONTH_NAMES[props.month] }} {{ props.day }}, {{ props.year }}</h3>

      <div class="field">
        <label>Circle Color</label>
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

      <div class="field">
        <label>Note <span class="hint">(shown on hover)</span></label>
        <input
          v-model="note"
          type="text"
          placeholder="e.g. Project kickoff"
          @keydown.enter.prevent="emit('save', { color: selectedColor, note: note.trim() })"
          @keydown.escape.prevent="emit('cancel')"
        />
      </div>

      <div class="actions">
        <button v-if="props.existing" class="clear-btn" @click="emit('save', null)">Clear</button>
        <div class="actions-right">
          <button @click="emit('cancel')">Cancel</button>
          <button class="primary" @click="emit('save', { color: selectedColor, note: note.trim() })">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-background, #fff);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 320px;
  max-width: calc(100vw - 2rem);
}

h3 {
  font-size: 1rem;
  font-weight: bold;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

label {
  font-size: 0.8rem;
  font-weight: 500;
}

.hint {
  font-weight: normal;
  opacity: 0.6;
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

.swatch:hover {
  transform: scale(1.15);
}

.swatch.selected {
  border-color: #fff;
  outline: 2px solid #333;
  outline-offset: 1px;
}

input {
  padding: 0.4rem 0.6rem;
  font-size: 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: transparent;
  color: inherit;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions-right {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

button {
  padding: 0.35rem 0.8rem;
  font-size: 0.85rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: inherit;
}

button.primary {
  background: #333;
  color: #fff;
  border-color: #333;
}

.clear-btn {
  color: #c0392b;
  border-color: #c0392b;
}

.clear-btn:hover {
  background: #c0392b;
  color: #fff;
}
</style>
