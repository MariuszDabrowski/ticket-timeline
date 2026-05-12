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
        <label class="link-label">
          Ticket Link
          <a v-if="link.trim()" :href="link.trim()" target="_blank" rel="noopener" class="open-link" title="Open link">↗</a>
        </label>
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
  gap: 1rem;
  width: 420px;
  max-width: calc(100vw - 2rem);
}

h3 {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.link-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.open-link {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: none;
  line-height: 1;
  transition: color 0.15s;
}

.open-link:hover {
  color: #fff;
}

input,
select {
  padding: 0.45rem 0.65rem;
  font-size: 14px;
  font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  outline: none;
  transition: border-color 0.15s;
}

input:focus,
select:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

select option {
  background: #1a1a1a;
  color: #fff;
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
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 2px 5px rgba(0, 0, 0, 0.1);
  line-height: 1;
  transition: box-shadow 0.25s ease;
}

button:hover {
  box-shadow:
    inset 0 0 0 100px rgba(255, 255, 255, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    0 2px 5px rgba(0, 0, 0, 0.1);
}

button:disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
  outline: none;
}

.delete-btn {
  background: transparent;
  border-color: rgba(231, 76, 60, 0.6);
  color: rgba(231, 76, 60, 1);
  box-shadow: none;
}

.delete-btn:hover {
  border-color: rgba(231, 76, 60, 0.7);
  color: rgba(231, 76, 60, 1);
  box-shadow: none;
}
</style>
