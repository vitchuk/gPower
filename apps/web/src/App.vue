<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { auth, logout } from './auth-store.js'

const router = useRouter()

async function doLogout() {
  await logout()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="bg-slate-900 text-white">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-6">
          <RouterLink to="/" class="text-xl font-bold tracking-tight">
            g<span class="text-emerald-400">Power</span>
          </RouterLink>
          <nav class="flex items-center gap-4 text-sm">
            <RouterLink
              to="/"
              class="text-slate-300 hover:text-white"
              active-class="text-white font-medium"
              exact-active-class="text-white font-medium"
            >
              Упражнения
            </RouterLink>
            <RouterLink to="/assistant" class="text-slate-300 hover:text-white" active-class="text-white font-medium">
              Ассистент
            </RouterLink>
            <RouterLink to="/tabata" class="text-slate-300 hover:text-white" active-class="text-white font-medium">
              Табата
            </RouterLink>
            <RouterLink to="/help" class="text-slate-300 hover:text-white" active-class="text-white font-medium">
              Помощь
            </RouterLink>
          </nav>
        </div>
        <div class="text-sm flex items-center gap-3">
          <template v-if="auth.user">
            <span class="text-slate-300">{{ auth.user.username }}</span>
            <button
              class="text-slate-300 hover:text-white flex items-center"
              aria-label="Выйти"
              title="Выйти"
              @click="doLogout"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-5 h-5"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </template>
          <RouterLink v-else to="/login" class="text-slate-300 hover:text-white">Войти</RouterLink>
        </div>
      </div>
    </header>

    <main class="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
