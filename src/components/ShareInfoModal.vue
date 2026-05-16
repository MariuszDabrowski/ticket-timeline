<script setup lang="ts">
import { useFocusTrap } from '../composables/useFocusTrap'

const emit = defineEmits<{ close: [] }>()
const { trapRef, onKeydown } = useFocusTrap()
</script>

<template>
  <Teleport to="body">
  <div class="backdrop" @click.self="emit('close')">
    <div class="modal" ref="trapRef" role="dialog" aria-modal="true" aria-labelledby="share-info-modal-title" @keydown="onKeydown" @keydown.escape.prevent="emit('close')">
      <h3 id="share-info-modal-title"><span class="shine-text">Share Link</span></h3>

      <div class="body">
        <p>Copies a link that contains your full ticket timeline. Anyone with the link can open it directly in their browser — no account, login, or file upload needed.</p>
        <p>The entire project — tickets, people, timeline, and vacations — is compressed and encoded directly into the URL. Nothing is sent to a server.</p>
        <p class="note">For very large calendars, ticket titles may be shortened or omitted automatically to keep the link within browser limits.</p>
      </div>

      <div class="footer">
        <button class="btn" @click="emit('close')">Got it</button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background-color: #1a1a1a;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 400px;
  max-width: calc(100vw - 2rem);
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
  padding-top: 2px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.84rem;
  line-height: 1.6;
}

.note {
  font-size: 0.78rem;
  opacity: 0.6;
  font-style: italic;
}

.footer {
  display: flex;
  justify-content: flex-end;
  padding: 0.65rem 1rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

</style>
