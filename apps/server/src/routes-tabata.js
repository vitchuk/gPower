import { requireUser } from './auth.js'
import {
  deleteTabata,
  getTabata,
  listTabatas,
  saveTabata,
  updateTabata,
  validateTabata,
} from './tabata.js'

export async function registerTabataRoutes(app) {
  app.get('/api/tabatas', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    return { tabatas: listTabatas(user.id) }
  })

  app.post('/api/tabatas', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const validation = validateTabata(req.body || {})
    if (validation.error) return reply.code(400).send({ error: 'invalid', detail: validation.error })
    return { tabata: saveTabata(user.id, validation.value) }
  })

  app.get('/api/tabatas/:id', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const tabata = getTabata(Number(req.params.id), user.id)
    if (!tabata) return reply.code(404).send({ error: 'not_found' })
    return tabata
  })

  app.put('/api/tabatas/:id', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const id = Number(req.params.id)
    if (!getTabata(id, user.id)) return reply.code(404).send({ error: 'not_found' })
    const validation = validateTabata(req.body || {})
    if (validation.error) return reply.code(400).send({ error: 'invalid', detail: validation.error })
    return { tabata: updateTabata(id, user.id, validation.value) }
  })

  app.delete('/api/tabatas/:id', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    if (!deleteTabata(Number(req.params.id), user.id)) return reply.code(404).send({ error: 'not_found' })
    return { ok: true }
  })
}
