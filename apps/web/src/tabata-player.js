import { reactive } from 'vue'

export const PHASE_LABELS = {
  prepare: 'Подготовка',
  work: 'Работа',
  rest: 'Отдых',
  restBetween: 'Отдых между упражнениями',
  finished: 'Готово',
}

export function computeDuration(params, exercises) {
  let total = params.prepare || 0
  exercises.forEach((ex, i) => {
    const rounds = ex.rounds || params.rounds
    total += rounds * ((params.work || 0) + (params.rest || 0))
    if (i < exercises.length - 1) total += params.restBetween || 0
  })
  return total
}

export function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  if (s < 60) return `${s} с`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return r ? `${m} мин ${r} с` : `${m} мин`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return mm ? `${h} ч ${mm} мин` : `${h} ч`
}

export const player = reactive({
  tabata: null,
  segments: [],
  index: 0,
  remaining: 0,
  running: false,
  finished: false,
})

let timer = null
let wakeLock = null
let audioCtx = null

function buildSegments(tabata) {
  const { params, exercises } = tabata
  const count = exercises.length
  const segments = []
  if (params.prepare > 0) {
    segments.push({ phase: 'prepare', duration: params.prepare, exercise: null, exerciseIndex: 0, exerciseCount: count })
  }
  exercises.forEach((ex, i) => {
    const rounds = ex.rounds || params.rounds
    for (let r = 1; r <= rounds; r++) {
      segments.push({ phase: 'work', duration: params.work, exercise: ex, round: r, rounds, exerciseIndex: i, exerciseCount: count })
      if (params.rest > 0) {
        segments.push({ phase: 'rest', duration: params.rest, exercise: ex, round: r, rounds, exerciseIndex: i, exerciseCount: count })
      }
    }
    if (i < count - 1 && params.restBetween > 0) {
      segments.push({ phase: 'restBetween', duration: params.restBetween, exercise: ex, exerciseIndex: i, exerciseCount: count })
    }
  })
  return segments
}

function getAudio() {
  if (audioCtx) return audioCtx
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  audioCtx = new Ctx()
  return audioCtx
}

function beep(freq = 880, duration = 0.12, gain = 0.12) {
  const ctx = getAudio()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume()
  const osc = ctx.createOscillator()
  const vol = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  vol.gain.value = gain
  osc.connect(vol).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return
  navigator.wakeLock
    .request('screen')
    .then((lock) => {
      wakeLock = lock
    })
    .catch(() => {})
}

function releaseWakeLock() {
  try {
    wakeLock?.release()
  } catch {
    /* ignore */
  }
  wakeLock = null
}

function ensureTimer() {
  if (timer) return
  timer = setInterval(tick, 1000)
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function advance() {
  if (player.index >= player.segments.length - 1) {
    finish()
    return
  }
  player.index += 1
  player.remaining = player.segments[player.index].duration
  beep(988, 0.2)
}

function tick() {
  if (!player.running || player.finished) return
  player.remaining -= 1
  if (player.remaining >= 1 && player.remaining <= 3) beep(660, 0.06, 0.08)
  if (player.remaining <= 0) advance()
}

function finish() {
  player.finished = true
  player.running = false
  player.remaining = 0
  stopTimer()
  releaseWakeLock()
  beep(784, 0.15)
  setTimeout(() => beep(988, 0.15), 200)
  setTimeout(() => beep(1319, 0.3), 400)
}

export function startPlayer(tabata) {
  const segments = buildSegments(tabata)
  if (!segments.length) return
  player.tabata = tabata
  player.segments = segments
  player.index = 0
  player.remaining = segments[0].duration
  player.finished = false
  player.running = true
  acquireWakeLock()
  ensureTimer()
  beep(988, 0.2)
}

export function pausePlayer() {
  player.running = false
  stopTimer()
  releaseWakeLock()
}

export function resumePlayer() {
  if (player.finished || !player.segments.length) return
  player.running = true
  acquireWakeLock()
  ensureTimer()
}

export function restartPlayer() {
  if (player.tabata) startPlayer(player.tabata)
}

// Пропуск текущего упражнения: прыжок на первое «work»-действие следующего упражнения
// (без остатка раундов и периода отдыха). В подготовке — пропуск подготовки.
export function skipExercise() {
  if (player.finished || !player.segments.length) return
  const current = player.segments[player.index]
  let target = -1

  if (current.phase === 'prepare') {
    target = player.segments.findIndex((s) => s.phase === 'work')
  } else {
    for (let i = player.index + 1; i < player.segments.length; i++) {
      const seg = player.segments[i]
      if (seg.phase === 'work' && seg.exerciseIndex > current.exerciseIndex) {
        target = i
        break
      }
    }
  }

  if (target === -1) {
    finish()
    return
  }

  player.index = target
  player.remaining = player.segments[target].duration
  beep(988, 0.2)
}

export function exitPlayer() {
  pausePlayer()
  player.tabata = null
  player.segments = []
  player.index = 0
  player.remaining = 0
  player.running = false
  player.finished = false
}
