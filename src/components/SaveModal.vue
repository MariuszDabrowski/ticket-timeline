<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFocusTrap } from '../composables/useFocusTrap'
import {
  getSavedProjects,
  setSavedProjects,
} from '../utils/projectStorage'
import type { ProjectData, SavedProject } from '../utils/projectStorage'

const props = defineProps<{ data: Omit<ProjectData, 'name'>; initialName?: string; exportingImage?: boolean }>()
const emit = defineEmits<{ close: []; save: [name: string]; exportImage: [includeSummary: boolean] }>()

const includeSummary = ref(true)
const projectName = ref(props.initialName ?? 'REPLACE-ME')
const { trapRef, onKeydown } = useFocusTrap()

const existingProject = computed(() =>
  getSavedProjects().find((p) => p.name === projectName.value.trim()) ?? null
)

type SaveStatus = 'idle' | 'saved' | 'updated'
const saveStatus = ref<SaveStatus>('idle')

function snapshot(): Omit<ProjectData, 'name'> {
  return JSON.parse(JSON.stringify(props.data))
}

function saveToStorage() {
  const name = projectName.value.trim()
  if (!name) return
  const projects = getSavedProjects()
  const idx = projects.findIndex((p) => p.name === name)
  const entry: SavedProject = {
    id: idx !== -1 ? projects[idx]!.id : crypto.randomUUID(),
    name,
    savedAt: new Date().toISOString(),
    data: snapshot(),
  }
  if (idx !== -1) {
    projects[idx] = entry
    saveStatus.value = 'updated'
  } else {
    projects.push(entry)
    saveStatus.value = 'saved'
  }
  setSavedProjects(projects)
  emit('save', name)
  setTimeout(() => (saveStatus.value = 'idle'), 2500)
}

function downloadJSON() {
  const name = projectName.value.trim() || 'project'
  const payload: ProjectData = { name, ...snapshot() }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
  emit('save', name)
}


function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="modal" ref="trapRef" @keydown="onKeydown" @keydown.escape.prevent="emit('close')">
      <h3><span>Save Project</span></h3>

      <div class="modal-body" v-simplebar>
        <div class="field">
          <label class="field-label">Project name</label>
          <input class="field-input" v-model="projectName" placeholder="My Project" />
        </div>

        <div class="options">
          <div class="option-card">
            <div class="option-body">
              <div class="option-title">Save to browser</div>
              <div class="option-desc">
                Stores the project in this browser's local storage. You can load it later from
                the Load screen.
                <span v-if="existingProject" class="overwrite-note">
                  A project named <strong>{{ existingProject.name }}</strong> was last saved
                  {{ fmtDate(existingProject.savedAt) }} — saving will update it.
                </span>
              </div>
            </div>
            <div class="option-action">
              <button class="btn" @click="saveToStorage" :disabled="!projectName.trim()">
                <template v-if="saveStatus === 'saved'">✓ Saved</template>
                <template v-else-if="saveStatus === 'updated'">✓ Updated</template>
                <template v-else-if="existingProject">Update</template>
                <template v-else>Save</template>
              </button>
            </div>
          </div>

          <div class="option-card">
            <div class="option-body">
              <div class="option-title">Export as Image</div>
              <div class="option-desc">
                Downloads a <code>.png</code> of the full calendar at 2× resolution.
              </div>
              <label class="summary-toggle">
                <input type="checkbox" v-model="includeSummary" />
                Include project brief
              </label>
            </div>
            <div class="option-action">
              <button class="btn" @click="emit('exportImage', includeSummary)" :disabled="props.exportingImage">
                <span v-if="props.exportingImage" class="spinner" />
                <template v-else>Export</template>
              </button>
            </div>
          </div>

          <div class="option-card">
            <div class="option-body">
              <div class="option-title">Download JSON</div>
              <div class="option-desc">
                Downloads a <code>.json</code> file containing all tickets, people, and vacation
                data. You can load this file on any device.
              </div>
            </div>
            <div class="option-action">
              <button class="btn" @click="downloadJSON" :disabled="!projectName.trim()">
                Download
              </button>
            </div>
          </div>

        </div>
      </div>

      <div class="footer">
        <button class="btn" @click="emit('close')">Close</button>
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
  color: rgba(255, 255, 255, 0.8);
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

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.field-input {
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

.field-input:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 7px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
}

.option-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.76rem;
  opacity: 0.8;
  cursor: pointer;
  margin-top: 0.15rem;
}

.option-title {
  font-size: 0.88rem;
  font-weight: 600;
}

.option-desc {
  font-size: 0.78rem;
  opacity: 0.8;
  line-height: 1.5;
}

.overwrite-note {
  display: block;
  margin-top: 0.35rem;
  opacity: 0.85;
  color: #e8a735;
}


.option-action {
  flex-shrink: 0;
  align-self: center;
}

input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  position: relative;
  overflow: visible;
  transition: background 0.15s, border-color 0.15s;
}

input[type='checkbox']:checked {
  background: rgba(167, 139, 250, 0.25);
  border-color: rgba(167, 139, 250, 0.6);
}

@keyframes checkDraw {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0% 0 0); }
}

input[type='checkbox']:checked::after {
  content: '';
  position: absolute;
  left: 6px;
  top: -3px;
  width: 6px;
  height: 12px;
  border: 2px solid rgba(200, 180, 255, 0.9);
  border-top: none;
  border-left: none;
  border-radius: 0 2px 2px 0;
  transform: rotate(45deg);
  animation: checkDraw 0.2s ease-out forwards;
}

input[type='checkbox']:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.footer {
  display: flex;
  justify-content: flex-end;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.btn {
  padding: 5px 1rem;
  font-size: 0.76rem;
  font-family: 'Nunito', sans-serif;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1;
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 2px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
  pointer-events: none;
  outline: none;
}

.spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
