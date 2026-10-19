<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { getExercises, getFilters } from '../api.js'
import { computeDuration, formatDuration } from '../tabata-player.js'
import ExerciseModal from './ExerciseModal.vue'
import FilterPanel from './FilterPanel.vue'

const props = defineProps({
  initial: { type: Object, default: null },
})

const emit = defineEmits(['save', 'cancel'])

const defaults = { prepare: 10, work: 20, rest: 10, rounds: 8, restBetween: 0 }

const name = ref(props.initial?.name || '')
const params = reactive({ ...defaults, ...(props.initial?.params || {}) })
const exercises = ref(
  (props.initial?.exercises || []).map((ex) => ({
    id: ex.id,
    name: ex.name,
    nameRu: ex.nameRu,
    categoryLabel: ex.categoryLabel,
    thumbnail: ex.thumbnail,
    imageUrls: ex.imageUrls,
    rounds: ex.rounds ?? null,
  })),
)

const search = ref('')
const selection = reactive({ muscle: '', equipment: '', level: '', force: '', mechanic: '', category: '' })
const filters = ref({ muscles: [], equipment: [], levels: [], forces: [], mechanics: [], categories: [] })
const results = ref([])
const searching = ref(false)
const loadingMore = ref(false)
const total = ref(0)
const error = ref('')
const showFilters = ref(false)
const modalId = ref(null)
const listEl = ref(null)

const PAGE_SIZE = 12

const duration = computed(() => computeDuration(params, exercises.value))
const canSave = computed(() => name.value.trim().length > 0 && exercises.value.length > 0)
const activeFilterCount = computed(() => Object.values(selection).filter(Boolean).length)
const hasMore = computed(() => results.value.length < total.value)

let debounce = null

async function runSearch() {
  searching.value = true
  try {
    const data = await getExercises({ ...selection, q: search.value.trim(), page: 1, pageSize: PAGE_SIZE })
    results.value = data.items
    total.value = data.total
    nextTick(() => {
      if (listEl.value) listEl.value.scrollTop = 0
    })
  } catch (e) {
    error.value = e.message
  } finally {
    searching.value = false
  }
}

async function loadMore() {
  if (searching.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  const nextPage = Math.floor(results.value.length / PAGE_SIZE) + 1
  try {
    const data = await getExercises({ ...selection, q: search.value.trim(), page: nextPage, pageSize: PAGE_SIZE })
    results.value.push(...data.items)
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    loadingMore.value = false
  }
}

function onListScroll(event) {
  const el = event.target
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) loadMore()
}

function openExercise(id) {
  modalId.value = id
}

function toBuilderExercise(exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    nameRu: exercise.nameRu ?? null,
    categoryLabel: exercise.categoryLabel ?? null,
    thumbnail: exercise.thumbnail ?? exercise.imageUrls?.[0] ?? null,
    imageUrls: exercise.imageUrls ?? null,
    rounds: null,
  }
}

watch(
  [search, selection],
  () => {
    clearTimeout(debounce)
    debounce = setTimeout(runSearch, 250)
  },
  { deep: true },
)

function resetFilters() {
  Object.assign(selection, { muscle: '', equipment: '', level: '', force: '', mechanic: '', category: '' })
}

function add(exercise) {
  if (exercises.value.some((ex) => ex.id === exercise.id)) return
  exercises.value.push(toBuilderExercise(exercise))
}

function addFromModal(exercise) {
  add(exercise)
  modalId.value = null
}

function remove(index) {
  exercises.value.splice(index, 1)
}

function move(index, delta) {
  const target = index + delta
  if (target < 0 || target >= exercises.value.length) return
  const [item] = exercises.value.splice(index, 1)
  exercises.value.splice(target, 0, item)
}

function save() {
  if (!canSave.value) return
  emit('save', {
    name: name.value.trim(),
    params: {
      prepare: Number(params.prepare),
      work: Number(params.work),
      rest: Number(params.rest),
      rounds: Number(params.rounds),
      restBetween: Number(params.restBetween),
    },
    exercises: exercises.value.map((ex) => ({
      id: ex.id,
      rounds: ex.rounds === '' || ex.rounds == null ? null : Number(ex.rounds),
    })),
  })
}

