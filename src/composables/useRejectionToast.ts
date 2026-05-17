import { ref } from 'vue'

// Module-level state — one toast for the whole app, rendered once by HomeView.
const message = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

export function useRejectionToast() {
  function showRejection(msg: string) {
    message.value = msg
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { message.value = null }, 2500)
  }

  return { message, showRejection }
}
