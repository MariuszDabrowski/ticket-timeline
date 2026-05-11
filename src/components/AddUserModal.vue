<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  submit: [name: string]
  cancel: []
}>()

const name = ref('')

function handleSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('submit', trimmed)
  name.value = ''
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal" @keydown.esc="emit('cancel')">
      <h3>Add Person</h3>
      <input
        v-model="name"
        type="text"
        placeholder="Name"
        @keydown.enter.prevent="handleSubmit"
        autofocus
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
  min-width: 280px;
}

h3 {
  font-size: 1rem;
  font-weight: bold;
}

input {
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
