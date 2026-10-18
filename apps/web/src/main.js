import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { initAuth } from './auth-store.js'
import './assets/main.css'

initAuth().then(() => {
  createApp(App).use(router).mount('#app')
})
