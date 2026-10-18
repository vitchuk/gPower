import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// packages/catalog-core/src -> repo root -> free-exercise-db clone
export const ROOT_DIR = path.resolve(__dirname, '../../..')
export const DATASET_DIR = path.join(ROOT_DIR, 'free-exercise-db')
export const EXERCISES_DIR = path.join(DATASET_DIR, 'exercises')
export const EXERCISES_JSON = path.join(DATASET_DIR, 'dist', 'exercises.json')
export const SUMMARIES_DIR = path.join(ROOT_DIR, 'data-aug', 'summaries')

let cache = null

export function loadExercises() {
  if (!cache) {
    cache = JSON.parse(readFileSync(EXERCISES_JSON, 'utf8'))
  }
  return cache
}

export function findExercise(id) {
  return loadExercises().find((e) => e.id === id) ?? null
}

const summaryCache = new Map()

export function readSummary(id) {
  if (summaryCache.has(id)) return summaryCache.get(id)
  let value = null
  const file = path.join(SUMMARIES_DIR, `${id}.json`)
  if (existsSync(file)) {
    try {
      value = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      value = null
    }
  }
  summaryCache.set(id, value)
  return value
}
