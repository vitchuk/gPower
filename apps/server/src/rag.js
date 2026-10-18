import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { loadExercises, toListItem } from '@gpower/catalog-core'
import { config } from './config.js'
import { db } from './db.js'

export async function embed(input) {
  const res = await fetch(`${config.ollamaBaseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.embeddingModel, input }),
  })
  if (!res.ok) throw new Error(`ollama embed failed: ${res.status}`)
  const json = await res.json()
  return json.embeddings
}

export function readSummary(id) {
  const file = path.join(config.dataAugDir, 'summaries', `${id}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function exerciseDoc(ex) {
  return [
    ex.name,
    `Category: ${ex.category}`,
    `Equipment: ${ex.equipment ?? 'n/a'}`,
    `Level: ${ex.level}`,
    `Primary muscles: ${ex.primaryMuscles.join(', ')}`,
    `Secondary muscles: ${ex.secondaryMuscles.join(', ') || 'n/a'}`,
    '',
    ...(ex.instructions || []),
  ].join('\n')
}

export function buildDocs() {
  const docs = []
  for (const ex of loadExercises()) {
    docs.push({ exercise_id: ex.id, lang: 'en', kind: 'exercise', text: exerciseDoc(ex) })
    const summary = readSummary(ex.id)
    if (summary?.ru) docs.push({ exercise_id: ex.id, lang: 'ru', kind: 'summary', text: summary.ru })
    if (summary?.en) docs.push({ exercise_id: ex.id, lang: 'en', kind: 'summary', text: summary.en })
  }
  return docs
}

export async function buildIndex() {
  const docs = buildDocs()
  db.exec('DELETE FROM vec_docs;')
  db.exec('DELETE FROM docs;')

  const insertDoc = db.prepare('INSERT INTO docs (exercise_id, lang, kind, text) VALUES (?, ?, ?, ?)')
  const insertVec = db.prepare('INSERT INTO vec_docs (doc_id, embedding) VALUES (?, ?)')

  const BATCH = 32
  let count = 0
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH)
    const vectors = await embed(batch.map((d) => d.text))
    batch.forEach((doc, idx) => {
      const info = insertDoc.run(doc.exercise_id, doc.lang, doc.kind, doc.text)
      const buffer = Buffer.from(new Float32Array(vectors[idx]).buffer)
      insertVec.run(BigInt(info.lastInsertRowid), buffer)
      count++
    })
  }
  return count
}

export function indexCount() {
  return db.prepare('SELECT COUNT(*) AS c FROM docs').get().c
}

export async function search(query, limit = 6) {
  const [vector] = await embed([query])
  const buffer = Buffer.from(new Float32Array(vector).buffer)

  const vectorRows = db
    .prepare('SELECT doc_id, distance FROM vec_docs WHERE embedding MATCH ? ORDER BY distance LIMIT ?')
    .all(buffer, limit * 3)

  const getDoc = db.prepare('SELECT id, exercise_id, lang, kind, text FROM docs WHERE id = ?')
  const scored = new Map()

  for (const row of vectorRows) {
    const doc = getDoc.get(row.doc_id)
    if (!doc) continue
    scored.set(doc.id, { ...doc, score: 1 / (1 + row.distance), vector: true, keyword: false })
  }

  const keywordRows = db
    .prepare('SELECT id, exercise_id, lang, kind, text FROM docs WHERE text LIKE ? LIMIT ?')
    .all(`%${query}%`, limit * 3)
  for (const doc of keywordRows) {
    const existing = scored.get(doc.id)
    if (existing) {
      existing.keyword = true
      existing.score += 0.5
    } else {
      scored.set(doc.id, { ...doc, score: 0.5, vector: false, keyword: true })
    }
  }

  const merged = [...scored.values()].sort((a, b) => b.score - a.score)

  const byExercise = new Map()
  for (const doc of merged) {
    if (!byExercise.has(doc.exercise_id)) byExercise.set(doc.exercise_id, doc)
  }
  return [...byExercise.values()].slice(0, limit)
}

export function toCards(exerciseIds) {
  const exercises = loadExercises()
  return exerciseIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter(Boolean)
    .map(toListItem)
}