onMounted(async () => {
  try {
    filters.value = await getFilters()
  } catch (e) {
    error.value = e.message
  }
  await runSearch()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ initial ? 'Редактирование табаты' : 'Новая табата' }}</h2>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-slate-500">{{ formatDuration(duration) }}</span>
          <button class="text-slate-500 hover:text-slate-700" @click="emit('cancel')">Отмена</button>
          <button
            class="bg-emerald-600 text-white rounded-md px-4 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
            :disabled="!canSave"
            @click="save"
          >
            Сохранить
          </button>
        </div>
      </div>

      <label class="flex flex-col gap-1">
        <span class="text-xs uppercase tracking-wide text-slate-500">Название</span>
        <input
          v-model="name"
          type="text"
          maxlength="80"
          placeholder="Например: Утренняя табата"
          class="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </label>

      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-slate-500">Подготовка, с</span>
          <input v-model.number="params.prepare" type="number" min="0" max="60" class="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-slate-500">Работа, с</span>
          <input v-model.number="params.work" type="number" min="5" max="600" class="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-slate-500">Отдых, с</span>
          <input v-model.number="params.rest" type="number" min="0" max="300" class="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-slate-500">Раундов</span>
          <input v-model.number="params.rounds" type="number" min="1" max="20" class="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-slate-500">Отдых между, с</span>
          <input v-model.number="params.restBetween" type="number" min="0" max="300" class="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </label>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
      <section class="flex flex-col gap-3">
        <div class="relative">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="shrink-0 border border-slate-300 bg-white rounded-md px-3 py-2 text-sm hover:bg-slate-50"
              :aria-expanded="showFilters"
              @click="showFilters = !showFilters"
            >
              Фильтры<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span>
              <span class="ml-1 text-slate-400">{{ showFilters ? '▲' : '▼' }}</span>
            </button>
            <input
              v-model="search"
              type="text"
              placeholder="Поиск упражнений"
              class="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div v-if="showFilters" class="fixed inset-0 z-20" @click="showFilters = false"></div>
          <div v-if="showFilters" class="absolute z-30 left-0 right-0 top-full mt-2">
            <FilterPanel
              class="shadow-xl"
              :filters="filters"
              :model-value="selection"
              @update:model-value="Object.assign(selection, $event)"
              @reset="resetFilters"
            />
          </div>
        </div>

        <div
          ref="listEl"
          class="flex flex-col gap-2 max-h-[420px] overflow-y-auto [scrollbar-gutter:stable]"
          @scroll="onListScroll"
        >
          <p v-if="searching" class="text-xs text-slate-400">Поиск…</p>
          <div
            v-for="item in results"
            :key="item.id"
            class="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-2 cursor-pointer hover:bg-slate-50"
            @click="openExercise(item.id)"
          >
            <img v-if="item.thumbnail" :src="item.thumbnail" :alt="item.name" class="w-10 h-10 object-cover rounded" />
            <div class="min-w-0 flex-1">
              <p class="text-sm truncate">{{ item.nameRu || item.name }}</p>
              <p class="text-xs text-slate-400 truncate">{{ item.primaryMusclesLabels.join(', ') }} · {{ item.levelLabel }}</p>
            </div>
            <button class="text-xs text-emerald-600 hover:underline shrink-0" @click.stop="add(item)">Добавить</button>
          </div>
          <p v-if="loadingMore" class="text-xs text-slate-400 text-center py-1">Загрузка…</p>
          <p v-else-if="!searching && !results.length" class="text-xs text-slate-400">Ничего не найдено.</p>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-slate-600">Состав табаты ({{ exercises.length }})</h3>
        <p v-if="!exercises.length" class="text-xs text-slate-400">Добавьте упражнения из списка слева.</p>
        <div
          v-for="(ex, i) in exercises"
          :key="`${ex.id}-${i}`"
          class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2"
        >
          <span class="text-xs text-slate-400 w-5 text-center">{{ i + 1 }}</span>
          <img v-if="ex.thumbnail" :src="ex.thumbnail" :alt="ex.name" class="w-9 h-9 object-cover rounded" />
          <div class="min-w-0 flex-1">
            <p class="text-sm truncate">{{ ex.nameRu || ex.name }}</p>
            <p v-if="ex.categoryLabel" class="text-xs text-slate-400 truncate">{{ ex.categoryLabel }}</p>
          </div>
          <input
            v-model.number="ex.rounds"
            type="number"
            min="1"
            max="20"
            :placeholder="String(params.rounds)"
            title="Раундов (пусто — как в общих настройках)"
            class="w-16 border border-slate-300 rounded-md px-2 py-1 text-xs"
          />
          <button class="text-slate-400 hover:text-slate-700 px-1" title="Выше" @click="move(i, -1)">↑</button>
          <button class="text-slate-400 hover:text-slate-700 px-1" title="Ниже" @click="move(i, 1)">↓</button>
          <button class="text-slate-400 hover:text-red-500 px-1" title="Удалить" @click="remove(i)">×</button>
        </div>
      </section>
    </div>
    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>

    <ExerciseModal v-if="modalId" :id="modalId" @close="modalId = null" @add="addFromModal" />
  </div>
</template>
