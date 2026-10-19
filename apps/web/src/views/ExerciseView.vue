<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getExercise } from '../api.js'
import ExerciseDetail from '../components/ExerciseDetail.vue'

const props = defineProps({
  id: { type: String, required: true },
})

const exercise = ref(null)
const error = ref('')

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

    <ExerciseDetail v-else-if="exercise" :exercise="exercise" class="mt-4" />

    <p v-else class="mt-4 text-slate-500">Загрузка…</p>
  </div>
</template>
