import { requireUser } from './auth.js'
import { generateReply, runChat } from './chat.js'
import { db } from './db.js'
import { indexCount } from './rag.js'

function getOwnedChat(userId, id) {
  return (
    db
      .prepare('SELECT id, title FROM chats WHERE id = ? AND user_id = ?')
      .get(Number(id), userId) ?? null
  )
}

export async function registerChatRoutes(app) {
  app.get('/api/chats', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const chats = db
      .prepare('SELECT id, title, created_at FROM chats WHERE user_id = ? ORDER BY id DESC')
      .all(user.id)
    return { chats, index: indexCount() }
  })

  app.post('/api/chats', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const info = db.prepare('INSERT INTO chats (user_id) VALUES (?)').run(user.id)
    return { chat: { id: Number(info.lastInsertRowid), title: 'Новый чат' } }
  })

  app.delete('/api/chats/:id', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const chat = getOwnedChat(user.id, req.params.id)
    if (!chat) return reply.code(404).send({ error: 'not_found' })
    db.prepare('DELETE FROM chats WHERE id = ?').run(chat.id)
    return { ok: true }
  })

  app.get('/api/chats/:id/messages', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const chat = getOwnedChat(user.id, req.params.id)
    if (!chat) return reply.code(404).send({ error: 'not_found' })
    const rows = db
      .prepare('SELECT id, role, content, citations, created_at FROM messages WHERE chat_id = ? ORDER BY id')
      .all(chat.id)
    const messages = rows.map((r) => ({
      ...r,
      citations: r.citations ? JSON.parse(r.citations) : [],
    }))
    return { chat, messages }
  })

  app.post('/api/help', async (req, reply) => {
    const body = req.body || {}
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) return reply.code(400).send({ error: 'empty' })
    if (content.length > 2000) return reply.code(400).send({ error: 'too_long' })

    const history = (Array.isArray(body.history) ? body.history : [])
      .filter(
        (m) =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim(),
      )
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))

    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    const send = (obj) => raw.write(`data: ${JSON.stringify(obj)}\n\n`)

    try {
      const result = await generateReply({ history, content, send })
      if (result) {
        send({ type: 'citations', items: result.citations })
      }
    } catch (error) {
      send({ type: 'error', message: error.message })
    } finally {
      send({ type: 'done' })
      raw.end()
    }
  })

  app.post('/api/chats/:id/messages', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    const chat = getOwnedChat(user.id, req.params.id)
    if (!chat) return reply.code(404).send({ error: 'not_found' })

    const content = (req.body?.content || '').trim()
    if (!content) return reply.code(400).send({ error: 'empty' })

    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    const send = (obj) => raw.write(`data: ${JSON.stringify(obj)}\n\n`)

    try {
      await runChat({ chatId: chat.id, content, send })
    } catch (error) {
      send({ type: 'error', message: error.message })
      send({ type: 'done' })
    } finally {
      raw.end()
    }
  })
}
