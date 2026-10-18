# data.md — данные, база и RAG-индекс

Источник истины по **данным**. Файл базы — `data/gpower.db` (режим WAL), каталог `data/` в git не хранится. Подключается расширение `sqlite-vec`; векторная таблица рассчитана на размерность **1024** (модель `qwen3-embedding:0.6b`).

## Схема SQLite

```sql
users    (id PK, username UNIQUE, password_hash, created_at)
sessions (token PK, user_id → users, created_at, expires_at)
chats    (id PK, user_id → users, title, created_at)
messages (id PK, chat_id → chats, role, content, citations, created_at)
docs     (id PK, exercise_id, lang, kind, text)         -- обычная таблица документов
vec_docs (doc_id PK, embedding float[1024])             -- виртуальная таблица sqlite-vec
```

- `messages.role` — `user` | `assistant`; `messages.citations` — JSON-массив карточек.
- `vec_docs.doc_id` ссылается на `docs.id`. **PK `vec_docs` принимает только BigInt** (см. `docs/pitfalls.md`).
- Пароли: `scrypt$N$r$p$salt$hash` (N=16384, r=8, p=1, keylen=64).

## Датасет (`free-exercise-db/`, внешний клон)

- `dist/exercises.json` — объединённый массив, **876** упражнений (загружается в память на старте).
- `exercises/<Id>/<n>.jpg` — **1746** изображений; раздаются как `/images/<Id>/<n>.jpg`.
- `schema.json` (draft-04): обязательные поля — `id, name, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images`. Допустимые значения перечислены в `enum`; `force`/`mechanic`/`equipment` могут быть `null`.
- Дерево клона **не изменяется**; обновление — `git pull`.

## Слой дополнений (`data-aug/`, версионируется)

`data-aug/summaries/<id>.json`:

```json
{ "id": "Air_Bike", "name": "Air Bike",
  "ru": "…цель, техника, частые ошибки, альтернативы…",
  "en": "…the same in English…" }
```

Ожидается 876 файлов (по одному на упражнение). Читается в двух местах: `catalog-core` (для поиска и подписи) и сервер (для индекса). Оба кешируют — **после регенерации перезапусти сервер**.

`data-aug/translations/<id>.json` — русский перевод названия и техники:

```json
{ "id": "Air_Bike", "name": "Air Bike",
  "nameRu": "Велосипед",
  "instructionsRu": ["…шаг 1…", "…шаг 2…"] }
```

Ожидается 876 файлов; число `instructionsRu` совпадает с числом английских шагов (у упражнений без шагов — `[]`). Используется в API (`nameRu`, `instructionsRu`), поиске и индексе.

## RAG-индекс

`npm run index` → `buildIndex()` (`apps/server/src/rag.js`):

1. Документы на упражнение: `kind=exercise, lang=en` — двуязычный текст (английские данные + `nameRu` + `instructionsRu`), и, если есть резюме, `kind=summary` с `lang=ru` и `lang=en`.
2. Эмбеддинги через Ollama `POST /api/embed` (модель `EMBEDDING_MODEL`), батчами по 32.
3. Запись в `docs` и `vec_docs` (эмбеддинг — `Float32Array` в Buffer).

Ожидаемый размер: 876 + 876 + 876 = **2628** документов (≈18 минут). Индекс полностью перезаписывается.

## Поиск

**Гибридный (RAG, `rag.search`)** — для чата: KNN по `vec_docs` (берётся `limit*3`) + ключевой `LIKE` по `docs.text` (`limit*3`); оценка `1/(1+distance)`, ключевому совпадению `+0.5`; дедупликация по `exercise_id`; возврат топ-N (по умолчанию 6).

**Текстовый (каталог, `catalog-core/search.js`)** — для API-поиска: токенизация, стоп-слова, словарь RU→EN, лёгкое усечение окончаний; токен-группы объединяются по AND; поля взвешены (название 8 / структурные 4 / текст 1); сортировка по сумме.

## Процедуры

```bash
# после git pull датасета: сгенерировать недостающие/новые резюме и переводы (идемпотентно)
npm run summaries                 # только новые id; прогресс каждые 25
npm run translations              # только новые id; требует DEEPSEEK_API_KEY
SUMMARY_CONCURRENCY=3 npm run summaries   # параллелизм (по умолчанию 3)

# затем пересобрать индекс
npm run index
```

Порядок важен: **резюме → индекс**. Генерация резюме требует `DEEPSEEK_API_KEY`; сборка индекса — запущенной Ollama. Скрипт резюме устойчив к «шумным» ответам модели (извлекает первый сбалансированный JSON-объект, склеивает несколько объектов, повторяет при сбое).
