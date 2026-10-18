import { config } from '../../src/config.js'

function extractObjects(text) {
  const source = String(text).replace(/^```[a-z]*\s*/i, '')
  const objects = []
  let cursor = 0
  while (cursor < source.length) {
    const start = source.indexOf('{', cursor)
    if (start < 0) break
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let i = start; i < source.length; i++) {
      const ch = source[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else if (ch === '"') {
        inString = true
      } else if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) break
    try {
      objects.push(JSON.parse(source.slice(start, end + 1)))
    } catch {
      /* skip malformed chunk */
    }
    cursor = end + 1
  }
  return objects
}

export function extractJson(text) {
  const objects = extractObjects(text)
  if (!objects.length) throw new Error('no JSON object in response')
  return Object.assign({}, ...objects)
}

export async function chatJson({ system, user, temperature = 0.3 }) {
  if (!config.apiKey) throw new Error('DEEPSEEK_API_KEY не задан в .env')
  const res = await fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.llmModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature,
    }),
  })
  if (!res.ok) throw new Error(`llm ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return extractJson(data.choices[0].message.content)
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withRetry(fn, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      await sleep(1000 * attempt + Math.floor(Math.random() * 500))
    }
  }
  throw lastError
}

export async function runPool(items, concurrency, worker) {
  let cursor = 0
  const run = async () => {
    while (cursor < items.length) {
      await worker(items[cursor++])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run))
}
