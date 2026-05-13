import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import { polyfill } from 'mobile-drag-drop'
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour'
polyfill({ dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride })

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
