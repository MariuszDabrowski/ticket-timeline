<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onErrorCaptured } from 'vue'
import HomeView from './views/HomeView.vue'
import StyleGuideView from './views/StyleGuideView.vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  console.error('[Ticket Timeline] uncaught error:', err)
  // Let the error continue to propagate to global handlers / DevTools
  return false
})

function reload() {
  window.location.reload()
}

const bugReportUrl = 'https://github.com/MariuszDabrowski/ticket-timeline/issues/new?template=bug_report.md'

// Lightweight hash-based routing — only used for the dev-facing style guide
// at #styleguide. Anything else (including the # used by the share link
// payload, which is `#share=...`) falls through to the main app.
const route = ref(window.location.hash)
function onHashChange() {
  route.value = window.location.hash
}
onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))

const isStyleGuide = computed(() => route.value === '#styleguide')
</script>

<template>
  <div v-if="error" class="error-fallback" role="alert">
    <div class="error-box">
      <h1>Something went wrong</h1>
      <p>An unexpected error broke the page. Your saved projects are unaffected — they're stored in browser localStorage and will be there when you reload.</p>
      <pre class="error-message">{{ error.message }}</pre>
      <div class="error-actions">
        <button class="error-btn primary" @click="reload">Reload the page</button>
        <a class="error-btn" :href="bugReportUrl" target="_blank" rel="noopener noreferrer">Report this on GitHub</a>
      </div>
    </div>
  </div>
  <StyleGuideView v-else-if="isStyleGuide" />
  <HomeView v-else />
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  height: 100%;
}
</style>

<style scoped>
.error-fallback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: #1a1a1a;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Nunito', sans-serif;
}

.error-box {
  width: 100%;
  max-width: 520px;
  padding: 1.75rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%);
  border: 1px solid rgba(231, 76, 60, 0.35);
  border-radius: 10px;
}

h1 {
  font-size: 1.1rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.85rem;
  color: rgba(255, 200, 195, 0.95);
}

p {
  font-size: 0.88rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1rem;
}

.error-message {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  font-size: 0.78rem;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  color: rgba(255, 200, 195, 0.9);
  margin-bottom: 1.2rem;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 8rem;
  overflow: auto;
}

.error-actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.error-btn {
  padding: 6px 1rem;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1;
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 3px;
  cursor: pointer;
  background: linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%);
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1);
}

.error-btn.primary {
  color: rgba(255, 255, 255, 0.85);
}
</style>
