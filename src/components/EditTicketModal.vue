<script setup lang="ts">
import { ref } from 'vue'
import type { Ticket } from '../stores/tickets'
import type { Person } from '../stores/people'

const props = defineProps<{
  ticket: Ticket
  people: Person[]
}>()

const emit = defineEmits<{
  submit: [ticket: { number: string; title: string; assignedTo: number | null; link: string }]
  cancel: []
}>()

const number = ref(props.ticket.number)
const title = ref(props.ticket.title)
const assignedTo = ref<number | null>(props.ticket.assignedTo)
const link = ref(props.ticket.link)

function handleSubmit() {
  if (!number.value.trim() || !title.value.trim()) return
  emit('submit', {
    number: number.value.trim(),
    title: title.value.trim(),
    assignedTo: assignedTo.value,
    link: link.value.trim(),
  })
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal">
      <h3>Edit Ticket</h3>

      <div class="field">
        <label>Ticket Number</label>
        <input v-model="number" type="text" placeholder="e.g. PROJ-123" @keydown.esc="emit('cancel')" autofocus />
      </div>

      <div class="field">
        <label>Title</label>
        <input v-model="title" type="text" placeholder="Ticket title" @keydown.esc="emit('cancel')" />
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
        <input v-model="link" type="url" placeholder="https://..." @keydown.esc="emit('cancel')" />
      </div>

      <div class="actions">
        <button @click="emit('cancel')">Cancel</button>
        <button @click="handleSubmit" :disabled="!number.trim() || !title.trim()">Save</button>
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
  background: #fff;
  border-radius: 6px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 320px;
}

h3 {
  font-size: 1rem;
  font-weight: bold;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

label {
  font-size: 0.8rem;
  color: #555;
}

input,
select {
  padding: 0.4rem 0.6rem;
  font-size: 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

button {
  padding: 0.35rem 0.8rem;
  font-size: 0.85rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: #fff;
}

button:last-child {
  background: #333;
  color: #fff;
  border-color: #333;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
