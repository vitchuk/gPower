const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    ...options,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
  return data
}

export function getFilters() {
  return request('/filters')
}

export function getExercises(params = {}) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) qs.set(key, value)
  }
  return request(`/exercises?${qs.toString()}`)
}

export function getExercise(id) {
  return request(`/exercises/${encodeURIComponent(id)}`)
}

export function getMe() {
  return request('/auth/me')
}

export function login(username, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export function register(username, password) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export function logout() {
  return request('/auth/logout', { method: 'POST' })
}

export function listChats() {
  return request('/chats')
}

export function createChat() {
  return request('/chats', { method: 'POST' })
}

export function deleteChat(id) {
  return request(`/chats/${id}`, { method: 'DELETE' })
}

export function getMessages(id) {
  return request(`/chats/${id}/messages`)
}

export function listTabatas() {
  return request('/tabatas')
}

export function getTabata(id) {
  return request(`/tabatas/${id}`)
}

export function createTabata(payload) {
  return request('/tabatas', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateTabata(id, payload) {
  return request(`/tabatas/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function deleteTabata(id) {
  return request(`/tabatas/${id}`, { method: 'DELETE' })
}

async function readSse(res, onEvent) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue
        try {
          onEvent(JSON.parse(line.slice(5).trim()))
        } catch {
          /* ignore malformed */
        }
      }
    }
  }
}

async function streamRequest(path, body, onEvent) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  await readSse(res, onEvent)
}

export function streamChat(chatId, content, onEvent) {
  return streamRequest(`/chats/${chatId}/messages`, { content }, onEvent)
}

export function streamHelp(content, history, onEvent) {
  return streamRequest('/help', { content, history }, onEvent)
}
