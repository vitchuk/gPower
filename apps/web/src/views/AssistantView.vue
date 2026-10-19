<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createChat, deleteChat, getMessages, listChats, streamChat } from '../api.js'
import ExerciseCard from '../components/ExerciseCard.vue'
import TabataCard from '../components/TabataCard.vue'

const router = useRouter()

function openTabata(id) {
  router.push({ path: '/tabata', query: { open: id } })
}

const chats = ref([])
const activeId = ref(null)
const messages = ref([])
const input = ref('')
const sending = ref(false)
const error = ref('')
const scrollEl = ref(null)
const inputEl = ref(null)

function autosize() {
  const el = inputEl.value
  if (!el) return
  const styles = getComputedStyle(el)
  const lineHeight = parseFloat(styles.lineHeight) || 22
  const padding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0)
  const maxHeight = Math.round(4 * lineHeight + padding)
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

const activeChat = computed(() => chats.value.find((c) => c.id === activeId.value) || null)

function scrollDown() {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

async function loadMessages() {
  if (!activeId.value) {
    messages.value = []
    return
  }
  const data = await getMessages(activeId.value)
  messages.value = data.messages.map((m) => ({
    role: m.role,
    content: m.content,
    citations: m.citations || [],
    tabata: m.tabata || [],
  }))
  scrollDown()
}

async function refresh() {
  const data = await listChats()
  chats.value = data.chats
  if (!chats.value.length) {
    const { chat } = await createChat()
    chats.value = [chat]
  }
  if (!activeId.value || !chats.value.some((c) => c.id === activeId.value)) {
    activeId.value = chats.value[0].id
  }
  await loadMessages()
}

function selectChat(id) {
  activeId.value = id
  loadMessages()
}

async function newChat() {
  const { chat } = await createChat()
  chats.value.unshift(chat)
  selectChat(chat.id)
}

async function removeChat(id) {
  await deleteChat(id)
  if (activeId.value === id) activeId.value = null
  await refresh()
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value || !activeId.value) return
  input.value = ''
  error.value = ''
  sending.value = true
  nextTick(autosize)

  messages.value.push({ role: 'user', content: text, citations: [], tabata: [] })
  const placeholder = { role: 'assistant', content: '', citations: [], tabata: [] }
  messages.value.push(placeholder)
  scrollDown()

  try {
    await streamChat(activeId.value, text, (event) => {
      if (event.type === 'token') {
        placeholder.content += event.text
        scrollDown()
      } else if (event.type === 'citations') {
        placeholder.citations = event.items
      } else if (event.type === 'tabata') {
        placeholder.tabata.push(event.tabata)
      } else if (event.type === 'error') {
        error.value = event.message
        placeholder.content += `${placeholder.content ? '\n' : ''}⚠ ${event.message}`
      }
    })
  } catch (e) {
    error.value = e.message
  } finally {
    sending.value = false
    await refresh()
  }
}

watch(activeId, scrollDown)
onMounted(refresh)
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 h-[75vh]">
    <aside class="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2 overflow-y-auto">
      <button
        class="w-full bg-emerald-600 text-white text-sm rounded-md py-2 hover:bg-emerald-700"
        @click="newChat"
      >
        + Новый чат
      </button>
      <button
        v-for="chat in chats"
        :key="chat.id"
        class="group flex items-center justify-between gap-2 text-left text-sm px-2 py-2 rounded-md"
        :class="chat.id === activeId ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'"
        @click="selectChat(chat.id)"
      >
        <span class="truncate">{{ chat.title }}</span>
        <span class="text-slate-400 group-hover:text-red-500" @click.stop="removeChat(chat.id)">×</span>
      </button>
    </aside>

    <section class="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
      <div ref="scrollEl" class="flex-1 overflow-y-auto [scrollbar-gutter:stable] p-4 space-y-4">
        <p v-if="!messages.length" class="text-slate-400 text-sm text-center mt-8">
          Спросите что-нибудь о тренировках — ассистент подберёт упражнения из каталога.
        </p>

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
          <div v-if="message.tabata && message.tabata.length" class="flex flex-col gap-2 max-w-[85%]">
            <TabataCard v-for="item in message.tabata" :key="item.id" :tabata="item">
              <button
                class="self-start text-xs bg-emerald-600 text-white rounded px-3 py-1 hover:bg-emerald-700"
                @click="openTabata(item.id)"
              >
                Открыть в таймере
              </button>
            </TabataCard>
          </div>
          <div v-if="message.citations && message.citations.length" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <ExerciseCard v-for="card in message.citations" :key="card.id" :exercise="card" />
          </div>
        </div>
      </div>

      <div class="border-t border-slate-200 p-3">
        <p v-if="error" class="text-xs text-red-600 mb-2">{{ error }}</p>
        <form class="flex gap-2 items-end" @submit.prevent="send">
          <textarea
            ref="inputEl"
            v-model="input"
            rows="1"
            :disabled="sending"
            placeholder="Например: подбери упражнения на грудь со штангой"
            class="flex-1 resize-none overflow-hidden border border-slate-300 rounded-md px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:bg-slate-50"
            @input="autosize"
            @keydown.enter.exact.prevent="send"
          ></textarea>
          <button
            type="submit"
            :disabled="sending || !input.trim()"
            class="bg-emerald-600 text-white text-sm rounded-md px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-50"
          >
            {{ sending ? '…' : 'Отправить' }}
          </button>
        </form>
      </div>
    </section>
  </div>
</template>
