import { buildIndex, indexCount } from '../src/rag.js'

const started = Date.now()
const count = await buildIndex()
const seconds = ((Date.now() - started) / 1000).toFixed(1)
console.log(`[index] indexed ${count} docs in ${seconds}s (docs in db: ${indexCount()})`)
