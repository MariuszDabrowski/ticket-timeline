<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ICSPersonGroup } from '../utils/icsParser'
import type { Person } from '../stores/people'
import { useFocusTrap } from '../composables/useFocusTrap'

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
  let match = props.people.find((p) => normalizeName(p.name) === normalized)
  if (match) return match
  match = props.people.find((p) => normalized.includes(normalizeName(p.name)))
  if (match) return match
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
const { trapRef, onKeydown } = useFocusTrap()

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
    <div class="modal" ref="trapRef" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3><span>Confirm Sync</span></h3>

      <div class="modal-body" v-simplebar>
        <p class="subtitle">
          Found <strong>{{ matchedCount }}</strong> matched
          <template v-if="unmatchedCount > 0"> and <strong>{{ unmatchedCount }}</strong> unmatched</template>
          people. Select who to sync.
        </p>

        <div class="list" v-simplebar>
          <div v-for="row in rows" :key="row.group.personName" class="row">
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
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}

.subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

.subtitle strong {
  color: rgba(255, 255, 255, 0.95);
}

.list {
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0.5rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
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
  color: rgba(255, 255, 255, 0.8);
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
  color: rgba(255, 255, 255, 0.5);
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

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
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
  color: rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
  line-height: 1;
}
</style>
