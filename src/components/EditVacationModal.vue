<script setup lang="ts">
import { ref } from 'vue'
import type { Person } from '../stores/people'
import BaseModal from './BaseModal.vue'
import PersonPicker from './PersonPicker.vue'

const props = defineProps<{
  vacationId: number
  currentPersonId: number
  people: Person[]
}>()

const emit = defineEmits<{
  save: [vacationId: number, personId: number]
  delete: [vacationId: number]
  cancel: []
}>()

const selectedPersonId = ref(props.currentPersonId)
</script>

<template>
  <BaseModal title="Edit Vacation" size="compact" @close="emit('cancel')">
    <div class="modal-body form-body" v-simplebar>
      <div class="app-field">
        <label class="app-label">Person</label>
        <PersonPicker :people="people" v-model="selectedPersonId" />
      </div>
    </div>

    <template #actions>
      <button class="btn btn-danger leading" @click="emit('delete', vacationId)">Delete</button>
      <button class="btn" @click="emit('cancel')">Cancel</button>
      <button class="btn" @click="emit('save', vacationId, selectedPersonId)">Save</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-body {
  padding: 0 1.5rem;
  gap: 1rem;
}
.form-body :deep(.simplebar-content) {
  gap: 1rem;
}

</style>
