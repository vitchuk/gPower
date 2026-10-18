# architecture.md — архитектура gPower

Источник истины о **системе**. Монорепо на npm workspaces; границы между пакетами — часть контракта.

## Диаграмма

```mermaid
flowchart LR
    U["Пользователь<br/>браузер · Vue 3 (:5174)"]

    subgraph APP["apps/server — Fastify (:3000)"]
        API["REST: каталог · авторизация · чаты"]
        SSE["SSE-чаты: стриминг ответов"]
        RAG["RAG-ретрив (rag.js)"]
        LOOP["LLM-цикл с tool-calling (chat.js)"]
        MCPCLI["MCP-клиент (mcp-client.js)"]
    end

    DB[("SQLite + sqlite-vec<br/>users · sessions · chats · messages · docs · vec_docs")]
    O[("Ollama<br/>qwen3-embedding:0.6b")]
    D[("DeepSeek<br/>deepseek-chat")]
    M["packages/mcp-catalog<br/>MCP-сервер (:3001)"]
    C[("Каталог: 876 JSON + images<br/>data-aug: summaries · translations")]

    U -->|"/api · /images"| API
    U -->|"вопрос"| SSE
    SSE --> LOOP
    RAG -->|"эмбеддинги"| O
    RAG -->|"KNN + ключевые слова"| DB
    LOOP -->|"контекст · tool-вызовы"| D
    LOOP --> MCPCLI
    MCPCLI -->|"streamable HTTP"| M
    M --> C
    LOOP -->|"токены · цитаты-карточки"| U
```

## Компоненты

| Компонент | Путь | Ответственность |
|---|---|---|
| Web | `apps/web` | Vue 3 SPA: каталог, вход, вкладки «Ассистент» и «Помощь», FAQ, стриминг ответов |
| API | `apps/server/src` | Fastify: REST каталога, авторизация, чаты, SSE, RAG-ретрив, LLM-цикл, MCP-клиент |
| Каталог-ядро | `packages/catalog-core` | Загрузка датасета, RU-словарь, фильтры, двуязычный поиск, чтение резюме |
| MCP-сервер | `packages/mcp-catalog` | Streamable HTTP MCP-сервер с инструментами каталога |
| Дополнения | `data-aug/summaries`, `data-aug/translations` | 876 резюме RU/EN и 876 RU-переводов (версионируются) |
| Датасет | `free-exercise-db` | Внешний клон (не изменяется) |

Скрипты: `apps/server/scripts/build-index.js` (`npm run index`), `generate-summaries.js` (`npm run summaries`), `generate-translations.js` (`npm run translations`); общие приёмы LLM-вызовов — `scripts/lib/llm.js`.

## Порты и процессы

| Процесс | Порт | Примечание |
|---|---|---|
| Web (Vite dev) | 5174 | проксирует `/api` и `/images` на API |
| API (Fastify) | 3000 | `PORT` из `.env` |
| MCP-сервер | 3001 | `MCP_PORT`; API подключается по `MCP_URL` |

## Потоки

**Каталог.** Браузер → `GET /api/exercises` → `catalog-core.filterExercises` (структурные фильтры + поиск с ранжированием) → срез страницы → JSON. Картинки: `GET /images/*` → `@fastify/static` из `free-exercise-db/exercises`.

**RAG-ретрив.** Вопрос → эмбеддинг через Ollama → KNN в `vec_docs` (sqlite-vec) + ключевой поиск `LIKE` по `docs.text` → объединение и ранжирование → топ-6 документов → в системный промпт.

**Чат с tool-calling.** История (≤10) + контекст + вопрос → LLM (стриминг). Если модель запрашивает инструмент — бэкенд вызывает MCP-инструмент, добавляет результат и повторяет (≤4 шага). Токены уходят клиенту по SSE санитизированными; найденные упражнения собираются в цитаты и отправляются отдельным событием.

**Авторизация.** Регистрация/вход → серверная сессия в `sessions` → cookie `gp_session` (HttpOnly). Каждый защищённый эндпоинт читает cookie → `requireUser`. Анонимный `POST /api/help` в базу не пишет.

## Границы (не нарушать)

- `catalog-core` **не знает** про HTTP, базу и LLM — это чистая логика данных и поиска.
- `mcp-catalog` **не знает** про SQLite и чаты — только инструменты каталога.
- Только `apps/server` работает с SQLite, LLM и MCP-клиентом.
- Web обращается к серверу **только** через `/api` и `/images`.

## Дерево репозитория

```
gPower/
├── apps/
│   ├── server/
│   │   ├── src/        # index, config, db, auth, rag, chat, mcp-client, routes*
│   │   └── scripts/    # build-index.js, generate-summaries.js
│   └── web/
│       └── src/        # main, router, api, auth-store, views/, components/, faq.js
├── packages/
│   ├── catalog-core/   # data, dictionary, search, catalog
│   └── mcp-catalog/    # server.js, catalog-service.js
├── data-aug/summaries/ # 876 RU/EN-резюме
├── data/               # SQLite + индекс (gitignored)
└── free-exercise-db/   # клон датасета (gitignored)
```

## Внешние зависимости и деградация

| Зависимость | Нужна для | Если недоступна |
|---|---|---|
| Ollama `qwen3-embedding:0.6b` | эмбеддинги RAG и построение индекса | ассистент отвечает без RAG-контекста; `npm run index` падает |
| DeepSeek API | ответы и генерация резюме | чат отдаёт понятную ошибку; `npm run summaries` падает |
| MCP-сервер | инструменты каталога | цикл работает без инструментов (не падает) |
