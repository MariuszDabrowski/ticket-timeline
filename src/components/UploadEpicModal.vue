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
    <div class="modal" ref="trapRef" role="dialog" aria-modal="true" aria-labelledby="upload-epic-modal-title" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3 id="upload-epic-modal-title"><span class="shine-text">Import Epic from Shortcut</span></h3>

      <div class="modal-body" v-simplebar>
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
      </div>

      <div class="actions">
        <button class="btn" @click="emit('cancel')">Cancel</button>
        <button class="btn primary" :disabled="!csvText || !workspaceSlug.trim()" @click="handleImport">
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
  width: 520px;
  max-width: calc(100vw - 2rem);
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
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
  padding-top: 2px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}
.modal-body :deep(.simplebar-content) {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 1.25rem;
}

.instructions {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
}

.instructions strong {
  color: rgba(255, 255, 255, 0.65);
}

.drop-zone {
  border: 1px dashed rgba(255, 255, 255, 0.15);
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
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.8);
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
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hint {
  font-weight: normal;
  font-size: 13px;
  opacity: 0.85;
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
  color: rgba(255, 255, 255, 0.8);
  outline: none;
  transition: border-color 0.15s;
}

input[type='text']::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

input[type='text']:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

</style>
