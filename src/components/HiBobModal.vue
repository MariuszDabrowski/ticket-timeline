<script setup lang="ts">
import { ref } from 'vue'
import { parseICS, groupByPerson } from '../utils/icsParser'
import type { ICSPersonGroup } from '../utils/icsParser'
import BaseModal from './BaseModal.vue'

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
  <BaseModal title="Sync HiBob Vacation Days" size="wide" @close="emit('cancel')">
    <div class="modal-body wide-body" v-simplebar>
      <div class="instructions">
        <p class="instructions-title">How to get your ICS file:</p>
        <ol>
          <li>In <a href="https://www.hibob.com" target="_blank" rel="noopener noreferrer">HiBob</a>, go to <strong>Time → People's Time Off</strong></li>
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
        <p>Drag &amp; drop your .ics file here</p>
        <p class="or">or</p>
        <label class="btn file-btn" tabindex="0" @keydown.enter.prevent="($event.currentTarget as HTMLElement).click()" @keydown.space.prevent="($event.currentTarget as HTMLElement).click()">
          Choose File
          <input type="file" accept=".ics,text/calendar" @change="onFileInput" />
        </label>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <template #actions>
      <button class="btn" @click="emit('cancel')">Cancel</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.instructions {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.5);
}

.instructions strong {
  color: rgba(255, 255, 255, 0.65);
}

.instructions a {
  color: rgba(255, 255, 255, 0.65);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: rgba(255, 255, 255, 0.25);
}

.instructions a:hover {
  color: rgba(255, 255, 255, 0.85);
  text-decoration-color: rgba(255, 255, 255, 0.5);
}

.instructions-title {
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: rgba(255, 255, 255, 0.8);
}

ol {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.drop-zone {
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 2rem;
  text-align: center;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  transition: border-color 0.15s, background 0.15s;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
}

.drop-zone.over {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
}

.or {
  opacity: 0.5;
  font-size: 0.78rem;
}

.file-btn input {
  display: none;
}

.error {
  color: rgba(231, 76, 60, 0.9);
  font-size: 0.82rem;
}
</style>
