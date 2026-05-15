import './assets/main.css'
import 'simplebar/dist/simplebar.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/500.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/zain/400.css'
import '@fontsource/zain/700.css'
import '@fontsource/zain/800.css'

import SimpleBar from 'simplebar'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'

const app = createApp(App)

app.use(createPinia())

app.directive('simplebar', {
  mounted(el, binding) {
    el._simplebar = new SimpleBar(el, binding.value ?? {})
  },
  unmounted(el) {
    el._simplebar?.unMount()
    delete el._simplebar
  },
})

app.mount('#app')
