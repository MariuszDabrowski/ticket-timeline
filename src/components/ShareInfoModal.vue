<script setup lang="ts">
import BaseModal from './BaseModal.vue'

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal title="Share Link" size="compact" @close="emit('close')">
    <div class="modal-body share-info-body">
      <p>Copies a link that contains your full ticket timeline. Anyone with the link can open it directly in their browser — no account, login, or file upload needed.</p>
      <p>The entire project — tickets, people, timeline, and vacations — is compressed and encoded directly into the URL. Nothing is sent to a server.</p>
      <p class="note">For very large calendars, ticket titles may be shortened or omitted automatically to keep the link within browser limits.</p>
    </div>
    <template #actions>
      <button class="btn" @click="emit('close')">Got it</button>
    </template>
  </BaseModal>
</template>

<style scoped>
/* Local overrides for the dense paragraph layout this modal uses. */
.share-info-body {
  padding: 0.75rem 1.5rem;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.84rem;
  line-height: 1.6;
}
.share-info-body > * + * {
  margin-top: 0.75rem;
}

.note {
  font-size: 0.78rem;
  opacity: 0.6;
  font-style: italic;
}
</style>
