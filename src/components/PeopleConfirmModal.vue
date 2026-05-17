<script setup lang="ts">
import { ref } from 'vue'
import type { Person } from '../stores/people'
import type { Classification, MatchTier, Decision } from '../utils/peopleMatch'
import { useFocusTrap } from '../composables/useFocusTrap'

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

const { trapRef, onKeydown } = useFocusTrap()
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <div
      class="modal"
      ref="trapRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="people-confirm-title"
      @keydown="onKeydown"
      @keydown.escape.prevent="emit('cancel')"
    >
      <h3 id="people-confirm-title"><span class="shine-text">Confirm People</span></h3>

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
                <select v-model="state.action" class="action-select" :aria-label="`Action for ${state.classification.incoming.name}`">
                  <option value="merge">Merge with</option>
                  <option value="create">Create new</option>
                </select>

                <select
                  v-if="state.action === 'merge'"
                  v-model="state.personId"
                  class="person-select"
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

      <div class="actions">
        <button class="btn" @click="emit('cancel')">Cancel</button>
        <button class="btn" :disabled="!canConfirm()" @click="confirm">Confirm</button>
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
  width: 560px;
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
  gap: 0.7rem;
  padding: 1rem 1.25rem;
  overflow-y: auto;
}

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

.action-select,
.person-select {
  font-family: inherit;
  font-size: 0.8rem;
  padding: 0.3rem 1.8rem 0.3rem 0.55rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  outline: none;
  /* Native dropdown arrow on macOS sits flush against the right edge and
     ignores padding-right. Suppress it and paint our own SVG chevron with
     room to breathe. */
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.55rem center;
  background-size: 12px;
}

.person-select {
  flex: 1;
  min-width: 0;
}

.person-select.needs-pick {
  border-color: rgba(231, 76, 60, 0.6);
}

.action-select:focus,
.person-select:focus {
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
