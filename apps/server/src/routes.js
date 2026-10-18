import { buildFilters, filterExercises, loadExercises, toDetail, toListItem } from '@gpower/catalog-core'

export async function registerCatalogRoutes(app) {
  const exercises = loadExercises()
  const filters = buildFilters(exercises)

  app.get('/api/health', async () => ({ status: 'ok', exercises: exercises.length }))

  app.get('/api/filters', async () => filters)

  app.get('/api/exercises', async (req) => {
    const query = req.query || {}
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 24))
    const filtered = filterExercises(exercises, query)
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize).map(toListItem)
    return { total: filtered.length, page, pageSize, items }
  })

  app.get('/api/exercises/:id', async (req, reply) => {
    const exercise = exercises.find((e) => e.id === req.params.id)
    if (!exercise) return reply.code(404).send({ error: 'not_found' })
    return toDetail(exercise)
  })
}
