# pitfalls.md — грабли среды и реализации

Реальные проблемы, уже пойманные в этом проекте. LLM: не «исправляй» код против этого файла — он написан так намеренно. Если меняешь поведение — обнови и файл.

## Платформа (Windows / PowerShell)

**1. Кириллица в теле `curl` искажается.** PowerShell передаёт `-d '{"content":"Привет"}'` в неверной кодировке → сервер отвечает `FST_ERR_CTP_INVALID_JSON_BODY`.
*Решение*: тело с кириллицей — из UTF-8-файла: `curl --data-binary "@body.json"`; для GET-параметров — `curl -G --data-urlencode "q=..."`.

**2. Кириллица в консоли PowerShell — это mojibake вывода, а не порча данных.** Файлы и БД хранят корректный UTF-8; `?????` в консоли означает лишь кодовую страницу.
*Решение*: проверяй содержимое файлов (Read/Node), не «чини» данные по виду консоли.

**3. `ConvertFrom-Json` (PowerShell 5.1) падает на `package-lock.json`** из-за дублирующихся ключей (`name`).
*Решение*: разбирай JSON через Node (`node -e "…"`).

**4. `Get-ChildItem -Include` с `-Recurse` считает файлы неверно.**
*Решение*: считай через Node или `Where-Object { $_.Extension -eq … }`.

## SQLite / sqlite-vec

**5. `vec0` принимает в PK только BigInt.** `node:sqlite` связывает JS-число как REAL → `Error: Only integers are allowed for primary key values on vec_docs`.
*Решение*: `insertVec.run(BigInt(info.lastInsertRowid), buffer)`.

**6. `sqlite-vec` — CJS-пакет.** ESM `import sqliteVec from 'sqlite-vec'` даёт `does not provide an export named 'default'`.
*Решение*: `const require = createRequire(import.meta.url); const sqliteVec = require('sqlite-vec')`.

**7. Загрузка расширения требует двух шагов.** `db.enableLoadExtension(true)` без флага при создании даёт `Cannot enable extension loading because it was disabled at database creation`.
*Решение*: `new DatabaseSync(path, { allowExtension: true })`, затем `enableLoadExtension(true)` и `loadExtension(...)`.

**8. Кеши данных в процессе.** `catalog-core` кеширует упражнения, резюме и поля поиска; сервер держит индекс.
*Решение*: после `npm run summaries` или `npm run index` — перезапусти сервер, иначе увидишь старые данные.

## Веб (Vue / Vite)

**9. `v-model` на объекте из `reactive` ломается.** `<Comp v-model="selection" />`, где `selection = reactive({...})`, компилируется в `selection = $event` — присваивание `const` бросает TypeError, выбор молча теряется.
*Решение*: `:modelValue="selection"` + `@update:modelValue="Object.assign(selection, $event)"`.

**10. Vite dev слушает IPv6 `[::1]`.** Обращение на `127.0.0.1:5174` может не подключиться.
*Решение*: открывай `http://localhost:5174`.

## Сервер / SSE / LLM

**11. SSE в Fastify требует `reply.hijack()`.** Иначе Fastify попытается отправить ответ сам.
*Решение*: `reply.hijack()`, затем `reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', … })`, кадры `data: {json}\n\n`, и обязательно `raw.end()` в `finally`.

**12. DeepSeek может вернуть не один JSON.** При `response_format: json_object` встречались два объекта подряд (`{"ru":…}{"en":…}`) или текст после JSON — `JSON.parse` падал.
*Решение*: извлекать все сбалансированные `{…}` сканером, склеивать их; при сбое — повтор с backoff (см. `generate-summaries.js`).

**13. Модель охотно ставит markdown.** Ответы с `**жирным**` выглядели как звёздочки в UI.
*Решение*: (а) запрет markdown в системном промпте; (б) санитайзер на каждый токен (`**`/`__` → `"`, срез `#`) — работает даже если `**` разорван между токенами.

## Репозиторий / сборка

**14. `npm workspaces` запускает скрипты с cwd = папка пакета.** `process.loadEnvFile('.env')` не находит корневой `.env`.
*Решение*: путь к `.env` вычисляется от `import.meta.url` (`apps/server/src/config.js`).

**15. Симлинки в git-клоне на Windows.** При `core.symlinks=false` (по умолчанию) `site/public/exercises` из клона датасета — текстовый файл с путём, а не ссылка.
*Решение*: не важно — эталонный сайт берёт картинки с CDN, а наши картинки раздаёт API из `free-exercise-db/exercises`.
