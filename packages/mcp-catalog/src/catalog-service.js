import {
  buildFilters,
  filterExercises,
  findExercise,
  loadExercises,
  toDetail,
  toListItem,
} from '@gpower/catalog-core'

export const tools = [
  {
    name: 'search_exercises',
    description:
      'Search the exercise catalog by free text and structured filters. Returns compact cards with id, name, equipment, level, muscles and category. Use the returned id with get_exercise for full details.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Free text over exercise name and instructions' },
        muscle: { type: 'string', description: 'Primary muscle, e.g. "chest", "lats", "biceps"' },
        equipment: { type: 'string', description: 'e.g. "barbell", "dumbbell", "body only", "cable"' },
        level: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
        category: { type: 'string', description: 'e.g. "strength", "stretching", "cardio"' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max results (default 10)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_exercise',
    description: 'Get a single exercise in full detail (instructions, muscles, equipment, image URLs).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Exercise id, e.g. "Air_Bike"' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_filters',
    description: 'List all available filter values (muscles, equipment, levels, forces, mechanics, categories) with Russian labels.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

export async function callTool(name, args = {}) {
  const exercises = loadExercises()

  if (name === 'get_filters') {
    return buildFilters(exercises)
  }

  if (name === 'search_exercises') {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 10))
    const filtered = filterExercises(exercises, args)
    return { total: filtered.length, items: filtered.slice(0, limit).map(toListItem) }
  }

  if (name === 'get_exercise') {
    const exercise = findExercise(args.id)
    if (!exercise) throw new Error(`exercise not found: ${args.id}`)
    return toDetail(exercise)
  }

  throw new Error(`unknown tool: ${name}`)
}
