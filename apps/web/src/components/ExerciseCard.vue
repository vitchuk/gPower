<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  exercise: { type: Object, required: true },
})
</script>

<template>
  <RouterLink
    :to="`/exercise/${exercise.id}`"
    class="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow"
  >
    <div class="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
      <img
        v-if="exercise.thumbnail"
        :src="exercise.thumbnail"
        :alt="exercise.name"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform"
      />
      <span v-else class="text-slate-400 text-sm">нет фото</span>
    </div>
    <div class="p-3 flex flex-col gap-2 flex-1">
      <h3 class="font-semibold leading-snug">{{ exercise.nameRu || exercise.name }}</h3>
      <p v-if="exercise.nameRu" class="text-xs text-slate-400 leading-snug">{{ exercise.name }}</p>
      <div class="flex flex-wrap gap-1 mt-auto">
        <span
          v-for="label in exercise.primaryMusclesLabels.slice(0, 3)"
          :key="label"
          class="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded"
        >
          {{ label }}
        </span>
        <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
          {{ exercise.equipmentLabel }}
        </span>
        <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
          {{ exercise.levelLabel }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
