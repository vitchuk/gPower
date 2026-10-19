# mcp.md — MCP-сервер каталога

Источник истины по **MCP**. Каталог подключён к ассистенту отдельным сервером на пакете `@modelcontextprotocol/sdk` (streamable HTTP). Бэкенд чата выступает MCP-клиентом.

## Сервер

- Путь: `packages/mcp-catalog/src/server.js` (инструменты — `catalog-service.js`).
- Транспорт: **streamable HTTP**, эндпоинт `POST /mcp`, порт `MCP_PORT` (по умолчанию 3001).
- Сервер **stateless**: на каждый HTTP-запрос создаётся новый `Server` + `StreamableHTTPServerTransport` (`sessionIdGenerator: undefined`).
- Запуск: `npm run dev:mcp` (или `npm run dev` — вместе с web и API).
- Подключение из API: `MCP_URL` из `.env` (по умолчанию `http://localhost:3001/mcp`).
- Сервер самодостаточен: его можно подключить к любому MCP-клиенту и получить тот же доступ к каталогу.

## Инструменты

| Инструмент | Вход | Результат |
|---|---|---|
| `search_exercises` | `q?, muscle?, equipment?, level?, category?, limit?` (1…50, по умолчанию 10) | `{total, items[]}` — карточки упражнений с `id, name, equipment, level, muscles, category, thumbnail` |
| `get_exercise` | `id` (обязателен) | полная карточка упражнения (техника, мышцы, `imageUrls[]`, `gifUrl`); ошибка, если не найдено |
| `get_filters` | — | значения фильтров с RU-подписями |

Схемы входа описаны **JSON Schema** (`inputSchema` в `catalog-service.js`), не zod. Ответ инструмента — `content: [{type:"text", text: JSON.stringify(result)}]`; при ошибке — тот же формат с `isError: true`.

Все инструменты переиспользуют `packages/catalog-core` (те же данные, фильтры и поиск, что и у API) — не дублируй логику.

## Как это использует ассистент

1. `apps/server/src/mcp-client.js` подключается к серверу как MCP-клиент, получает `listTools()` и конвертирует их в tool-calling формат LLM.
2. В цикле чата модель сама решает, когда вызвать инструмент; бэкенд выполняет вызов и возвращает результат модели.
3. Найденные упражнения (`items[]` из `search_exercises`, карточка из `get_exercise`) собираются в цитаты и отправляются клиенту событием `citations`.

## Тестирование

Запусти MCP-сервер и выполни клиентский смоук из каталога пакета (чтобы резолвился `@modelcontextprotocol/sdk`):

```bash
# терминал 1
npm run dev:mcp

# терминал 2 (workdir: packages/mcp-catalog)
node --input-type=module -e "
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
const c = new Client({ name: 'smoke', version: '0' }, { capabilities: {} })
await c.connect(new StreamableHTTPClientTransport(new URL('http://localhost:3001/mcp')))
console.log((await c.listTools()).tools.map(t => t.name))
const r = await c.callTool({ name: 'search_exercises', arguments: { muscle: 'chest', limit: 2 } })
console.log(JSON.parse(r.content[0].text).items.map(i => i.name))
await c.close()
"
```

Ожидаемо: `['search_exercises','get_exercise','get_filters']` и две карточки упражнений на грудь.

## Подключение из внешнего MCP-клиента

```jsonc
{
  "mcpServers": {
    "gpower-catalog": { "url": "http://localhost:3001/mcp" }
  }
}
```

## Правила

- Новый инструмент → добавь в `catalog-service.js`, опиши схему и обнови таблицу выше.
- Не добавляй в MCP-сервер состояние (БД, чаты) — он только про каталог.
