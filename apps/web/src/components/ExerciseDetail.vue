<script setup>
import { computed } from 'vue'
import { useImageRotator } from '../image-rotator.js'

const props = defineProps({
  exercise: { type: Object, required: true },
})

const steps = computed(() => {
  const current = props.exercise
  if (!current) return []
  return current.instructionsRu?.length ? current.instructionsRu : current.instructions || []
})

const imageUrls = computed(() => props.exercise.imageUrls || [])
const {
  index: photoIndex,
  count: photoCount,
  current: currentPhoto,
  playing,
  advance,
  toggle,
} = useImageRotator(imageUrls, 1000, false)
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div>
      <div class="relative aspect-square bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
        <button
          v-if="photoCount"
          type="button"
          class="w-full h-full flex items-center justify-center"
          :class="photoCount > 1 ? 'cursor-pointer' : 'cursor-default'"
          :aria-label="photoCount > 1 ? 'Следующее изображение' : undefined"
          @click="advance"
        >
          <img :src="currentPhoto" :alt="exercise.name" class="w-full h-full object-contain" />
        </button>
        <span v-else class="text-slate-400">нет фото</span>
        <span
          v-if="photoCount > 1"
          class="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
        >
          {{ photoIndex + 1 }} / {{ photoCount }}
        </span>
        <button
          v-if="photoCount > 1"
          type="button"
          class="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
          :aria-label="playing ? 'Остановить автосмену' : 'Запустить автосмену'"
          :title="playing ? 'Пауза' : 'Play'"
          @click="toggle"
        >
          {{ playing ? '⏸' : '▶' }}
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
        <figure v-if="exercise.gifUrl" class="float-left mr-4 mb-2 w-[180px]">
          <img
            :src="exercise.gifUrl"
            :alt="`Анимация: ${exercise.name}`"
            width="180"
            height="180"
            loading="lazy"
            class="rounded-xl bg-slate-100"
          />
          <figcaption class="mt-1 text-xs text-slate-500">
            © Gym visual —
            <a href="https://gymvisual.com/" target="_blank" rel="noopener" class="underline">gymvisual.com</a>
          </figcaption>
        </figure>
        <ol v-if="steps.length" class="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
          <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
        </ol>
        <p v-else class="text-sm text-slate-500">Техника для этого упражнения не указана.</p>
        <div class="clear-both"></div>
      </div>
    </div>
  </div>
</template>
