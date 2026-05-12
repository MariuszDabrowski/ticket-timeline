<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ICSPersonGroup } from '../utils/icsParser'
import type { Person } from '../stores/people'

const props = defineProps<{
  groups: ICSPersonGroup[]
  people: Person[]
}>()

const emit = defineEmits<{
  confirm: [matches: { personId: number; group: ICSPersonGroup }[], newPeople: { name: string; group: ICSPersonGroup }[]]
  cancel: []
}>()

function normalizeName(name: string): string {
  return name.toLowerCase().trim()
}

function matchPerson(icsName: string): Person | null {
  const normalized = normalizeName(icsName)
  // Exact match
  let match = props.people.find((p) => normalizeName(p.name) === normalized)
  if (match) return match
  // ICS name contains sidebar name (e.g. sidebar = "Mariusz", ICS = "Mariusz Dabrowski")
  match = props.people.find((p) => normalized.includes(normalizeName(p.name)))
  if (match) return match
  // Sidebar name contains ICS name
  match = props.people.find((p) => normalizeName(p.name).includes(normalized))
  return match ?? null
}

interface Row {
  group: ICSPersonGroup
  person: Person | null
  selected: boolean
}

const rows = ref<Row[]>(
  props.groups.map((g) => {
    const person = matchPerson(g.personName)
    return { group: g, person, selected: false }
  })
)

const matchedCount = computed(() => rows.value.filter((r) => r.person !== null).length)
const unmatchedCount = computed(() => rows.value.filter((r) => r.person === null).length)

function totalDays(group: ICSPersonGroup): number {
  return group.events.reduce((sum, ev) => {
    const start = new Date(ev.startDate.year, ev.startDate.month, ev.startDate.day)
    const end = new Date(ev.endDate.year, ev.endDate.month, ev.endDate.day)
    return sum + Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  }, 0)
}

function confirm() {
  const matches = rows.value
    .filter((r) => r.selected && r.person !== null)
    .map((r) => ({ personId: r.person!.id, group: r.group }))
  const newPeople = rows.value
    .filter((r) => r.selected && r.person === null)
    .map((r) => ({ name: r.group.personName, group: r.group }))
  emit('confirm', matches, newPeople)
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal">
      <h3>Confirm Sync</h3>
      <p class="subtitle">
        Found <strong>{{ matchedCount }}</strong> matched
        <template v-if="unmatchedCount > 0"> and <strong>{{ unmatchedCount }}</strong> unmatched</template>
        people. Select who to sync.
      </p>

      <div class="list">
        <div
          v-for="row in rows"
          :key="row.group.personName"
          class="row"

        >
          <label class="row-label">
            <input type="checkbox" v-model="row.selected" />
            <span class="dot" v-if="row.person" :style="{ background: row.person.color }" />
            <span class="dot dot-new" v-else />
            <span class="name">{{ row.group.personName }}</span>
            <span class="meta">
              <template v-if="row.person">
                → {{ row.person.name }} · {{ row.group.events.length }} period{{ row.group.events.length !== 1 ? 's' : '' }}, {{ totalDays(row.group) }} day{{ totalDays(row.group) !== 1 ? 's' : '' }}
              </template>
              <template v-else-if="row.selected">
                <span class="will-add">Will be added to sidebar</span>
              </template>
              <template v-else>
                <span class="no-match">Not in sidebar — check to add</span>
              </template>
            </span>
          </label>
        </div>
      </div>

      <div class="actions">
        <button @click="emit('cancel')">Cancel</button>
        <button @click="confirm">Complete Sync</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 520px;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
}

h3 {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.95);
}

.subtitle strong {
  color: #fff;
}

.list {
  overflow-y: auto;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 6px;
  padding: 0.5rem;
}

.row {
  border-radius: 4px;
  padding: 0.3rem 0.4rem;
}

.row-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.83rem;
  cursor: pointer;
  user-select: none;
  color: #fff;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.name {
  font-weight: 500;
  min-width: 140px;
}

.meta {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.78rem;
}

.dot-new {
  background: rgba(255, 255, 255, 0.15);
  border: 1px dashed rgba(255, 255, 255, 0.3);
}

.no-match {
  font-style: italic;
  opacity: 0.5;
}

.will-add {
  font-style: italic;
  color: #6dd5fa;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

button {
  padding: 5px 1rem;
  font-size: 0.76rem;
  font-family: 'Nunito', sans-serif;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 2px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  line-height: 1;
  transition: box-shadow 0.25s ease;
}

button:hover {
  box-shadow: inset 0 0 0 100px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1);
}

</style>
