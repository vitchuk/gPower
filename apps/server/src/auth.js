import crypto from 'node:crypto'
import { db } from './db.js'
import { config } from './config.js'

const COOKIE_NAME = 'gp_session'
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
    .toString('hex')
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`
}

export function verifyPassword(password, stored) {
  const [algo, N, r, p, salt, hash] = String(stored).split('$')
  if (algo !== 'scrypt') return false
  const expected = Buffer.from(hash, 'hex')
  const derived = crypto.scryptSync(password, salt, expected.length, { N: +N, r: +r, p: +p })
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived)
}

export function createUser(username, password) {
  const info = db
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, hashPassword(password))
  return Number(info.lastInsertRowid)
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) ?? null
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000).toISOString()
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt,
  )
  return token
}

export function getUserBySession(token) {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
    .get(token)
  return row ?? null
}

export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function getSessionToken(req) {
  return parseCookies(req.headers.cookie || '')[COOKIE_NAME] ?? null
}

export function setSessionCookie(reply, token) {
  const maxAge = config.sessionDays * 24 * 3600
  reply.header('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`)
}

export function clearSessionCookie(reply) {
  reply.header('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`)
}

export function requireUser(req, reply) {
  const user = getUserBySession(getSessionToken(req))
  if (!user) {
    reply.code(401).send({ error: 'unauthorized' })
    return null
  }
  return user
}
