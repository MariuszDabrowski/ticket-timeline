<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ICSPersonGroup } from '../utils/icsParser'
import type { Person } from '../stores/people'
import { classifyIncoming } from '../utils/peopleMatch'
import BaseModal from './BaseModal.vue'

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
  <BaseModal title="Sync HiBob Vacations" size="wide" @close="emit('cancel')">
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
            <input type="checkbox" class="app-checkbox" v-model="row.selected" />
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

    <template #actions>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn" :disabled="selectedCount === 0" @click="confirm">Next</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-body :deep(.simplebar-content) {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
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
</style>
