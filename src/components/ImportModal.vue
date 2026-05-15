<script setup lang="ts">
import { ref } from 'vue'
import { getSavedProjects, STORAGE_KEY } from '../utils/projectStorage'
import type { ProjectData } from '../utils/projectStorage'
import { useFocusTrap } from '../composables/useFocusTrap'

const emit = defineEmits<{
  load: [data: ProjectData]
  close: []
}>()

const savedProjects = ref(getSavedProjects())
const error = ref('')
const confirmId = ref<string | null>(null)
const { trapRef, onKeydown } = useFocusTrap()

function refresh() {
  savedProjects.value = getSavedProjects()
}

function deleteProject(id: string) {
  const projects = getSavedProjects().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  refresh()
}

function loadSaved(id: string) {
  const project = savedProjects.value.find((p) => p.id === id)
  if (!project) return
  emit('load', { name: project.name, ...project.data })
}

function onFileInput(e: Event) {
  error.value = ''
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target?.result as string) as ProjectData
      if (!Array.isArray(parsed.tickets) || !Array.isArray(parsed.people)) {
        error.value = 'Invalid project file — missing required fields.'
        return
      }
      emit('load', parsed)
    } catch {
      error.value = 'Could not parse the file. Make sure it is a valid project JSON.'
    }
  }
  reader.readAsText(file)
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
      <h3><span>Import Project</span></h3>

      <div class="modal-body" v-simplebar>
        <div class="section">
          <div class="section-label">Saved in this browser</div>
          <div v-if="savedProjects.length === 0" class="empty">
            No projects saved yet.
          </div>
          <ul v-else class="project-list">
            <li v-for="(project, index) in savedProjects" :key="project.id" class="project-row">
              <div class="project-index">{{ String(index + 1).padStart(2, '0') }}</div>
              <div class="project-body">
                <div class="project-info">
                  <span class="project-name">{{ project.name }}</span>
                  <span class="project-meta">
                    {{ project.data.tickets.length }} ticket{{ project.data.tickets.length !== 1 ? 's' : '' }}
                    · {{ project.data.people.length }} people
                    · saved {{ fmtDate(project.savedAt) }}
                  </span>
                </div>
                <div class="project-actions">
                  <template v-if="confirmId === project.id">
                    <span class="confirm-text">Delete?</span>
                    <button class="action-btn danger" @click="deleteProject(project.id); confirmId = null">Yes</button>
                    <button class="action-btn" @click="confirmId = null">No</button>
                  </template>
                  <template v-else>
                    <button class="action-btn delete" @click="confirmId = project.id" title="Delete">✕</button>
                    <button class="action-btn primary" @click="loadSaved(project.id)">Load</button>
                  </template>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div class="divider" />

        <div class="section">
          <div class="section-label">Load from file</div>
          <div class="upload-area">
            <p class="upload-desc">Upload a <code>.json</code> file exported from this app.</p>
            <label class="file-btn">
              Choose File
              <input type="file" accept=".json,application/json" @change="onFileInput" />
            </label>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
        </div>
      </div>

      <div class="footer">
        <button class="btn" @click="emit('close')">Cancel</button>
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
  width: 540px;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
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
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}
.modal-body :deep(.simplebar-content) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1.25rem;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.empty {
  font-size: 0.82rem;
  opacity: 0.7;
  font-style: italic;
}

.project-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.project-row {
  display: flex;
  align-items: stretch;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 7px;
  overflow: hidden;
}

.project-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  flex-shrink: 0;
  font-size: 0.85rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  letter-spacing: 0.03em;
  text-shadow:
    0 -1px 0 rgba(0, 0, 0, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.07);
}

.project-body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.8rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
  min-width: 0;
}

.project-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.project-name {
  font-size: 0.88rem;
  font-weight: 600;
}

.project-meta {
  font-size: 0.73rem;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.confirm-text {
  font-size: 0.78rem;
  opacity: 0.85;
}

.action-btn {
  padding: 4px 0.65rem;
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

.action-btn.delete {
  display: flex;
  align-items: center;
  border-color: transparent;
  background: linear-gradient(180deg, rgba(160, 40, 30, 0.35) 0%, rgba(120, 30, 20, 0.35) 100%);
  color: rgba(255, 120, 110, 0.8);
}


.action-btn.danger {
  background: transparent;
  border-color: rgba(231, 76, 60, 0.35);
  color: rgba(231, 76, 60, 0.75);
  box-shadow: none;
}

.action-btn.danger:hover {
  border-color: rgba(231, 76, 60, 0.7);
  color: rgba(231, 76, 60, 1);
  box-shadow: none;
}

.divider {
  height: 1px;
  background: rgba(128, 128, 128, 0.2);
}

.upload-area {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px dashed rgba(128, 128, 128, 0.3);
  border-radius: 7px;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
}

.upload-desc {
  flex: 1;
  font-size: 0.82rem;
  opacity: 0.6;
  line-height: 1.4;
}

.file-btn {
  flex-shrink: 0;
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

.file-btn input {
  display: none;
}

.error {
  font-size: 0.8rem;
  color: #e74c3c;
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
</style>
