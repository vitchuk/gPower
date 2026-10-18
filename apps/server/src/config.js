import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = path.resolve(__dirname, '../../..')

const envPath = path.join(ROOT_DIR, '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

const num = (value, fallback) => (value != null && value !== '' ? Number(value) : fallback)

export const config = {
  port: num(process.env.PORT, 3000),
  sessionDays: num(process.env.SESSION_DAYS, 30),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  embeddingModel: process.env.EMBEDDING_MODEL || 'qwen3-embedding:0.6b',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
  llmModel: process.env.LLM_MODEL || 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  mcpUrl: process.env.MCP_URL || 'http://localhost:3001/mcp',
  dataDir: path.join(ROOT_DIR, 'data'),
  dataAugDir: path.join(ROOT_DIR, 'data-aug'),
}
