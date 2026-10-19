import { findExercise, gifUrl, imageUrl, readMedia, toListItem } from '@gpower/catalog-core'
import { db } from './db.js'

export const LIMITS = {
  nameMax: 80,
  exercisesMin: 1,
  exercisesMax: 20,
  workMin: 5,
  workMax: 600,
  restMin: 0,
  restMax: 300,
  roundsMin: 1,
  roundsMax: 20,
  prepareMin: 0,
  prepareMax: 60,
  restBetweenMin: 0,
  restBetweenMax: 300,
}

function toInt(value) {
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

function inRange(value, min, max) {
  const n = toInt(value)
  return n !== null && n >= min && n <= max ? n : null
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

export function enrichExercise(id) {
  const ex = findExercise(id)
  if (!ex) return null
  const item = toListItem(ex)
  const media = readMedia(ex.id)
  return {
    id: ex.id,
    name: ex.name,
    nameRu: item.nameRu,
    category: item.category,
    categoryLabel: item.categoryLabel,
    thumbnail: item.thumbnail,
    imageUrls: (ex.images || []).map(imageUrl),
    gifUrl: media?.gif ? gifUrl(media.gif) : null,
  }
}

export function validateTabata(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > LIMITS.nameMax) return { error: 'invalid_name' }

  const raw = input?.params || {}
  const params = {
    prepare: inRange(raw.prepare, LIMITS.prepareMin, LIMITS.prepareMax),
    work: inRange(raw.work, LIMITS.workMin, LIMITS.workMax),
    rest: inRange(raw.rest, LIMITS.restMin, LIMITS.restMax),
    rounds: inRange(raw.rounds, LIMITS.roundsMin, LIMITS.roundsMax),
    restBetween: inRange(raw.restBetween, LIMITS.restBetweenMin, LIMITS.restBetweenMax),
  }
  if (Object.values(params).some((v) => v === null)) return { error: 'invalid_params' }

  const rawExercises = Array.isArray(input?.exercises) ? input.exercises : []
  if (rawExercises.length < LIMITS.exercisesMin || rawExercises.length > LIMITS.exercisesMax) {
    return { error: 'invalid_exercises_count' }
  }

  const exercises = []
  for (const item of rawExercises) {
    const id = typeof item?.id === 'string' ? item.id : item?.id != null ? String(item.id) : ''
    const enriched = enrichExercise(id)
    if (!enriched) return { error: `unknown_exercise:${id}` }
    let rounds = null
    if (item?.rounds != null && item.rounds !== '') {
      rounds = inRange(item.rounds, LIMITS.roundsMin, LIMITS.roundsMax)
      if (rounds === null) return { error: 'invalid_rounds' }
    }
    exercises.push({ ...enriched, rounds })
  }

  return { value: { name, params, exercises } }
}

function rowToTabata(row) {
  const params = JSON.parse(row.params)
  const exercises = JSON.parse(row.exercises).map((stored) => {
    const current = enrichExercise(stored.id)
    return current ? { ...current, rounds: stored.rounds ?? null } : stored
  })
  return {
    id: row.id,
    name: row.name,
    params,
    exercises,
    durationSec: computeDuration(params, exercises),
    created_at: row.created_at,
  }
}

export function saveTabata(userId, value) {
  const info = db
    .prepare('INSERT INTO tabatas (user_id, name, params, exercises) VALUES (?, ?, ?, ?)')
    .run(userId, value.name, JSON.stringify(value.params), JSON.stringify(value.exercises))
  return getTabata(Number(info.lastInsertRowid), userId)
}

export function updateTabata(id, userId, value) {
  db.prepare('UPDATE tabatas SET name = ?, params = ?, exercises = ? WHERE id = ? AND user_id = ?').run(
    value.name,
    JSON.stringify(value.params),
    JSON.stringify(value.exercises),
    id,
    userId,
  )
  return getTabata(id, userId)
}

export function getTabata(id, userId) {
  const row = db.prepare('SELECT * FROM tabatas WHERE id = ? AND user_id = ?').get(id, userId)
  return row ? rowToTabata(row) : null
}

export function listTabatas(userId) {
  return db
    .prepare('SELECT * FROM tabatas WHERE user_id = ? ORDER BY id DESC')
    .all(userId)
    .map(rowToTabata)
}

export function deleteTabata(id, userId) {
  return db.prepare('DELETE FROM tabatas WHERE id = ? AND user_id = ?').run(id, userId).changes > 0
}

// Agent tool: accepts flat second-based args (workSec/restSec/...), returns { tabata } or { error }.
export function createTabataFromAgent(userId, args = {}) {
  const validation = validateTabata({
    name: args.name,
    params: {
      prepare: args.prepareSec ?? 10,
      work: args.workSec ?? 20,
      rest: args.restSec ?? 10,
      rounds: args.rounds ?? 8,
      restBetween: args.restBetweenSec ?? 0,
    },
    exercises: (Array.isArray(args.exerciseIds) ? args.exerciseIds : []).map((id) => ({ id })),
  })
  if (validation.error) return { error: validation.error }
  return { tabata: saveTabata(userId, validation.value) }
}
