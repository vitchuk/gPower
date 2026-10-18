import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadExercises } from '@gpower/catalog-core'
import { config } from '../src/config.js'
import { chatJson, runPool, withRetry } from './lib/llm.js'

const OUT_DIR = path.join(config.dataAugDir, 'translations')
mkdirSync(OUT_DIR, { recursive: true })

const only = process.argv.slice(2)
const exercises = loadExercises().filter((e) => !only.length || only.includes(e.id))

const SYSTEM = `Ты переводчик фитнес-контента на русский язык. Переведи название упражнения и каждый шаг техники.
Верни СТРОГО JSON вида {"nameRu": "...", "instructionsRu": ["...", "..."]}.
Требования: естественная русская фитнес-терминология ("жим лёжа", "тяга в наклоне", "разведения"), а не транслитерация; число элементов instructionsRu строго равно числу исходных шагов; без markdown и без нумерации внутри шагов.`

const repairSystem = (count) => `Ты редактор перевода на русский. У тебя есть исходные шаги техники и русский перевод с другим числом шагов.
Приведи число русских шагов РОВНО к ${count}: раздели объединённые шаги или объедини лишние, не теряя смысла и не добавляя нового.
Верни СТРОГО JSON вида {"nameRu": "...", "instructionsRu": ["...", ...]} с ${count} элементами, без markdown.`

const asString = (value) => (typeof value === 'string' ? value.trim() : '')
const asSteps = (value) =>
  Array.isArray(value) ? value.map((step) => String(step).trim()).filter(Boolean) : []

function requestUser(ex, steps) {
  return `name: ${ex.name}
equipment: ${ex.equipment ?? 'n/a'}
level: ${ex.level}
primaryMuscles: ${ex.primaryMuscles.join(', ')}
instructions:
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`
}

function repairUser(steps, translated) {
  return `Исходные шаги (${steps.length}):
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Текущий перевод (${translated.length}):
${translated.map((step, i) => `${i + 1}. ${step}`).join('\n')}`
}

async function translate(ex) {
  const steps = ex.instructions || []
  const parsed = await chatJson({ system: SYSTEM, user: requestUser(ex, steps), temperature: 0.3 })
  let nameRu = asString(parsed.nameRu)
  let instructionsRu = asSteps(parsed.instructionsRu)

  if (steps.length > 0 && instructionsRu.length !== steps.length) {
    const fixed = await chatJson({
      system: repairSystem(steps.length),
      user: repairUser(steps, instructionsRu),
      temperature: 0.2,
    })
    nameRu = asString(fixed.nameRu) || nameRu
    instructionsRu = asSteps(fixed.instructionsRu)
  }

  if (!nameRu) throw new Error('response missing nameRu')
  if (steps.length === 0) {
    return { id: ex.id, name: ex.name, nameRu, instructionsRu: [] }
  }
  if (instructionsRu.length !== steps.length) {
    throw new Error(`steps mismatch: got ${instructionsRu.length}, want ${steps.length}`)
  }
  return { id: ex.id, name: ex.name, nameRu, instructionsRu }
}

if (!config.apiKey) {
  console.error('DEEPSEEK_API_KEY не задан в .env — перевод невозможен.')
  process.exit(1)
}

const CONCURRENCY = Number(
  process.env.TRANSLATIONS_CONCURRENCY || process.env.SUMMARY_CONCURRENCY || 3,
)
const queue = exercises.filter((ex) => !existsSync(path.join(OUT_DIR, `${ex.id}.json`)))

let done = 0
let failed = 0

console.log(`[translations] ${queue.length} to translate, concurrency ${CONCURRENCY}`)
await runPool(queue, CONCURRENCY, async (ex) => {
  try {
    const translation = await withRetry(() => translate(ex))
    writeFileSync(path.join(OUT_DIR, `${ex.id}.json`), JSON.stringify(translation, null, 2), 'utf8')
    done++
    if (done % 25 === 0) console.log(`[translations] done ${done}/${queue.length}`)
  } catch (error) {
    failed++
    console.error(`[translations] failed ${ex.id}: ${error.message}`)
  }
})

console.log(`[translations] done: ${done}, skipped: ${exercises.length - queue.length}, failed: ${failed}`)
