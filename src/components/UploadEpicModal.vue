<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'

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
  <BaseModal title="Import Epic from Shortcut" size="wide" @close="emit('cancel')">
    <div class="modal-body wide-body" v-simplebar>
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

      <div class="app-field">
        <label class="app-label">
          Shortcut workspace slug
          <span class="hint">Found in your Shortcut URL: app.shortcut.com/<strong>your-slug</strong>/…</span>
        </label>
        <input
          class="app-input"
          v-model="workspaceSlug"
          type="text"
          placeholder="e.g. clearbanc"
          @keydown.enter.prevent="handleImport"
        />
      </div>
    </div>

    <template #actions>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn primary" :disabled="!csvText || !workspaceSlug.trim()" @click="handleImport">
        Create Stories
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
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

/* The label/hint pair in this modal stacks vertically — override the
   default app-label which lays out in a row. */
.app-label {
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
</style>
