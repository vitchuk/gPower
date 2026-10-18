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
            <RouterLink to="/help" class="text-slate-300 hover:text-white" active-class="text-white font-medium">
              Помощь
            </RouterLink>
          </nav>
        </div>
        <div class="text-sm flex items-center gap-3">
          <template v-if="auth.user">
            <span class="text-slate-300">{{ auth.user.username }}</span>
            <button class="text-slate-300 hover:text-white" @click="doLogout">Выйти</button>
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
