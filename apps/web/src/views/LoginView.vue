<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, register } from '../auth-store.js'

const route = useRoute()
const router = useRouter()

const mode = ref('login')
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (mode.value === 'login') {
      await login(username.value, password.value)
    } else {
      await register(username.value, password.value)
    }
    router.push(route.query.redirect?.toString() || '/assistant')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-10 bg-white border border-slate-200 rounded-xl p-6">
    <h1 class="text-xl font-bold mb-4">
      {{ mode === 'login' ? 'Вход' : 'Регистрация' }}
    </h1>

    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-slate-500">Логин</span>
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          class="border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-slate-500">Пароль</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </label>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="busy"
        class="bg-emerald-600 text-white rounded-md py-2 font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {{ mode === 'login' ? 'Войти' : 'Создать аккаунт' }}
      </button>
    </form>

    <button class="mt-4 text-sm text-emerald-600 hover:underline" @click="mode = mode === 'login' ? 'register' : 'login'">
      {{ mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти' }}
    </button>
  </div>
</template>
