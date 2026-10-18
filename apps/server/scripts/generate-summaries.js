import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadExercises } from '@gpower/catalog-core'
import { config } from '../src/config.js'
import { chatJson, runPool, withRetry } from './lib/llm.js'

const OUT_DIR = path.join(config.dataAugDir, 'summaries')
mkdirSync(OUT_DIR, { recursive: true })

const only = process.argv.slice(2)
const exercises = loadExercises().filter((e) => !only.length || only.includes(e.id))

const SYSTEM = `Ты методист по силовым тренировкам. По данным об упражнении составь краткое обогащённое описание на русском и английском языках.
Верни СТРОГО JSON вида {"ru": "...", "en": "..."}.
Каждое значение — 3-5 предложений: цель упражнения, ключевые моменты техники, частые ошибки, возможные альтернативы. Без markdown, без списков.`

async function summarize(ex) {
  const user = `name: ${ex.name}
equipment: ${ex.equipment ?? 'n/a'}
level: ${ex.level}
category: ${ex.category}
primaryMuscles: ${ex.primaryMuscles.join(', ')}
secondaryMuscles: ${ex.secondaryMuscles.join(', ') || 'n/a'}
instructions: ${(ex.instructions || []).join(' ')}`

  const parsed = await chatJson({ system: SYSTEM, user, temperature: 0.4 })
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

let done = 0
let failed = 0

console.log(`[summaries] ${queue.length} to generate, concurrency ${CONCURRENCY}`)
await runPool(queue, CONCURRENCY, async (ex) => {
  try {
    const summary = await withRetry(() => summarize(ex))
    writeFileSync(path.join(OUT_DIR, `${ex.id}.json`), JSON.stringify(summary, null, 2), 'utf8')
    done++
    if (done % 25 === 0) console.log(`[summaries] generated ${done}/${queue.length}`)
  } catch (error) {
    failed++
    console.error(`[summaries] failed ${ex.id}: ${error.message}`)
  }
})

console.log(`[summaries] done: ${done}, skipped: ${exercises.length - queue.length}, failed: ${failed}`)
