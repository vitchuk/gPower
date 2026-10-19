<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createTabata, deleteTabata, getTabata, listTabatas, updateTabata } from '../api.js'
import { computeDuration, formatDuration, player, startPlayer } from '../tabata-player.js'
import TabataBuilder from '../components/TabataBuilder.vue'
import TabataCard from '../components/TabataCard.vue'
import TabataPlayer from '../components/TabataPlayer.vue'

const route = useRoute()
const router = useRouter()

const tabatas = ref([])
const mode = ref('list')
const editing = ref(null)
const preview = ref(null)
const error = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const data = await listTabatas()
    tabatas.value = data.tabatas
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function openFromQuery() {
  const id = route.query.open
  if (!id) return
  let tabata = tabatas.value.find((t) => String(t.id) === String(id))
  if (!tabata) {
    try {
      tabata = await getTabata(id)
    } catch {
      tabata = null
    }
  }
  if (tabata) {
    preview.value = tabata
    mode.value = 'preview'
  }
}

function newTabata() {
  editing.value = null
  mode.value = 'builder'
}

function edit(tabata) {
  editing.value = tabata
  mode.value = 'builder'
}

async function save(payload) {
  error.value = ''
  try {
    if (editing.value) await updateTabata(editing.value.id, payload)
    else await createTabata(payload)
    editing.value = null
    mode.value = 'list'
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function remove(tabata) {
  error.value = ''
  try {
    await deleteTabata(tabata.id)
    if (preview.value?.id === tabata.id) {
      preview.value = null
      mode.value = 'list'
    }
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function start(tabata) {
  startPlayer(tabata)
  mode.value = 'player'
}

function exitPlayer() {
  mode.value = preview.value ? 'preview' : 'list'
}

function exitPreview() {
  preview.value = null
  mode.value = 'list'
  if (route.query.open) router.replace({ path: '/tabata' })
}

watch(
  () => route.query.open,
  () => openFromQuery(),
)

onMounted(async () => {
  await load()
  await openFromQuery()
  if (mode.value === 'list' && player.segments.length && !player.finished) {
    mode.value = 'player'
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold">Табата-таймер</h1>
        <p class="text-xs text-slate-500">Соберите тренировку из упражнений каталога, сохраните и запустите.</p>
      </div>
      <button
        v-if="mode === 'list'"
        class="bg-emerald-600 text-white text-sm rounded-md px-4 py-2 hover:bg-emerald-700"
        @click="newTabata"
      >
        + Новая табата
      </button>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <TabataBuilder v-if="mode === 'builder'" :initial="editing" @save="save" @cancel="mode = 'list'" />

    <TabataPlayer v-else-if="mode === 'player'" @exit="exitPlayer" />

    <div v-else-if="mode === 'preview' && preview" class="flex flex-col gap-4">
      <TabataCard :tabata="preview" />
      <div class="flex items-center gap-2">
        <button class="bg-emerald-600 text-white text-sm rounded-md px-4 py-2 hover:bg-emerald-700" @click="start(preview)">
          Старт
        </button>
        <button class="text-sm border border-slate-300 rounded-md px-4 py-2 hover:bg-slate-50" @click="edit(preview)">
          Редактировать
        </button>
        <button class="text-sm text-slate-500 hover:text-slate-700" @click="exitPreview">К списку</button>
      </div>
    </div>

    <div v-else class="flex flex-col gap-3">
      <p v-if="loading" class="text-sm text-slate-400">Загрузка…</p>
      <p v-else-if="!tabatas.length" class="text-sm text-slate-400">
        Пока нет сохранённых табат. Создайте вручную или попросите ассистента.
      </p>
      <div v-for="tabata in tabatas" :key="tabata.id" class="flex flex-col gap-2">
        <TabataCard :tabata="tabata" />
        <div class="flex items-center gap-2 -mt-1">
          <button class="text-xs bg-emerald-600 text-white rounded px-3 py-1 hover:bg-emerald-700" @click="start(tabata)">
            Старт
          </button>
          <button class="text-xs text-slate-600 hover:underline" @click="edit(tabata)">Изменить</button>
          <button class="text-xs text-slate-400 hover:text-red-500" @click="remove(tabata)">Удалить</button>
          <span class="text-xs text-slate-300">{{ formatDuration(tabata.durationSec || computeDuration(tabata.params, tabata.exercises)) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
