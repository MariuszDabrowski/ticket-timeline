<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  submit: [name: string]
  cancel: []
}>()

const name = ref('')
const modalRef = ref<HTMLElement | null>(null)

onMounted(() => {
  modalRef.value?.querySelector<HTMLElement>('input, select, button')?.focus()
})

function handleSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('submit', trimmed)
  name.value = ''
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
      <h3>Add Person</h3>
      <input
        v-model="name"
        type="text"
        placeholder="Name"
        @keydown.enter.prevent="handleSubmit"
      />
      <div class="actions">
        <button @click="emit('cancel')">Cancel</button>
        <button @click="handleSubmit" :disabled="!name.trim()">Add</button>
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
  width: 340px;
  max-width: calc(100vw - 2rem);
}

h3 {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: underline;
  text-underline-offset: 3px;
}

input {
  padding: 0.45rem 0.65rem;
  font-size: 14px;
  font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  transition: border-color 0.15s;
}

input:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

.actions {
  display: flex;
  justify-content: flex-end;
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
  background: linear-gradient(180deg, #363636 0%, #222222 100%);
  color: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 5px rgba(0, 0, 0, 0.45);
  transition: box-shadow 0.25s ease;
}

button:hover {
  box-shadow: inset 0 0 0 100px rgba(255, 255, 255, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.13), 0 2px 5px rgba(0, 0, 0, 0.45);
}

button:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
