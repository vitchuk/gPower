import { findExercise, toListItem } from '@gpower/catalog-core'
import { config } from './config.js'
import { db } from './db.js'
import { parseToolResult, toOpenAiTools, withMcp } from './mcp-client.js'
import { search } from './rag.js'
import { createTabataFromAgent } from './tabata.js'

const SYSTEM_PROMPT = `Ты — дружелюбный универсальный ассистент приложения gPower. Будь вежлив и помогай с любыми вопросами: о фитнесе и тренировках, о работе приложения, о любых других темах.

Язык: отвечай по-русски; если пользователь пишет на другом языке — отвечай на его языке.

Фитнес и упражнения:
- используй инструменты каталога (search_exercises, get_exercise, get_filters) и приложенный контекст вместо догадок;
- ссылайся на упражнения по их точному названию из каталога и не выдумывай упражнения, которых там нет;
- у упражнений есть русское название (nameRu) — в ответе называй упражнение по-русски, при необходимости добавляя английское в скобках.

Вопросы о приложении (вход, регистрация, каталог, поиск):
- помогай разобраться самостоятельно: например, при проблемах со входом предложи проверить логин и пароль, включены ли cookie в браузере, попробовать зарегистрироваться заново, убедиться, что сервер запущен (npm run dev) и открыт http://localhost:5174;
- никогда не отвечай «это не по моей части» — всегда предлагай конкретные шаги решения.

Другие темы: отвечай честно и полезно; если не знаешь точного ответа — так и скажи и подскажи, как разобраться.

Табата-тренировки (если доступен инструмент create_tabata):
- если пользователь просит собрать табату, сначала задай уточняющие вопросы одним сообщением: 1) желаемая длительность всей табаты; 2) сложность упражнений (новичок/средний/продвинутый); 3) доступное снаряжение; 4) целевые мышцы или фокус. Не вызывай create_tabata, пока не получишь ответы;
- подбирай упражнения строго из каталога через search_exercises; классическая табата — 8 раундов по 20 секунд работы и 10 секунд отдыха на упражнение (4 минуты на упражнение), подготовка 10 секунд;
- учитывай длительность: если пользователь назвал общую длительность, подбирай число упражнений примерно как длительность / 4 минуты (минимум 1) или корректируй раунды; если назвал число упражнений — соблюдай его;
- когда все параметры ясны, вызови create_tabata один раз и кратко расскажи, что получилось; напомни, что табату можно открыть на вкладке "Табата";
- экономь вызовы инструментов: обычно достаточно 1–2 вызовов search_exercises, после чего сразу вызывай create_tabata (не делай много последовательных поисков);
- не выдумывай упражнения, которых нет в каталоге, и не передавай в create_tabata чужие идентификаторы.

Форматирование: не используй markdown-разметку (звёздочки **, подчёркивания __, решётки #). Названия упражнений и термины выделяй двойными кавычками, например: "Barbell Bench Press". Пиши обычным текстом, списки оформляй как "1. 2. 3.".`

const MAX_TOOL_STEPS = 8

const CREATE_TABATA_TOOL = {
  type: 'function',
  function: {
    name: 'create_tabata',
    description:
      'Создать и сохранить табата-тренировку пользователя из упражнений каталога. Вызывай только после того, как собрал обязательные параметры: длительность, сложность, снаряжение, фокус.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Название табаты (1–80 символов)' },
        exerciseIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'ID упражнений каталога по порядку (1–20)',
        },
        workSec: { type: 'integer', description: 'Работа, секунды (5–600), по умолчанию 20' },
        restSec: { type: 'integer', description: 'Отдых, секунды (0–300), по умолчанию 10' },
        rounds: { type: 'integer', description: 'Раундов на упражнение (1–20), по умолчанию 8' },
        prepareSec: { type: 'integer', description: 'Подготовка, секунды (0–60), по умолчанию 10' },
        restBetweenSec: {
          type: 'integer',
          description: 'Отдых между упражнениями, секунды (0–300), по умолчанию 0',
        },
      },
      required: ['name', 'exerciseIds'],
    },
  },
}

export function sanitizeText(text) {
  return String(text)
    .replace(/\*\*/g, '"')
    .replace(/__/g, '"')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*/g, '')
}

function historyMessages(chatId, limit = 10) {
  const rows = db
    .prepare('SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?')
    .all(chatId, limit)
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }))
}

