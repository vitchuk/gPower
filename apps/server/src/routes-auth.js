import {
  clearSessionCookie,
  createSession,
  createUser,
  deleteSession,
  getSessionToken,
  getUserByUsername,
  requireUser,
  setSessionCookie,
  verifyPassword,
} from './auth.js'

export async function registerAuthRoutes(app) {
  app.post('/api/auth/register', async (req, reply) => {
    const { username, password } = req.body || {}
    if (!username || !password || username.length < 3 || password.length < 4) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Логин от 3 символов, пароль от 4' })
    }
    if (getUserByUsername(username)) {
      return reply.code(409).send({ error: 'username_taken', message: 'Логин занят' })
    }
    const id = createUser(username, password)
    setSessionCookie(reply, createSession(id))
    return { user: { id, username } }
  })

  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = req.body || {}
    const user = getUserByUsername(username || '')
    if (!user || !verifyPassword(password || '', user.password_hash)) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Неверный логин или пароль' })
    }
    setSessionCookie(reply, createSession(user.id))
    return { user: { id: user.id, username: user.username } }
  })

  app.post('/api/auth/logout', async (req, reply) => {
    deleteSession(getSessionToken(req))
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.get('/api/auth/me', async (req, reply) => {
    const user = requireUser(req, reply)
    if (!user) return
    return { user }
  })
}
