<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ top: number; fadingOut: boolean }>()
defineEmits<{ dismiss: [] }>()

const topCss = computed(() => props.top + 'px')
</script>

<template>
  <div
    class="hint-bubble hint-arrow-left"
    :class="{ 'hint-bubble--fading': fadingOut }"
  >
    <span><svg class="hint-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z"/></svg>This is a sample epic to play with. Drag tickets around to see how the calendar updates. Hit Reset (top right) when you're ready to plan your own.</span>
    <div class="hint-footer">
      <button class="hint-gotit" @click.stop="$emit('dismiss')">Got it</button>
    </div>
  </div>
</template>

<style scoped>
.hint-bubble {
  position: absolute;
  left: calc(230px + 18px);
  top: v-bind(topCss);
  z-index: 80;
  pointer-events: none;
  background:
    linear-gradient(to top left, rgba(0, 0, 0, 0.3) 0%, transparent 55%),
    #665c22;
  border: none;
  border-radius: 6px;
  padding: 0.7rem;
  max-width: 280px;
  font-size: 13px;
  line-height: 1.5;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.2);
  font-family: 'Nunito', sans-serif;
  opacity: 1;
  transform: translateY(-50%);
  animation: hintFadeIn 0.3s ease-out;
  transition: opacity 0.4s ease;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 0.35rem;
}

.hint-bubble--fading { opacity: 0; }

.hint-bubble > span {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
}

.hint-footer {
  width: 100%;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  padding-top: 0.3rem;
  margin-top: 0.1rem;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}

.hint-gotit {
  all: unset;
  display: inline-block;
  pointer-events: all;
  font-family: 'Nunito', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 223, 7, 0.85);
  cursor: pointer;
  letter-spacing: 0.03em;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}

.hint-gotit::after {
  display: none;
}

.hint-gotit:hover {
  color: #fff;
}

@media (max-width: 920px), (pointer: coarse) {
  .hint-bubble { display: none; }
}

.hint-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: #ffdf07;
}

@keyframes hintFadeIn {
  from { transform: translateY(calc(-50% - 4px)); }
  to   { transform: translateY(-50%); }
}

.hint-arrow-left::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  right: 100%;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-right: 7px solid #665c22;
}
</style>
