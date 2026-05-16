<script setup lang="ts">
import { ref } from 'vue'
import { useFocusTrap } from '../composables/useFocusTrap'
import type { Person } from '../stores/people'

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
const { trapRef, onKeydown } = useFocusTrap()
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal" ref="trapRef" role="dialog" aria-modal="true" aria-labelledby="edit-vacation-modal-title" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3 id="edit-vacation-modal-title"><span class="shine-text">Edit Vacation</span></h3>

      <div class="modal-body" v-simplebar>
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

      <div class="actions">
        <button class="btn delete-btn" @click="emit('delete', vacationId)">Delete</button>
        <div class="actions-right">
          <button class="btn" @click="emit('cancel')">Cancel</button>
          <button class="btn" @click="emit('save', vacationId, selectedPersonId)">Save</button>
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
  width: 340px;
  max-width: calc(100vw - 2rem);
  color: rgba(255, 255, 255, 0.8);
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
  padding-top: 2px;
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
}

.delete-btn {
  background: linear-gradient(180deg, #c0392b 0%, #a93226 100%);
  color: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
