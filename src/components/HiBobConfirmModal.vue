<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ICSPersonGroup } from '../utils/icsParser'
import type { Person } from '../stores/people'
import { classifyIncoming } from '../utils/peopleMatch'
import { useFocusTrap } from '../composables/useFocusTrap'

// Picker step for HiBob ICS sync. Lets the user choose which people from the
// file to import. Matching to existing people happens downstream in
// PeopleConfirmModal — we don't show that here so the user makes one decision
// at a time (pick → confirm matches), not both at once.
const props = defineProps<{
  groups: ICSPersonGroup[]
  // Existing roster, used only to decide which rows start checked: names that
  // appear to match someone already in the calendar are pre-selected; new
  // strangers start unchecked so importing into an empty project doesn't
  // accidentally pull in 50 people.
  people: Person[]
}>()

const emit = defineEmits<{
  confirm: [groups: ICSPersonGroup[]]
  cancel: []
}>()

function normalizeName(name: string): string {
  return name.toLowerCase().trim()
}

interface Row {
  group: ICSPersonGroup
  selected: boolean
}

// Pre-select only the rows whose name matches an existing person. HiBob ICS
// carries no email, so we run name-only classification: email-known is
// unreachable, none → unchecked, anything else → checked.
function looksLikeMatch(name: string): boolean {
  const tier = classifyIncoming({ name, email: null }, props.people).tier
  return tier !== 'none'
}

const rows = ref<Row[]>(
  props.groups.map((g) => ({ group: g, selected: looksLikeMatch(g.personName) })),
)

const searchQuery = ref('')
const filteredRows = computed(() => {
  const q = normalizeName(searchQuery.value)
  if (!q) return rows.value
  return rows.value.filter((r) => normalizeName(r.group.personName).includes(q))
})

const selectedCount = computed(() => rows.value.filter((r) => r.selected).length)
const { trapRef, onKeydown } = useFocusTrap()

function totalDays(group: ICSPersonGroup): number {
  return group.events.reduce((sum, ev) => {
    const start = new Date(ev.startDate.year, ev.startDate.month, ev.startDate.day)
    const end = new Date(ev.endDate.year, ev.endDate.month, ev.endDate.day)
    return sum + Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  }, 0)
}

function confirm() {
  emit('confirm', rows.value.filter((r) => r.selected).map((r) => r.group))
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div class="modal" ref="trapRef" role="dialog" aria-modal="true" aria-labelledby="hibob-confirm-modal-title" @keydown="onKeydown" @keydown.escape.prevent="emit('cancel')">
      <h3 id="hibob-confirm-modal-title"><span class="shine-text">Sync HiBob Vacations</span></h3>

      <div class="modal-body" v-simplebar>
        <p class="subtitle">
          Found <strong>{{ groups.length }}</strong>
          {{ groups.length === 1 ? 'person' : 'people' }} in the calendar.
          Pick who to sync — you'll confirm matches on the next step.
        </p>

        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="Search people…"
          aria-label="Filter people by name"
        />
        <div class="list" v-simplebar>
          <div v-for="row in filteredRows" :key="row.group.personName" class="row">
            <label class="row-label">
              <input type="checkbox" v-model="row.selected" />
              <span class="dot dot-new" />
              <span class="name">{{ row.group.personName }}</span>
              <span class="meta">
                {{ row.group.events.length }} period{{ row.group.events.length !== 1 ? 's' : '' }}, {{ totalDays(row.group) }} day{{ totalDays(row.group) !== 1 ? 's' : '' }}
              </span>
            </label>
          </div>
          <div v-if="filteredRows.length === 0" class="empty">
            No matches for "{{ searchQuery }}"
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn" @click="emit('cancel')">Cancel</button>
        <button class="btn" :disabled="selectedCount === 0" @click="confirm">Next</button>
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
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
  padding-top: 2px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
}
.modal-body :deep(.simplebar-content) {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-bottom: 0;
}

.subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

.subtitle strong {
  color: rgba(255, 255, 255, 0.95);
}

.search-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  font-family: inherit;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  transition: border-color 0.15s;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.search-input:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

.list {
  height: 18rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0.4rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
}

.row {
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}

.row-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.2;
  cursor: pointer;
  user-select: none;
  color: rgba(255, 255, 255, 0.8);
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.name {
  font-weight: 500;
  min-width: 140px;
}

.meta {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
}

.empty {
  padding: 0.6rem 0.4rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
  text-align: center;
}

.dot-new {
  background: rgba(255, 255, 255, 0.15);
  border: 1px dashed rgba(255, 255, 255, 0.3);
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
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.45) 0%, rgba(56, 189, 248, 0.35) 50%, rgba(129, 140, 248, 0.45) 100%);
  background-size: 200% auto;
  animation: checkboxGradient 2.5s ease-in-out infinite alternate;
  border-color: rgba(167, 139, 250, 0.6);
}

@keyframes checkboxGradient {
  0%   { background-position: 0% center; }
  100% { background-position: 100% center; }
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
</style>
