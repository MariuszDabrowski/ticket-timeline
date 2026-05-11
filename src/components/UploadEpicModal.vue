<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  import: [csvText: string, workspaceSlug: string]
  cancel: []
}>()

const csvText = ref<string | null>(null)
const fileName = ref<string | null>(null)
const workspaceSlug = ref('')
const isDragOver = ref(false)

function readFile(file: File) {
  if (!file.name.endsWith('.csv')) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    if (typeof e.target?.result === 'string') csvText.value = e.target.result
  }
  reader.readAsText(file)
}

function onFileInput(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) readFile(file)
  ;(event.target as HTMLInputElement).value = ''
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) readFile(file)
}

function handleImport() {
  if (csvText.value) emit('import', csvText.value, workspaceSlug.value.trim())
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal">
      <h3>Import Epic from Shortcut</h3>

      <ol class="instructions">
        <li>Head over to your epic in <strong>Shortcut</strong></li>
        <li>Click the <strong>"Export as CSV"</strong> button in the epic menu</li>
        <li>Check your email — Shortcut will send you the CSV file</li>
        <li>Upload the CSV using the field below</li>
      </ol>

      <div
        class="drop-zone"
        :class="{ 'drag-over': isDragOver, 'has-file': csvText }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @click="($refs.fileInput as HTMLInputElement).click()"
      >
        <input ref="fileInput" type="file" accept=".csv" style="display:none" @change="onFileInput" />
        <template v-if="csvText">
          <span class="file-icon">✓</span>
          <span class="file-name">{{ fileName }}</span>
        </template>
        <template v-else>
          <span class="upload-icon">↑</span>
          <span>Click or drag a CSV file here</span>
        </template>
      </div>

      <div class="field">
        <label>
          Shortcut workspace slug
          <span class="hint">Found in your Shortcut URL: app.shortcut.com/<strong>your-slug</strong>/…</span>
        </label>
        <input
          v-model="workspaceSlug"
          type="text"
          placeholder="e.g. clearbanc"
          @keydown.enter.prevent="handleImport"
        />
      </div>

      <div class="actions">
        <button @click="emit('cancel')">Cancel</button>
        <button class="primary" :disabled="!csvText" @click="handleImport">
          Create Stories
        </button>
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
  width: 440px;
  max-width: calc(100vw - 2rem);
}

h3 {
  font-size: 1rem;
  font-weight: bold;
}

.instructions {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
  line-height: 1.5;
}

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 6px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #888;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: #666;
  background: rgba(100, 100, 200, 0.05);
  color: inherit;
}

.drop-zone.has-file {
  border-color: #2ecc71;
  color: #2ecc71;
}

.upload-icon,
.file-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.file-name {
  font-weight: 500;
  word-break: break-all;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

label {
  font-size: 0.8rem;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.hint {
  font-weight: normal;
  font-size: 0.75rem;
  color: #888;
}

input[type='text'] {
  padding: 0.4rem 0.6rem;
  font-size: 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: transparent;
  color: inherit;
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
  background: transparent;
  color: inherit;
}

button.primary {
  background: #333;
  color: #fff;
  border-color: #333;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
