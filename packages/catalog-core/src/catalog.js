import { labelFor } from './dictionary.js'
import { queryGroups, scoreQuery } from './search.js'

export const imageUrl = (file) => `/images/${file}`

export function toListItem(ex) {
  return {
    id: ex.id,
    name: ex.name,
    level: ex.level,
    levelLabel: labelFor('level', ex.level),
    mechanic: ex.mechanic,
    equipment: ex.equipment,
    equipmentLabel: labelFor('equipment', ex.equipment),
    force: ex.force,
    category: ex.category,
    categoryLabel: labelFor('category', ex.category),
    primaryMuscles: ex.primaryMuscles,
    primaryMusclesLabels: ex.primaryMuscles.map((m) => labelFor('muscle', m)),
    thumbnail: ex.images && ex.images.length ? imageUrl(ex.images[0]) : null,
  }
}

export function toDetail(ex) {
  return {
    ...ex,
    levelLabel: labelFor('level', ex.level),
    categoryLabel: labelFor('category', ex.category),
    equipmentLabel: labelFor('equipment', ex.equipment),
    forceLabel: labelFor('force', ex.force),
    mechanicLabel: labelFor('mechanic', ex.mechanic),
    primaryMusclesLabels: ex.primaryMuscles.map((m) => labelFor('muscle', m)),
    secondaryMusclesLabels: ex.secondaryMuscles.map((m) => labelFor('muscle', m)),
    imageUrls: (ex.images || []).map(imageUrl),
  }
}

export function filterExercises(exercises, query) {
  const groups = query.q ? queryGroups(query.q) : []

  const structured = exercises.filter((ex) => {
    if (query.muscle && !ex.primaryMuscles.includes(query.muscle)) return false
    if (query.equipment && ex.equipment !== query.equipment) return false
    if (query.level && ex.level !== query.level) return false
    if (query.force && ex.force !== query.force) return false
    if (query.mechanic && ex.mechanic !== query.mechanic) return false
    if (query.category && ex.category !== query.category) return false
    return true
  })

  if (!groups.length) return structured

  return structured
    .map((ex) => ({ ex, result: scoreQuery(ex, groups) }))
    .filter((entry) => entry.result.matched)
    .sort((a, b) => b.result.score - a.result.score)
    .map((entry) => entry.ex)
}

export function buildFilters(exercises) {
  const distinct = (fn) => [...new Set(exercises.map(fn).filter((v) => v != null))].sort()
  const muscles = [...new Set(exercises.flatMap((e) => e.primaryMuscles))].sort()

  return {
    total: exercises.length,
    muscles: muscles.map((v) => ({ value: v, label: labelFor('muscle', v) })),
    equipment: distinct((e) => e.equipment).map((v) => ({ value: v, label: labelFor('equipment', v) })),
    levels: distinct((e) => e.level).map((v) => ({ value: v, label: labelFor('level', v) })),
    forces: distinct((e) => e.force).map((v) => ({ value: v, label: labelFor('force', v) })),
    mechanics: distinct((e) => e.mechanic).map((v) => ({ value: v, label: labelFor('mechanic', v) })),
    categories: distinct((e) => e.category).map((v) => ({ value: v, label: labelFor('category', v) })),
  }
}
