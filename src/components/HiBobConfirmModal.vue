<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ICSPersonGroup } from '../utils/icsParser'
import type { Person } from '../stores/people'

const props = defineProps<{
  groups: ICSPersonGroup[]
  people: Person[]
}>()

const emit = defineEmits<{
  confirm: [matches: { personId: number; group: ICSPersonGroup }[]]
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
    return { group: g, person, selected: person !== null }
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
  emit('confirm', matches)
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
          :class="{ unmatched: !row.person }"
        >
          <label class="row-label">
            <input
              type="checkbox"
              v-model="row.selected"
              :disabled="!row.person"
            />
            <span class="dot" v-if="row.person" :style="{ background: row.person.color }" />
            <span class="name">{{ row.group.personName }}</span>
            <span class="meta">
              <template v-if="row.person">
                → {{ row.person.name }} · {{ row.group.events.length }} period{{ row.group.events.length !== 1 ? 's' : '' }}, {{ totalDays(row.group) }} day{{ totalDays(row.group) !== 1 ? 's' : '' }}
              </template>
              <template v-else>
                <span class="no-match">No match in sidebar</span>
              </template>
            </span>
          </label>
        </div>
      </div>

      <div class="actions">
        <button @click="emit('cancel')">Cancel</button>
        <button class="primary" @click="confirm">Complete Sync</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-background, #fff);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 520px;
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
}

h3 {
  font-size: 1rem;
  font-weight: bold;
}

.subtitle {
  font-size: 0.85rem;
  opacity: 0.75;
}

.list {
  overflow-y: auto;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 1px solid rgba(128,128,128,0.2);
  border-radius: 6px;
  padding: 0.5rem;
}

.row {
  border-radius: 4px;
  padding: 0.3rem 0.4rem;
}

.row.unmatched {
  opacity: 0.5;
}

.row-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.83rem;
  cursor: pointer;
  user-select: none;
}

.row.unmatched .row-label {
  cursor: default;
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
  opacity: 0.65;
  font-size: 0.78rem;
}

.no-match {
  font-style: italic;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

button {
  padding: 0.35rem 0.8rem;
  font-size: 0.85rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: inherit;
}

button.primary {
  background: #333;
  color: #fff;
  border-color: #333;
}
</style>
