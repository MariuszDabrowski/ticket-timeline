<script setup lang="ts">
import { ref } from 'vue'
import { getSavedProjects, setSavedProjects } from '../utils/projectStorage'
import type { ProjectData } from '../utils/projectStorage'
import BaseModal from './BaseModal.vue'

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
  setSavedProjects(getSavedProjects().filter((p) => p.id !== id))
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
  <BaseModal title="Load Project" size="wide" @close="emit('close')">
    <div class="modal-body wide-body" v-simplebar>
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
                  <button class="btn btn-danger action-btn" @click="deleteProject(project.id); confirmId = null">Yes</button>
                  <button class="btn action-btn" @click="confirmId = null">No</button>
                </template>
                <template v-else>
                  <button class="btn btn-danger action-btn" aria-label="Delete project" @click="confirmId = project.id" title="Delete">✕</button>
                  <button class="btn action-btn primary" @click="loadSaved(project.id)">Load</button>
                </template>
              </div>
            </div>
            <div v-if="index < savedProjects.length - 1" class="project-divider" />
          </li>
        </ul>
      </div>

      <div class="section">
        <div class="section-label">Load from file</div>
        <div class="upload-area">
          <p class="upload-desc">Upload a <code>.json</code> file saved from this app.</p>
          <label class="btn file-btn">
            Choose File
            <input type="file" accept=".json,application/json" @change="onFileInput" />
          </label>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>

    <template #actions>
      <button class="btn" @click="emit('close')">Cancel</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.wide-body {
  padding: 1.25rem 1.5rem;
  gap: 1rem;
}
.wide-body :deep(.simplebar-content) {
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
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 7px;
  overflow: hidden;
}

.project-row {
  display: flex;
  align-items: stretch;
  position: relative;
}

.project-divider {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-bottom: 1px dashed rgba(128, 128, 128, 0.2);
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
}

.file-btn input {
  display: none;
}

.error {
  font-size: 0.8rem;
  color: #e74c3c;
}
</style>
