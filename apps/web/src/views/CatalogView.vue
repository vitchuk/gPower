<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { getExercises, getFilters } from '../api.js'
import ExerciseCard from '../components/ExerciseCard.vue'
import FilterPanel from '../components/FilterPanel.vue'

const filters = ref({ muscles: [], equipment: [], levels: [], forces: [], mechanics: [], categories: [] })
const selection = reactive({
  q: '',
  muscle: '',
  equipment: '',
  level: '',
  force: '',
  mechanic: '',
  category: '',
})

const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 24
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await getExercises({ ...selection, page: page.value, pageSize })
    items.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = 'Не удалось загрузить упражнения. API запущен?'
  } finally {
    loading.value = false
  }
}

const totalPages = () => Math.max(1, Math.ceil(total.value / pageSize))

function reset() {
  for (const key of Object.keys(selection)) selection[key] = ''
}

let debounce
watch(
  () => ({ ...selection }),
  () => {
    page.value = 1
    clearTimeout(debounce)
    debounce = setTimeout(load, 250)
  },
  { deep: true },
)

watch(page, load)

onMounted(async () => {
  try {
    filters.value = await getFilters()
  } catch (e) {
    error.value = 'Не удалось загрузить фильтры. API запущен?'
  }
  load()
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
    <FilterPanel
      :filters="filters"
      :modelValue="selection"
      @update:modelValue="Object.assign(selection, $event)"
      @reset="reset"
    />

    <section class="flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          v-model="selection.q"
          type="search"
          placeholder="Поиск (рус/англ) по названию и технике…"
          class="flex-1 border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <span class="text-sm text-slate-500 whitespace-nowrap">Найдено: {{ total }}</span>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div v-if="loading" class="text-slate-500 py-10 text-center">Загрузка…</div>

      <template v-else>
        <div
          v-if="items.length"
          class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <ExerciseCard v-for="item in items" :key="item.id" :exercise="item" />
        </div>
        <p v-else class="text-slate-500 py-10 text-center">Ничего не найдено</p>

        <div v-if="totalPages() > 1" class="flex items-center justify-center gap-3 pt-2">
          <button
            class="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
            :disabled="page <= 1"
            @click="page--"
          >
            Назад
          </button>
          <span class="text-sm text-slate-600">{{ page }} / {{ totalPages() }}</span>
          <button
            class="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
            :disabled="page >= totalPages()"
            @click="page++"
          >
            Вперёд
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
