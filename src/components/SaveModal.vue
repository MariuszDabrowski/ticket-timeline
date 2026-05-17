<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  getSavedProjects,
  setSavedProjects,
} from '../utils/projectStorage'
import type { ProjectData, SavedProject } from '../utils/projectStorage'
import BaseModal from './BaseModal.vue'
import { fmtTimestamp } from '../utils/dates'

const props = defineProps<{ data: Omit<ProjectData, 'name'>; initialName?: string; exportingImage?: boolean }>()
const emit = defineEmits<{ close: []; save: [name: string]; exportImage: [includeSummary: boolean] }>()

const includeSummary = ref(true)
const projectName = ref(props.initialName ?? 'your-project-name')

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


</script>

<template>
  <BaseModal title="Save Project" size="wide" @close="emit('close')">
    <div class="modal-body wide-body" v-simplebar>
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
                {{ fmtTimestamp(existingProject.savedAt) }} — saving will update it.
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

        <div class="option-divider" />

        <div class="option-card">
          <div class="option-body">
            <div class="option-title">Export as Image</div>
            <div class="option-desc">
              Downloads a <code>.png</code> of the full calendar at 2× resolution.
            </div>
            <label class="summary-toggle">
              <input type="checkbox" class="app-checkbox" v-model="includeSummary" />
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

        <div class="option-divider" />

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

    <template #actions>
      <button class="btn" @click="emit('close')">Close</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.wide-body {
  padding: 1.25rem 1.5rem;
  gap: 1.25rem;
}
.wide-body :deep(.simplebar-content) {
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
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 7px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
}

.option-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 0.9rem;
}

.option-divider {
  border-bottom: 1px dashed rgba(128, 128, 128, 0.2);
  margin: 0;
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
