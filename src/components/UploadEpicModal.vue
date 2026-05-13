<script setup lang="ts">
import { ref } from 'vue'
import { useFocusTrap } from '../composables/useFocusTrap'

const emit = defineEmits<{
  import: [csvText: string, workspaceSlug: string]
  cancel: []
}>()

const csvText = ref<string | null>(null)
const fileName = ref<string | null>(null)
const workspaceSlug = ref('')
const isDragOver = ref(false)
const { trapRef, onKeydown } = useFocusTrap()

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
    <div class="modal" ref="trapRef" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
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
  gap: 1.25rem;
  width: 520px;
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

.instructions {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #fff;
}

.instructions strong {
  color: #fff;
}

.drop-zone {
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 1.5rem;
  min-height: 7rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.03);
  color: #fff;
}

.drop-zone.has-file {
  border-color: rgba(46, 204, 113, 0.6);
  color: rgba(46, 204, 113, 0.9);
}

.upload-icon,
.file-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.file-name {
  font-weight: 500;
  word-break: break-word;
  text-align: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hint {
  font-weight: normal;
  font-size: 12px;
  opacity: 0.7;
  text-transform: none;
  letter-spacing: 0;
}

.hint strong {
  font-weight: 600;
  opacity: 1;
}

input[type='text'] {
  padding: 0.45rem 0.65rem;
  font-size: 14px;
  font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  outline: none;
  transition: border-color 0.15s;
}

input[type='text']:focus {
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
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  line-height: 1;
  transition: box-shadow 0.25s ease;
}

button:hover {
  box-shadow: inset 0 0 0 100px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1);
}


button:disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
  outline: none;
}
</style>
