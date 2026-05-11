<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Ticket } from '../stores/tickets'
import type { Person } from '../stores/people'

const props = defineProps<{
  ticket: Ticket
  people: Person[]
}>()

const emit = defineEmits<{
  submit: [ticket: { number: string; title: string; assignedTo: number | null; link: string }]
  cancel: []
  delete: []
}>()

const number = ref(props.ticket.number)
const title = ref(props.ticket.title)
const assignedTo = ref<number | null>(props.ticket.assignedTo)
const link = ref(props.ticket.link)
const modalRef = ref<HTMLElement | null>(null)

onMounted(() => {
  modalRef.value?.querySelector<HTMLElement>('input, select, button')?.focus()
})

function handleSubmit() {
  if (!number.value.trim() || !title.value.trim()) return
  emit('submit', {
    number: number.value.trim(),
    title: title.value.trim(),
    assignedTo: assignedTo.value,
    link: link.value.trim(),
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { emit('cancel'); return }
  if (event.key !== 'Tab') return
  const focusable = Array.from(
    modalRef.value?.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), button:not([disabled])'
    ) ?? []
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus()
  }
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal" ref="modalRef" @keydown="onKeydown">
      <h3>Edit Ticket</h3>

      <div class="field">
        <label>Ticket Number</label>
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

      <div class="actions">
        <button class="delete-btn" @click="emit('delete')">Delete</button>
        <div class="actions-right">
          <button @click="emit('cancel')">Cancel</button>
          <button @click="handleSubmit" :disabled="!number.trim() || !title.trim()">Save</button>
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
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
}

.actions-right {
  display: flex;
  gap: 0.5rem;
}

.delete-btn {
  color: #c0392b;
  border-color: #c0392b;
}

.delete-btn:hover {
  background: #c0392b;
  color: #fff;
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