async function* streamCompletion(messages, tools) {
  const body = { model: config.llmModel, messages, stream: true }
  if (tools?.length) body.tools = tools

  const res = await fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    throw new Error(`llm ${res.status}: ${detail}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolCalls = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      let json
      try {
        json = JSON.parse(data)
      } catch {
        continue
      }
      const delta = json.choices?.[0]?.delta
      if (!delta) continue
      if (delta.content) {
        content += delta.content
        yield { type: 'token', text: delta.content }
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          toolCalls[idx] ||= { id: '', function: { name: '', arguments: '' } }
          if (tc.id) toolCalls[idx].id = tc.id
          if (tc.function?.name) toolCalls[idx].function.name += tc.function.name
          if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments
        }
      }
    }
  }

  yield { type: 'final', content, toolCalls: toolCalls.filter(Boolean) }
}

function safeJson(text) {
  try {
    return JSON.parse(text || '{}')
  } catch {
    return {}
  }
}

function collectCitations(parsed, map) {
  if (!parsed || typeof parsed !== 'object') return
  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      if (item?.id && !map.has(item.id)) map.set(item.id, item)
    }
  }
  if (parsed.id && parsed.name && Array.isArray(parsed.primaryMuscles) && !map.has(parsed.id)) {
    map.set(parsed.id, toListItem(parsed))
  }
}

export async function generateReply({ history = [], content, send, userId = null }) {
  if (!config.apiKey) {
    send({ type: 'error', message: 'Не задан DEEPSEEK_API_KEY в .env — ассистент недоступен.' })
    return null
  }

  const sendToken = (text) => send({ type: 'token', text: sanitizeText(text) })

  const citations = new Map()
  let contextDocs = []
  try {
    contextDocs = await search(content, 6)
    for (const doc of contextDocs) {
      const ex = findExercise(doc.exercise_id)
      if (ex && !citations.has(ex.id)) citations.set(ex.id, toListItem(ex))
    }
  } catch {
    contextDocs = []
  }

  const contextText = contextDocs
    .map((doc, i) => `#${i + 1} [${doc.exercise_id}] ${doc.text}`)
    .join('\n\n')

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  if (contextText) {
    messages.push({
      role: 'system',
      content: `Релевантные упражнения из каталога (для контекста):\n\n${contextText}`,
    })
  }
  for (const message of history) {
    if ((message.role === 'user' || message.role === 'assistant') && message.content) {
      messages.push({ role: message.role, content: message.content })
    }
  }
  messages.push({ role: 'user', content })

  let tools = []
  try {
    tools = await withMcp(async (client) => {
      const { tools: list } = await client.listTools()
      return toOpenAiTools(list)
    })
  } catch {
    tools = []
  }
  if (userId) tools = [...tools, CREATE_TABATA_TOOL]

  const createdTabatas = []
  let finalRaw = ''

  const runTool = async (client, tc) => {
    if (tc.function.name === 'create_tabata') {
      if (!userId) return { error: 'tool_unavailable' }
      const res = createTabataFromAgent(userId, safeJson(tc.function.arguments))
      if (!res.tabata) return { error: res.error }
      createdTabatas.push(res.tabata)
      return {
        ok: true,
        id: res.tabata.id,
        name: res.tabata.name,
        durationSec: res.tabata.durationSec,
        exercises: res.tabata.exercises.length,
        message: 'Табата сохранена',
      }
    }
    if (!client) return { error: 'tool_unavailable' }
    try {
      const result = await client.callTool({
        name: tc.function.name,
        arguments: safeJson(tc.function.arguments),
      })
      return parseToolResult(result)
    } catch (error) {
      return { error: error.message }
    }
  }

  const loop = async (client, availableTools) => {
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      let content = ''
      let toolCalls = []
      for await (const event of streamCompletion(messages, availableTools)) {
        if (event.type === 'token') sendToken(event.text)
        else if (event.type === 'final') {
          content = event.content
          toolCalls = event.toolCalls
        }
      }

      if (toolCalls.length) {
        messages.push({
          role: 'assistant',
          content: content || null,
          tool_calls: toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: tc.function })),
        })
        for (const tc of toolCalls) {
          const parsed = await runTool(client, tc)
          collectCitations(parsed, citations)
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
          })
        }
        continue
      }

      finalRaw = content
      return
    }

    // Бюджет шагов ушёл на вызовы инструментов — добираем финальный текст без инструментов.
    for await (const event of streamCompletion(messages, null)) {
      if (event.type === 'token') sendToken(event.text)
      else if (event.type === 'final') finalRaw = event.content
    }
  }

  const localOnly = tools.filter((t) => t.function?.name === 'create_tabata')

  try {
    await withMcp((client) => loop(client, tools))
  } catch (error) {
    if (!finalRaw && localOnly.length) {
      try {
        await loop(null, localOnly)
      } catch (inner) {
        if (!finalRaw) {
          send({ type: 'error', message: `Ошибка модели: ${inner.message}` })
          return null
        }
      }
    } else if (!finalRaw) {
      send({ type: 'error', message: `Ошибка модели: ${error.message}` })
      return null
    }
  }

  let replyCitations = [...citations.values()].slice(0, 6)
  if (createdTabatas.length) {
    const seen = new Set()
    const items = []
    for (const tabata of createdTabatas) {
      for (const ex of tabata.exercises) {
        if (seen.has(ex.id)) continue
        seen.add(ex.id)
        const source = findExercise(ex.id)
        if (source) items.push(toListItem(source))
      }
    }
    replyCitations = items.slice(0, 20)
  }

  return {
    content: sanitizeText(finalRaw),
    citations: replyCitations,
    tabatas: createdTabatas,
  }
}

export async function runChat({ chatId, content, send, userId = null }) {
  const countBefore = db
    .prepare('SELECT COUNT(*) AS c FROM messages WHERE chat_id = ?')
    .get(chatId).c
  const history = historyMessages(chatId, 10)

  db.prepare('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)').run(
    chatId,
    'user',
    content,
  )
  if (countBefore === 0) {
    db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(content.slice(0, 60), chatId)
  }

  const reply = await generateReply({ history, content, send, userId })
  if (!reply) return

  const tabatas = reply.tabatas ?? []
  db.prepare(
    'INSERT INTO messages (chat_id, role, content, citations, tabata) VALUES (?, ?, ?, ?, ?)',
  ).run(
    chatId,
    'assistant',
    reply.content,
    JSON.stringify(reply.citations),
    tabatas.length ? JSON.stringify(tabatas) : null,
  )

  for (const tabata of tabatas) send({ type: 'tabata', tabata })
  send({ type: 'citations', items: reply.citations })
  send({ type: 'done' })
}
