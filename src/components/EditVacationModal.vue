<script setup lang="ts">
import { ref } from 'vue'
import type { Person } from '../stores/people'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  vacationId: number
  currentPersonId: number
  people: Person[]
}>()

const emit = defineEmits<{
  save: [vacationId: number, personId: number]
  delete: [vacationId: number]
  cancel: []
}>()

const selectedPersonId = ref(props.currentPersonId)
</script>

<template>
  <BaseModal title="Edit Vacation" size="compact" @close="emit('cancel')">
    <div class="modal-body form-body" v-simplebar>
      <div class="field">
        <label>Person</label>
        <div class="person-list">
          <button
            v-for="person in people"
            :key="person.id"
            class="person-btn"
            :class="{ selected: selectedPersonId === person.id }"
            @click="selectedPersonId = person.id"
          >
            <span class="dot" :style="{ background: person.color }" />
            {{ person.name }}
          </button>
        </div>
      </div>
    </div>

    <template #actions>
      <button class="btn btn-danger leading" @click="emit('delete', vacationId)">Delete</button>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn" @click="emit('save', vacationId, selectedPersonId)">Save</button>
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

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

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

.person-btn::after { display: none; }

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
