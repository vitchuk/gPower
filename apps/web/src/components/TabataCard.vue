<script setup>
import { computed } from 'vue'
import { computeDuration, formatDuration } from '../tabata-player.js'

const props = defineProps({
  tabata: { type: Object, required: true },
})

const duration = computed(() => props.tabata.durationSec || computeDuration(props.tabata.params, props.tabata.exercises))
</script>

<template>
  <div class="bg-white border border-emerald-200 rounded-xl p-3 flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <h3 class="font-semibold leading-snug">{{ tabata.name }}</h3>
      <span class="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded whitespace-nowrap">
        {{ formatDuration(duration) }}
      </span>
    </div>
    <p class="text-xs text-slate-500">
      {{ tabata.exercises.length }} упр. · {{ tabata.params.work }}с / {{ tabata.params.rest }}с ·
      {{ tabata.params.rounds }} раундов
    </p>
    <div class="flex flex-wrap gap-1">
      <span
        v-for="(ex, i) in tabata.exercises.slice(0, 6)"
        :key="`${ex.id}-${i}`"
        class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
      >
        {{ ex.nameRu || ex.name }}
      </span>
      <span v-if="tabata.exercises.length > 6" class="text-xs text-slate-400">
        +{{ tabata.exercises.length - 6 }}
      </span>
    </div>
    <slot />
  </div>
</template>
