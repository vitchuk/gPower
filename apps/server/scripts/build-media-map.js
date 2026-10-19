import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadExercises, MEDIA_DATASET_DIR, MEDIA_DATASET_JSON, MEDIA_MAP_DIR } from '@gpower/catalog-core'

const SOURCE = 'hasaneyldrm/exercises-dataset'
const ATTRIBUTION = '© Gym visual — https://gymvisual.com/'
const OVERRIDES_FILE = path.join(MEDIA_MAP_DIR, 'overrides.json')

const args = process.argv.slice(2)
const write = args.includes('--write')
const reportPath = args.find((a) => a.startsWith('--report='))?.slice('--report='.length)

const tokens = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

const normKey = (value) => tokens(value).join('')
const tokenKey = (value) => tokens(value).sort().join(' ')

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared++
  return shared / (a.size + b.size - shared)
}

const ours = loadExercises()
const theirs = JSON.parse(readFileSync(MEDIA_DATASET_JSON, 'utf8'))

const byNorm = new Map()
const byTokens = new Map()
const entries = theirs.map((record) => ({ record, set: new Set(tokens(record.name)) }))
for (const entry of entries) {
  const n = normKey(entry.record.name)
  byNorm.set(n, [...(byNorm.get(n) ?? []), entry])
  const t = tokenKey(entry.record.name)
  byTokens.set(t, [...(byTokens.get(t) ?? []), entry])
}

const overrides = existsSync(OVERRIDES_FILE)
  ? JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'))
  : {}
const bySourceId = new Map(theirs.map((record) => [record.id, record]))

function classify(exercise) {
  const override = overrides[exercise.id]
  if (override === null) return { confidence: 'suppressed', score: 0 }
  if (typeof override === 'string') {
    const record = bySourceId.get(override)
    if (!record) return { confidence: 'bad-override', score: 0, override }
    return { record, confidence: 'override', score: 1 }
  }

  const exact = byNorm.get(normKey(exercise.name))
  if (exact?.length === 1) return { record: exact[0].record, confidence: 'exact', score: 1 }

  const tokenSet = byTokens.get(tokenKey(exercise.name))
  if (tokenSet?.length === 1) return { record: tokenSet[0].record, confidence: 'tokenset', score: 1 }

  const set = new Set(tokens(exercise.name))
  let best = 0
  let second = 0
  let bestEntry = null
  for (const entry of entries) {
    const score = jaccard(set, entry.set)
    if (score > best) {
      second = best
      best = score
      bestEntry = entry
    } else if (score > second) {
      second = score
    }
  }

  if (best >= 0.8 && second < 0.75) {
    return { record: bestEntry.record, confidence: 'fuzzy', score: best }
  }
  if (best >= 0.6) {
    return { record: bestEntry?.record, confidence: 'review', score: best }
  }
  return { record: bestEntry?.record, confidence: 'none', score: best }
}

const summary = {
  total: ours.length,
  exact: 0,
  tokenset: 0,
  fuzzy: 0,
  override: 0,
  review: 0,
  none: 0,
  suppressed: 0,
  badOverride: 0,
  missingFile: 0,
  usedSourceIds: 0,
}

const matched = []
const review = []
const unmatched = []

for (const exercise of ours) {
  const result = classify(exercise)

  if (result.confidence === 'suppressed') {
    summary.suppressed++
    continue
  }
  if (result.confidence === 'bad-override') {
    summary.badOverride++
    unmatched.push({
      id: exercise.id,
      name: exercise.name,
      confidence: result.confidence,
      candidateId: result.override ?? null,
    })
    continue
  }
  if (result.confidence === 'none') {
    summary.none++
    unmatched.push({
      id: exercise.id,
      name: exercise.name,
      confidence: result.confidence,
      candidateId: result.record?.id ?? null,
      candidateName: result.record?.name ?? null,
      score: Number(result.score?.toFixed(3)),
    })
    continue
  }
  if (result.confidence === 'review') {
    summary.review++
    review.push({
      id: exercise.id,
      name: exercise.name,
      confidence: result.confidence,
      candidateId: result.record?.id ?? null,
      candidateName: result.record?.name ?? null,
      score: Number(result.score?.toFixed(3)),
    })
    continue
  }

  summary[result.confidence]++
  const gifPath = path.join(MEDIA_DATASET_DIR, result.record.gif_url)
  const thumbPath = path.join(MEDIA_DATASET_DIR, result.record.image)
  const entry = {
    id: exercise.id,
    name: exercise.name,
    source: SOURCE,
    sourceId: result.record.id,
    sourceName: result.record.name,
    gif: result.record.gif_url,
    thumb: result.record.image,
    confidence: result.confidence,
    score: result.score,
  }
  if (!existsSync(gifPath)) {
    summary.missingFile++
    review.push({ ...entry, reason: 'gif file missing' })
    continue
  }
  if (!existsSync(thumbPath)) entry.thumb = null
  matched.push(entry)
}

summary.usedSourceIds = new Set(matched.map((entry) => entry.sourceId)).size

const pct = (n) => `${((n / ours.length) * 100).toFixed(1)}%`
console.log(`[media-map] ours: ${summary.total}, dataset records: ${theirs.length}`)
console.log(
  `[media-map] matched: ${matched.length} (${pct(matched.length)}) — exact ${summary.exact}, tokenset ${summary.tokenset}, fuzzy ${summary.fuzzy}, override ${summary.override}`,
)
console.log(
  `[media-map] review: ${summary.review}, unmatched: ${summary.none}, suppressed: ${summary.suppressed}, bad-override: ${summary.badOverride}, missing-file: ${summary.missingFile}`,
)
console.log(`[media-map] dataset records used: ${summary.usedSourceIds}/${theirs.length}`)

if (reportPath) {
  mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true })
  writeFileSync(
    path.resolve(reportPath),
    JSON.stringify({ summary, matched, review, unmatched }, null, 2),
    'utf8',
  )
  console.log(`[media-map] report written: ${path.resolve(reportPath)}`)
}

if (write) {
  mkdirSync(MEDIA_MAP_DIR, { recursive: true })
  for (const { confidence, score, ...entry } of matched) {
    writeFileSync(path.join(MEDIA_MAP_DIR, `${entry.id}.json`), JSON.stringify(entry, null, 2), 'utf8')
  }
  console.log(`[media-map] written: ${matched.length} files to ${MEDIA_MAP_DIR}`)
} else {
  console.log('[media-map] dry run — pass --write to emit data-aug/media/<id>.json')
}
