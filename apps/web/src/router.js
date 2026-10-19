import { createRouter, createWebHistory } from 'vue-router'
import CatalogView from './views/CatalogView.vue'
import ExerciseView from './views/ExerciseView.vue'
import AssistantView from './views/AssistantView.vue'
import TabataView from './views/TabataView.vue'
import HelpView from './views/HelpView.vue'
import LoginView from './views/LoginView.vue'
import { auth } from './auth-store.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'catalog', component: CatalogView },
    { path: '/exercise/:id', name: 'exercise', component: ExerciseView, props: true },
    { path: '/assistant', name: 'assistant', component: AssistantView, meta: { requiresAuth: true } },
    { path: '/tabata', name: 'tabata', component: TabataView, meta: { requiresAuth: true } },
    { path: '/help', name: 'help', component: HelpView },
    { path: '/login', name: 'login', component: LoginView },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

export default router
