<script setup lang="ts">
import { ref } from 'vue'
import { parseICS, groupByPerson } from '../utils/icsParser'
import type { ICSPersonGroup } from '../utils/icsParser'

const emit = defineEmits<{
  parsed: [groups: ICSPersonGroup[]]
  cancel: []
}>()

const dragOver = ref(false)
const error = ref('')

function processFile(file: File) {
  error.value = ''
  if (!file.name.endsWith('.ics') && file.type !== 'text/calendar') {
    error.value = 'Please upload a .ics file.'
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    const events = parseICS(content)
    if (events.length === 0) {
      error.value = 'No vacation events found in this file.'
      return
    }
    emit('parsed', groupByPerson(events))
  }
  reader.readAsText(file)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) processFile(file)
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal">
      <h3>Sync HiBob Vacation Days</h3>

      <div class="instructions">
        <p class="instructions-title">How to get your ICS file:</p>
        <ol>
          <li>In HiBob, go to <strong>Time → People's Time Off</strong></li>
          <li>Click the <strong>three dots (⋯)</strong> menu and choose <strong>Sync with external calendar</strong></li>
          <li>Select <strong>Everyone</strong> in the modal, then copy the link in the <strong>Time Off</strong> section</li>
          <li>Paste that link into your browser — it will download a file</li>
          <li>Confirm the file has a <strong>.ics</strong> extension (rename it if needed), then upload it below</li>
        </ol>
      </div>

      <div
        class="drop-zone"
        :class="{ over: dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <p>Drag & drop your .ics file here</p>
        <p class="or">or</p>
        <label class="file-btn">
          Choose File
          <input type="file" accept=".ics,text/calendar" @change="onFileInput" />
        </label>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button @click="emit('cancel')">Cancel</button>
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
  background: var(--color-background, #fff);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 480px;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
}

h3 {
  font-size: 1rem;
  font-weight: bold;
}

.instructions {
  background: rgba(128, 128, 128, 0.08);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.82rem;
  line-height: 1.6;
}

.instructions-title {
  font-weight: 600;
  margin-bottom: 0.4rem;
}

ol {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.drop-zone {
  border: 2px dashed #aaa;
  border-radius: 6px;
  padding: 2rem;
  text-align: center;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  transition: border-color 0.15s, background 0.15s;
}

.drop-zone.over {
  border-color: #3498db;
  background: rgba(52, 152, 219, 0.06);
}

.or {
  opacity: 0.5;
  font-size: 0.78rem;
}

.file-btn {
  padding: 0.35rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  background: transparent;
  color: inherit;
}

.file-btn input {
  display: none;
}

.error {
  color: #c0392b;
  font-size: 0.82rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

button {
  padding: 0.35rem 0.8rem;
  font-size: 0.85rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: inherit;
}
</style>
