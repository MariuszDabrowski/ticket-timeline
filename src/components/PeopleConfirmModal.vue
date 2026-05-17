<script setup lang="ts">
import { ref } from 'vue'
import type { Person } from '../stores/people'
import type { Classification, MatchTier, Decision } from '../utils/peopleMatch'
import BaseModal from './BaseModal.vue'

const props = defineProps<{
  // Caller-classified incoming people that need user input. Email-known rows
  // should be filtered out before opening the modal (auto-merged silently).
  rows: Classification[]
  people: Person[]
}>()

const emit = defineEmits<{
  confirm: [decisions: Decision[]]
  cancel: []
}>()

interface RowState {
  classification: Classification
  action: 'merge' | 'create'
  personId: number | null  // null = no selection (ambiguous, no default)
}

function defaultStateFor(c: Classification): RowState {
  // Ambiguous → no default; user must pick. Everything else with a suggestion
  // pre-selects "merge with suggestion". No match → "create new".
  if (c.tier === 'ambiguous') {
    return { classification: c, action: 'merge', personId: null }
  }
  if (c.suggestedPersonId !== undefined) {
    return { classification: c, action: 'merge', personId: c.suggestedPersonId }
  }
  return { classification: c, action: 'create', personId: null }
}

const states = ref<RowState[]>(props.rows.map(defaultStateFor))

function tierLabel(tier: MatchTier): string {
  switch (tier) {
    case 'exact-name': return 'Exact name'
    case 'fuzzy': return 'Fuzzy'
    case 'ambiguous': return 'Ambiguous'
    case 'none': return 'New'
    case 'email-known': return 'Email match'
  }
}

const canConfirm = () => states.value.every(
  (s) => s.action === 'create' || (s.action === 'merge' && s.personId !== null),
)

function confirm() {
  if (!canConfirm()) return
  const decisions: Decision[] = states.value.map((s) => ({
    incoming: s.classification.incoming,
    action: s.action,
    ...(s.action === 'merge' ? { personId: s.personId! } : {}),
  }))
  emit('confirm', decisions)
}
</script>

<template>
  <BaseModal title="Confirm People" size="wide" @close="emit('cancel')">
    <div class="modal-body">
      <p class="subtitle">
        Some incoming names need a decision. For each, choose whether to merge
        with an existing person or create a new one.
      </p>

      <div class="list">
        <template v-for="(state, idx) in states" :key="idx">
          <div v-if="idx > 0" class="row-divider" />
          <div class="row">
            <div class="row-header">
              <span class="incoming-name">{{ state.classification.incoming.name || '(no name)' }}</span>
              <span v-if="state.classification.incoming.email" class="incoming-email">{{ state.classification.incoming.email }}</span>
              <span class="tier-badge" :class="`tier-${state.classification.tier}`">
                {{ tierLabel(state.classification.tier) }}
              </span>
            </div>

            <div class="row-action">
              <select v-model="state.action" class="app-select action-select" :aria-label="`Action for ${state.classification.incoming.name}`">
                <option value="merge">Merge with</option>
                <option value="create">Create new</option>
              </select>

              <select
                v-if="state.action === 'merge'"
                v-model="state.personId"
                class="app-select person-select"
                :class="{ 'needs-pick': state.personId === null }"
                :aria-label="`Person to merge ${state.classification.incoming.name} with`"
              >
                <option :value="null" disabled>Pick a person…</option>
                <option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
          </div>
        </template>
      </div>
    </div>

    <template #actions>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn" :disabled="!canConfirm()" @click="confirm">Confirm</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
}

.list {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 7px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.1) 100%);
}

.row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem 0.9rem;
}

.row-divider {
  border-bottom: 1px dashed rgba(128, 128, 128, 0.2);
}

.row-header {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.incoming-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.92);
}

.incoming-email {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.tier-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-weight: 600;
  margin-left: auto;
}

.tier-exact-name { background: rgba(46, 204, 113, 0.18); color: #5ee59c; }
.tier-fuzzy { background: rgba(241, 196, 15, 0.18); color: #f5d36a; }
.tier-ambiguous { background: rgba(231, 76, 60, 0.18); color: #ff8a7a; }
.tier-none { background: rgba(52, 152, 219, 0.18); color: #6dd5fa; }
.tier-email-known { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.55); }

.row-action {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

/* Override the default .app-select 14px/.45rem padding — this modal uses a
   denser type scale for the inline picker. */
.action-select,
.person-select {
  font-size: 0.8rem;
  padding: 0.3rem 1.8rem 0.3rem 0.55rem;
  border-radius: 4px;
  width: auto;
}

.person-select {
  flex: 1;
  min-width: 0;
}

.person-select.needs-pick {
  border-color: rgba(231, 76, 60, 0.6);
}
</style>
