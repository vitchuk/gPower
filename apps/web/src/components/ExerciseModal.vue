<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getExercise } from '../api.js'
import ExerciseDetail from './ExerciseDetail.vue'

const props = defineProps({
  id: { type: String, required: true },
})

const emit = defineEmits(['close', 'add'])

const exercise = ref(null)
const error = ref('')

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    exercise.value = await getExercise(props.id)
  } catch (e) {
    error.value = 'Упражнение не найдено'
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-3xl bg-white rounded-xl shadow-xl mt-6 mb-6">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 class="font-semibold truncate">{{ exercise ? exercise.nameRu || exercise.name : 'Загрузка…' }}</h2>
        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="exercise"
            type="button"
            class="text-sm bg-emerald-600 text-white rounded-md px-3 py-1.5 hover:bg-emerald-700"
            @click="emit('add', exercise)"
          >
            Добавить в табату
          </button>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Закрыть"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
      </div>
      <div class="p-5">
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <ExerciseDetail v-else-if="exercise" :exercise="exercise" />
      </div>
    </div>
  </div>
</template>
