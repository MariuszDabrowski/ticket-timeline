<script setup lang="ts">
import { ref } from 'vue'
import type { Ticket } from '../stores/tickets'
import { useFocusTrap } from '../composables/useFocusTrap'

const props = defineProps<{ existing?: Ticket }>()

const emit = defineEmits<{
  save: [text: string, color: string]
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
const { trapRef, onKeydown } = useFocusTrap()
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal" ref="trapRef" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3>{{ props.existing ? 'Edit Label' : 'Add Label' }}</h3>

      <div class="field">
        <label>Label text</label>
        <input
          v-model="text"
          type="text"
          placeholder="e.g. Design freeze"
          @keydown.enter.prevent="emit('save', text.trim(), selectedColor)"
          @keydown.escape.prevent="emit('cancel')"
        />
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

      <div class="actions">
        <button v-if="props.existing" class="delete-btn" @click="emit('delete')">Delete</button>
        <div class="actions-right">
          <button @click="emit('cancel')">Cancel</button>
          <button @click="emit('save', text.trim(), selectedColor)" :disabled="!text.trim()">
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
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 420px;
  max-width: calc(100vw - 2rem);
  color: #fff;
}

h3 {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-decoration: underline;
  text-underline-offset: 3px;
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
  color: #fff;
  outline: none;
  transition: border-color 0.15s;
}

input:focus { border-color: rgba(255, 255, 255, 0.3); }

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
  padding: 5px 1rem;
  font-size: 0.76rem;
  font-family: 'Nunito', sans-serif;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 2px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  line-height: 1;
  transition: box-shadow 0.25s ease;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}

.delete-btn {
  background: linear-gradient(180deg, #c0392b 0%, #a93226 100%);
  border-color: rgba(0, 0, 0, 0.55);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
}

</style>
