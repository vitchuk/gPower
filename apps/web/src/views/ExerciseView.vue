<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getExercise } from '../api.js'

const props = defineProps({
  id: { type: String, required: true },
})

const exercise = ref(null)
const error = ref('')
const photoIndex = ref(0)

const steps = computed(() => {
  const current = exercise.value
  if (!current) return []
  return current.instructionsRu?.length ? current.instructionsRu : current.instructions || []
})

onMounted(async () => {
  try {
    exercise.value = await getExercise(props.id)
  } catch (e) {
    error.value = 'Упражнение не найдено'
  }
})
</script>

<template>
  <div>
    <RouterLink to="/" class="text-sm text-emerald-600 hover:underline">← В каталог</RouterLink>

    <p v-if="error" class="mt-4 text-red-600">{{ error }}</p>

    <article v-else-if="exercise" class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <div class="aspect-square bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
          <img
            v-if="exercise.imageUrls.length"
            :src="exercise.imageUrls[photoIndex]"
            :alt="exercise.name"
            class="w-full h-full object-contain"
          />
          <span v-else class="text-slate-400">нет фото</span>
        </div>
        <div v-if="exercise.imageUrls.length > 1" class="flex gap-2 mt-3">
          <button
            v-for="(url, i) in exercise.imageUrls"
            :key="url"
            class="w-16 h-16 rounded border-2 overflow-hidden"
            :class="i === photoIndex ? 'border-emerald-500' : 'border-transparent'"
            @click="photoIndex = i"
          >
            <img :src="url" class="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <h1 class="text-2xl font-bold">{{ exercise.nameRu || exercise.name }}</h1>
        <p v-if="exercise.nameRu" class="text-sm text-slate-500 -mt-2">{{ exercise.name }}</p>

        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div><dt class="text-slate-500">Уровень</dt><dd>{{ exercise.levelLabel }}</dd></div>
          <div><dt class="text-slate-500">Снаряжение</dt><dd>{{ exercise.equipmentLabel }}</dd></div>
          <div><dt class="text-slate-500">Усилие</dt><dd>{{ exercise.forceLabel }}</dd></div>
          <div><dt class="text-slate-500">Тип</dt><dd>{{ exercise.mechanicLabel }}</dd></div>
          <div><dt class="text-slate-500">Категория</dt><dd>{{ exercise.categoryLabel }}</dd></div>
          <div>
            <dt class="text-slate-500">Основные мышцы</dt>
            <dd>{{ exercise.primaryMusclesLabels.join(', ') }}</dd>
          </div>
          <div class="col-span-2">
            <dt class="text-slate-500">Вспомогательные мышцы</dt>
            <dd>{{ exercise.secondaryMusclesLabels.join(', ') || '—' }}</dd>
          </div>
        </dl>

        <div>
          <h2 class="font-semibold mb-2">Техника выполнения</h2>
          <ol v-if="steps.length" class="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
            <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
          </ol>
          <p v-else class="text-sm text-slate-500">Техника для этого упражнения не указана.</p>
        </div>
      </div>
    </article>

    <p v-else class="mt-4 text-slate-500">Загрузка…</p>
  </div>
</template>
