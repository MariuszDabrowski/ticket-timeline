<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  getSavedProjects,
  setSavedProjects,
} from '../utils/projectStorage'
import type { ProjectData, SavedProject } from '../utils/projectStorage'

const props = defineProps<{ data: Omit<ProjectData, 'name'> }>()
const emit = defineEmits<{ close: [] }>()

const projectName = ref('My Project')

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
      <h3>Export Project</h3>

      <div class="field">
        <label class="field-label">Project name</label>
        <input class="field-input" v-model="projectName" placeholder="My Project" />
      </div>

      <div class="options">
        <!-- Save to browser -->
        <div class="option-card">
          <div class="option-icon">🗄️</div>
          <div class="option-body">
            <div class="option-title">Save to browser</div>
            <div class="option-desc">
              Stores the project in this browser's local storage. You can load it later from
              the Import screen.
              <span v-if="existingProject" class="overwrite-note">
                A project named <strong>{{ existingProject.name }}</strong> was last saved
                {{ fmtDate(existingProject.savedAt) }} — saving will update it.
              </span>
            </div>
          </div>
          <div class="option-action">
            <button class="btn primary" @click="saveToStorage" :disabled="!projectName.trim()">
              <template v-if="saveStatus === 'saved'">✓ Saved</template>
              <template v-else-if="saveStatus === 'updated'">✓ Updated</template>
              <template v-else-if="existingProject">Update</template>
              <template v-else>Save</template>
            </button>
          </div>
        </div>

        <!-- Download JSON -->
        <div class="option-card">
          <div class="option-icon">⬇️</div>
          <div class="option-body">
            <div class="option-title">Download JSON</div>
            <div class="option-desc">
              Downloads a <code>.json</code> file containing all tickets, people, and vacation
              data. You can import this file on any device.
            </div>
          </div>
          <div class="option-action">
            <button class="btn" @click="downloadJSON" :disabled="!projectName.trim()">
              Download
            </button>
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
  width: 520px;
  max-width: calc(100vw - 2rem);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

h3 {
  font-size: 1rem;
  font-weight: bold;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.75rem;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field-input {
  padding: 0.4rem 0.6rem;
  font-size: 0.9rem;
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 5px;
  background: transparent;
  color: inherit;
  outline: none;
}

.field-input:focus {
  border-color: rgba(128, 128, 128, 0.7);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-card {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
}

.option-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 0.1rem;
}

.option-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.option-title {
  font-size: 0.88rem;
  font-weight: 600;
}

.option-desc {
  font-size: 0.78rem;
  opacity: 0.6;
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

.btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.btn.primary {
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  border-color: rgba(0, 0, 0, 0.55);
}
</style>
