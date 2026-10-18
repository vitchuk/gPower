<script setup>
import { nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { streamHelp } from '../api.js'
import { auth } from '../auth-store.js'
import { FAQ } from '../faq.js'
import ExerciseCard from '../components/ExerciseCard.vue'

const messages = ref([])
const input = ref('')
const sending = ref(false)
const error = ref('')
const scrollEl = ref(null)
const openFaq = ref({})

function toggleFaq(index) {
  openFaq.value[index] = !openFaq.value[index]
}

function scrollDown() {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

function clear() {
  messages.value = []
  error.value = ''
  openFaq.value = {}
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  error.value = ''
  sending.value = true

  const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
  messages.value.push({ role: 'user', content: text, citations: [] })
  const placeholder = { role: 'assistant', content: '', citations: [] }
  messages.value.push(placeholder)
  scrollDown()

  try {
    await streamHelp(text, history.slice(-10), (event) => {
      if (event.type === 'token') {
        placeholder.content += event.text
        scrollDown()
      } else if (event.type === 'citations') {
        placeholder.citations = event.items
      } else if (event.type === 'error') {
        error.value = event.message
        placeholder.content += `${placeholder.content ? '\n' : ''}⚠ ${event.message}`
      }
    })
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
    scrollDown()
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 h-[75vh]">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold">Помощь</h1>
        <p class="text-xs text-slate-500">
          Ассистент ответит на любой вопрос. История диалога не сохраняется.
          <template v-if="!auth.user">
            <RouterLink to="/login" class="text-emerald-600 hover:underline">Войдите</RouterLink>,
            чтобы вести личные чаты с сохранением.
          </template>
        </p>
      </div>
      <button
        class="text-sm border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50"
        @click="clear"
      >
        Очистить
      </button>
    </div>

    <section class="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden flex-1">
      <div ref="scrollEl" class="flex-1 overflow-y-auto [scrollbar-gutter:stable] p-4 space-y-4">
        <div v-if="!messages.length" class="space-y-2 mt-4">
          <div
            v-for="(item, index) in FAQ"
            :key="index"
            class="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden"
          >
            <button
              class="w-full flex items-center justify-between gap-3 text-left px-4 py-3 hover:bg-slate-100 transition-colors"
              :aria-expanded="!!openFaq[index]"
              @click="toggleFaq(index)"
            >
              <span class="text-sm font-medium text-slate-800">{{ item.q }}</span>
              <span
                class="text-slate-400 text-lg leading-none select-none transition-transform duration-200"
                :class="openFaq[index] ? 'rotate-45' : ''"
              >+</span>
            </button>
            <div v-show="openFaq[index]" class="px-4 pb-4 text-sm text-slate-600 whitespace-pre-line">
              {{ item.a }}
            </div>
          </div>
        </div>

        <div v-for="(message, i) in messages" :key="i" class="flex flex-col gap-2">
          <div
            class="max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap text-sm"
            :class="
              message.role === 'user'
                ? 'self-end bg-emerald-600 text-white'
                : 'self-start bg-slate-100 text-slate-800'
            "
          >
            {{ message.content || '…' }}
          </div>
          <div v-if="message.citations && message.citations.length" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <ExerciseCard v-for="card in message.citations" :key="card.id" :exercise="card" />
          </div>
        </div>
      </div>

      <div class="border-t border-slate-200 p-3">
        <p v-if="error" class="text-xs text-red-600 mb-2">{{ error }}</p>
        <form class="flex gap-2" @submit.prevent="send">
          <input
            v-model="input"
            type="text"
            :disabled="sending"
            placeholder="Ваш вопрос…"
            class="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-slate-50"
          />
          <button
            type="submit"
            :disabled="sending || !input.trim()"
            class="bg-emerald-600 text-white text-sm rounded-md px-4 hover:bg-emerald-700 disabled:opacity-50"
          >
            {{ sending ? '…' : 'Отправить' }}
          </button>
        </form>
      </div>
    </section>
  </div>
</template>
