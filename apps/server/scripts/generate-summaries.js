import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadExercises } from '@gpower/catalog-core'
import { config } from '../src/config.js'

const OUT_DIR = path.join(config.dataAugDir, 'summaries')
mkdirSync(OUT_DIR, { recursive: true })

const only = process.argv.slice(2)
const exercises = loadExercises().filter((e) => !only.length || only.includes(e.id))

const SYSTEM = `Ты методист по силовым тренировкам. По данным об упражнении составь краткое обогащённое описание на русском и английском языках.
Верни СТРОГО JSON вида {"ru": "...", "en": "..."}.
Каждое значение — 3-5 предложений: цель упражнения, ключевые моменты техники, частые ошибки, возможные альтернативы. Без markdown, без списков.`

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

function extractJson(text) {
  const objects = extractObjects(text)
  if (!objects.length) throw new Error('no JSON object in response')
  return Object.assign({}, ...objects)
}

async function summarize(ex) {
  const user = `name: ${ex.name}
equipment: ${ex.equipment ?? 'n/a'}
level: ${ex.level}
category: ${ex.category}
primaryMuscles: ${ex.primaryMuscles.join(', ')}
secondaryMuscles: ${ex.secondaryMuscles.join(', ') || 'n/a'}
instructions: ${(ex.instructions || []).join(' ')}`

  const res = await fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.llmModel,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  })
  if (!res.ok) throw new Error(`llm ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const parsed = extractJson(data.choices[0].message.content)
  if (typeof parsed.ru !== 'string' || typeof parsed.en !== 'string') {
    throw new Error('response missing ru/en strings')
  }
  return { id: ex.id, name: ex.name, ru: parsed.ru, en: parsed.en }
}

if (!config.apiKey) {
  console.error('DEEPSEEK_API_KEY не задан в .env — генерация невозможна.')
  process.exit(1)
}

const CONCURRENCY = Number(process.env.SUMMARY_CONCURRENCY || 3)
const queue = exercises.filter((ex) => !existsSync(path.join(OUT_DIR, `${ex.id}.json`)))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function summarizeWithRetry(ex, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await summarize(ex)
    } catch (error) {
      lastError = error
      await sleep(1000 * attempt + Math.floor(Math.random() * 500))
    }
  }
  throw lastError
}

let done = 0
let failed = 0
let cursor = 0

async function worker() {
  while (cursor < queue.length) {
    const ex = queue[cursor++]
    try {
      const summary = await summarizeWithRetry(ex)
      writeFileSync(path.join(OUT_DIR, `${ex.id}.json`), JSON.stringify(summary, null, 2), 'utf8')
      done++
      if (done % 25 === 0) console.log(`[summaries] generated ${done}/${queue.length}`)
    } catch (error) {
      failed++
      console.error(`[summaries] failed ${ex.id}: ${error.message}`)
    }
  }
}

console.log(`[summaries] ${queue.length} to generate, concurrency ${CONCURRENCY}`)
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

console.log(`[summaries] done: ${done}, skipped: ${exercises.length - queue.length}, failed: ${failed}`)
