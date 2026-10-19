<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { useImageRotator } from '../image-rotator.js'
import {
  PHASE_LABELS,
  formatClock,
  pausePlayer,
  player,
  restartPlayer,
  resumePlayer,
  skipExercise,
  exitPlayer,
} from '../tabata-player.js'

const emit = defineEmits(['exit'])

const segment = computed(() => player.segments[player.index] || null)
const phaseLabel = computed(() => (player.finished ? PHASE_LABELS.finished : segment.value ? PHASE_LABELS[segment.value.phase] : ''))
const exercise = computed(() => segment.value?.exercise || null)
const isWork = computed(() => segment.value?.phase === 'work')
const exerciseNumber = computed(() => (segment.value ? segment.value.exerciseIndex + 1 : 0))
const exerciseCount = computed(() => segment.value?.exerciseCount || player.tabata?.exercises.length || 0)
const roundLabel = computed(() => (segment.value?.round ? `Раунд ${segment.value.round} из ${segment.value.rounds}` : ''))

function imagesOf(ex) {
  if (!ex) return []
  if (ex.imageUrls?.length) return ex.imageUrls
  return ex.thumbnail ? [ex.thumbnail] : []
}

function preloadImages(urls) {
  for (const url of urls || []) {
    if (!url) continue
    const img = new Image()
    img.src = url
    if (img.decode) img.decode().catch(() => {})
  }
}

const exerciseImages = computed(() => imagesOf(exercise.value))

const nextExerciseImages = computed(() => {
  const current = segment.value
  if (!current) return []
  for (let i = player.index + 1; i < player.segments.length; i++) {
    const next = player.segments[i]
    if (next.phase === 'work' && next.exerciseIndex > current.exerciseIndex) return imagesOf(next.exercise)
  }
  return []
})

const { current: currentImage, play: playImages, pause: pauseImages } = useImageRotator(exerciseImages, 1000, false)

watch(() => player.running, (running) => (running ? playImages() : pauseImages()), { immediate: true })
watch(exerciseImages, () => {
  if (player.running) playImages()
})
watch(nextExerciseImages, preloadImages, { immediate: true })

const phaseProgress = computed(() => {
  if (!segment.value || !segment.value.duration) return 0
  return Math.min(100, Math.max(0, ((segment.value.duration - player.remaining) / segment.value.duration) * 100))
})

const totalDurationSec = computed(() => player.segments.reduce((sum, item) => sum + item.duration, 0))

const elapsedSec = computed(() => {
  let before = 0
  for (let i = 0; i < player.index; i++) before += player.segments[i].duration
  const current = player.segments[player.index]
  if (current) before += current.duration - player.remaining
  return before
})

const totalProgress = computed(() => {
  if (player.finished) return 100
  if (!totalDurationSec.value) return 0
  return Math.min(100, Math.max(0, Math.round((elapsedSec.value / totalDurationSec.value) * 100)))
})

const phaseTone = computed(() => {
  if (player.finished) return 'text-emerald-600'
  if (segment.value?.phase === 'work') return 'text-emerald-600'
  if (segment.value?.phase === 'prepare' || segment.value?.phase === 'restBetween') return 'text-sky-600'
  return 'text-amber-600'
})

function onExit() {
  exitPlayer()
  emit('exit')
}

onBeforeUnmount(pausePlayer)
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-xl p-5">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="flex flex-col gap-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">{{ player.tabata?.name }}</h2>
            <p class="text-xs text-slate-500">
              Упражнение {{ Math.min(exerciseNumber, exerciseCount) }} из {{ exerciseCount }}
              <span v-if="roundLabel"> · {{ roundLabel }}</span>
            </p>
          </div>
          <button class="text-sm text-slate-500 hover:text-red-500 shrink-0" @click="onExit">Выход</button>
        </div>

        <div class="flex flex-col items-center gap-2">
          <span class="text-6xl font-bold uppercase leading-none text-center" :class="phaseTone">{{ phaseLabel }}</span>
          <span class="text-6xl font-bold tabular-nums text-slate-900">{{ formatClock(player.remaining) }}</span>
          <div class="w-full h-1.5 bg-slate-100 rounded overflow-hidden">
            <div class="h-full bg-slate-300 transition-all" :style="{ width: `${phaseProgress}%` }"></div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Прогресс табаты</span>
            <span>{{ totalProgress }}%</span>
          </div>
          <div class="w-full h-2 bg-slate-100 rounded overflow-hidden">
            <div class="h-full bg-emerald-500 transition-all" :style="{ width: `${totalProgress}%` }"></div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-2">
          <button
            v-if="!player.finished"
            class="px-5 py-2 rounded-md text-sm font-medium text-white"
            :class="player.running ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'"
            @click="player.running ? pausePlayer() : resumePlayer()"
          >
            {{ player.running ? 'Пауза' : 'Продолжить' }}
          </button>
          <button
            v-if="!player.finished"
            class="px-5 py-2 rounded-md text-sm font-medium text-white bg-slate-400 hover:bg-slate-500"
            @click="skipExercise"
          >
            Следующее
          </button>
          <button class="px-5 py-2 rounded-md text-sm border border-slate-300 hover:bg-slate-50" @click="restartPlayer">
            {{ player.finished ? 'Заново' : 'Сброс' }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-3 justify-center">
        <div
          class="w-full min-h-[280px] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center"
          :class="{ grayscale: !player.running }"
        >
          <img
            v-if="isWork && currentImage"
            :src="currentImage"
            :alt="exercise?.name"
            class="max-h-[50vh] max-w-full object-contain mx-auto"
          />
          <svg
            v-else
            viewBox="0 0 240 240"
            fill="none"
            stroke="currentColor"
            stroke-width="11"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="w-40 h-40 text-slate-300"
            aria-hidden="true"
          >
            <circle cx="92" cy="56" r="16" />
            <path d="M92 72 L92 150" />
            <path d="M92 150 L154 150 L154 196" />
            <path d="M154 196 L174 196" />
            <path d="M92 96 Q132 108 148 132" />
          </svg>
        </div>
        <div v-if="exercise" class="text-center">
          <p class="text-xl font-semibold leading-snug">{{ exercise.nameRu || exercise.name }}</p>
          <p v-if="exercise.nameRu" class="text-sm text-slate-400">{{ exercise.name }}</p>
        </div>
        <p v-else class="text-center text-sm text-slate-400">Приготовьтесь…</p>
      </div>
    </div>
  </div>
</template>
