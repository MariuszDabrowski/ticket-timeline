<script setup lang="ts">
import { ref } from 'vue'
import { parseICS, groupByPerson } from '../utils/icsParser'
import type { ICSPersonGroup } from '../utils/icsParser'
import { useFocusTrap } from '../composables/useFocusTrap'

const emit = defineEmits<{
  parsed: [groups: ICSPersonGroup[]]
  cancel: []
}>()

const dragOver = ref(false)
const error = ref('')
const { trapRef, onKeydown } = useFocusTrap()

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
    <div class="modal" ref="trapRef" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3><span>Sync HiBob Vacation Days</span></h3>

      <div class="modal-body" v-simplebar>
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
          <p>Drag & drop your .ics file here</p>
          <p class="or">or</p>
          <label class="btn file-btn" tabindex="0" @keydown.enter.prevent="($event.currentTarget as HTMLElement).click()" @keydown.space.prevent="($event.currentTarget as HTMLElement).click()">
            Choose File
            <input type="file" accept=".ics,text/calendar" @change="onFileInput" />
          </label>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div class="actions">
        <button class="btn" @click="emit('cancel')">Cancel</button>
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
  width: 480px;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
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
  background: linear-gradient(to right, #a78bfa 20%, #38bdf8 35%, #22d3ee 65%, #818cf8 80%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 500% auto;
  animation: textShine 5s ease-in-out infinite alternate;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
  padding-top: 2px;
}

@keyframes textShine {
  0%   { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
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

.actions {
  display: flex;
  justify-content: flex-end;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

</style>
