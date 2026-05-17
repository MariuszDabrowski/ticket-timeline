<script setup lang="ts">
import type { Person } from '../stores/people'

// Vertical list of buttons, one per person. Used by Add/EditVacationModal —
// both rendered the same markup + styles. The selected button shows a soft
// purple highlight. `v-model` on this component binds the selected person id.
defineProps<{
  people: Person[]
  modelValue: number | null
}>()

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <div class="person-list">
    <button
      v-for="person in people"
      :key="person.id"
      class="person-btn"
      :class="{ selected: modelValue === person.id }"
      @click="$emit('update:modelValue', person.id)"
    >
      <span class="dot" :style="{ background: person.color }" />
      {{ person.name }}
    </button>
  </div>
</template>

<style scoped>
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

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
