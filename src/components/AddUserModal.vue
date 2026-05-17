<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Person } from '../stores/people'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  existing?: Person
}>()

const emit = defineEmits<{
  submit: [name: string, color: string]
  delete: []
  cancel: []
}>()

const COLORS = [
  '#c0392b',
  '#2472a4',
  '#1a8a4a',
  '#c47f10',
  '#7d3c98',
  '#148a72',
  '#c0672d',
  '#b5154a',
  '#0097a7',
  '#5d8a27',
]

const name = ref('')
const selectedColor = ref(COLORS[0]!)

watch(
  () => props.existing,
  (existing) => {
    name.value = existing?.name ?? ''
    selectedColor.value = existing?.color ?? COLORS[0]!
  },
  { immediate: true },
)

function handleSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('submit', trimmed, selectedColor.value)
}
</script>

<template>
  <BaseModal :title="props.existing ? 'Edit Person' : 'Add Person'" size="compact" @close="emit('cancel')">
    <div class="modal-body form-body" v-simplebar>
      <div class="app-field">
        <label class="app-label">Name</label>
        <input class="app-input" v-model="name" type="text" placeholder="Name" @keydown.enter.prevent="handleSubmit" />
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
      <button class="btn" @click="handleSubmit" :disabled="!name.trim()">{{ props.existing ? 'Save' : 'Add' }}</button>
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

.swatch:hover {
  transform: scale(1.15);
}

.swatch.selected {
  border-color: #fff;
  outline: 2px solid rgba(255, 255, 255, 0.3);
  outline-offset: 1px;
}
</style>
