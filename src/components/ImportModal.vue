<script setup lang="ts">
import { ref } from 'vue'
import { getSavedProjects, STORAGE_KEY } from '../utils/projectStorage'
import type { ProjectData } from '../utils/projectStorage'

const emit = defineEmits<{
  load: [data: ProjectData]
  close: []
}>()

const savedProjects = ref(getSavedProjects())
const error = ref('')
const confirmId = ref<string | null>(null)

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
    <div class="modal">
      <h3>Import Project</h3>

      <!-- Saved projects -->
      <div class="section">
        <div class="section-label">Saved in this browser</div>
        <div v-if="savedProjects.length === 0" class="empty">
          No projects saved yet.
        </div>
        <ul v-else class="project-list">
          <li
            v-for="project in savedProjects"
            :key="project.id"
            class="project-row"
          >
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
                <button class="action-btn" @click="confirmId = project.id" title="Delete">🗑</button>
                <button class="action-btn primary" @click="loadSaved(project.id)">Load</button>
              </template>
            </div>
          </li>
        </ul>
      </div>

      <div class="divider" />

      <!-- Upload JSON -->
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
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-background, #1a1a1a);
  border-radius: 10px;
  padding: 1.5rem;
  width: 540px;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

h3 {
  font-size: 1rem;
  font-weight: bold;
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
  opacity: 0.45;
}

.empty {
  font-size: 0.82rem;
  opacity: 0.5;
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
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 7px;
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
  opacity: 0.5;
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
  opacity: 0.7;
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
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.25s ease;
}

.action-btn:hover {
  box-shadow: inset 0 0 0 100px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 3px rgba(0, 0, 0, 0.3);
}

.action-btn.primary {
  background: linear-gradient(180deg, #444 0%, #2a2a2a 100%);
  border-color: rgba(255, 255, 255, 0.15);
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
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.25s ease;
}

.file-btn:hover {
  box-shadow: inset 0 0 0 100px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 3px rgba(0, 0, 0, 0.3);
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
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.25s ease;
}

.btn:hover {
  box-shadow: inset 0 0 0 100px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 3px rgba(0, 0, 0, 0.3);
}
</style>
