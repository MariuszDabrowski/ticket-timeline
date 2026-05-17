<script setup lang="ts">
import { useFocusTrap } from '../composables/useFocusTrap'

// Shared modal shell: backdrop + frame + title bar + actions footer + ARIA
// + focus trap + escape-to-close + click-backdrop-to-close. Every modal in
// the app should use this so a theme tweak or accessibility fix lands in one
// place instead of ~12.
//
// Body content is rendered raw into the default slot (no wrapper div) so
// modals that need v-simplebar or a custom body container can apply it at
// the call site. Common body padding/scroll styles live globally on
// .modal-body in main.css.
withDefaults(defineProps<{
  title: string
  // Three width tiers — compact for confirmations, normal for forms, wide
  // for long-list pickers. Resolves the previous sprawl of 8 ad-hoc widths.
  size?: 'compact' | 'normal' | 'wide'
}>(), {
  size: 'normal',
})

const emit = defineEmits<{ close: [] }>()

const { trapRef, onKeydown } = useFocusTrap()
// Stable per-instance id so two modals on the page don't share aria-labelledby.
const titleId = `base-modal-title-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div
      class="modal"
      :class="`modal--${size}`"
      ref="trapRef"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown="onKeydown"
      @keydown.escape.prevent="emit('close')"
    >
      <h3 :id="titleId"><span class="shine-text">{{ title }}</span></h3>
      <slot />
      <div v-if="$slots.actions" class="actions">
        <slot name="actions" />
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
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 4rem);
  color: rgba(255, 255, 255, 0.8);
}

.modal--compact { width: 400px; }
.modal--normal { width: 500px; }
.modal--wide { width: 560px; }

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
  margin: 0;
}

h3 span {
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 0 rgba(255, 255, 255, 0.1);
  padding-top: 2px;
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
