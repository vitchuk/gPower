# План: Русский перевод названий и техники (0001)

Ссылка на спеку: `./spec.md`.

## Изменяемые файлы

| Файл | Что меняем |
|---|---|
| `apps/server/scripts/lib/llm.js` | новый: общий `chatJson` (устойчивый разбор JSON), `withRetry`, `runPool` |
| `apps/server/scripts/generate-translations.js` | новый: генерация переводов в `data-aug/translations` |
| `apps/server/scripts/generate-summaries.js` | переведён на общий `lib/llm.js` (убрано дублирование) |
| `apps/server/package.json`, `package.json` | скрипт `translations` |
| `packages/catalog-core/src/data.js` | `TRANSLATIONS_DIR`, `readTranslation()` (кеш) |
| `packages/catalog-core/src/catalog.js` | `toListItem`/`toDetail` → `nameRu`/`instructionsRu` |
| `packages/catalog-core/src/search.js` | `nameRu` в поле «название», `instructionsRu` в «текст» |
| `apps/server/src/rag.js` | двуязычный документ упражнения; прогресс-лог сборки |
| `apps/server/src/chat.js` | в промпте: предпочитать русское название |
| `apps/web/src/components/ExerciseCard.vue` | RU-название основным, EN мелко |
| `apps/web/src/views/ExerciseView.vue` | RU-заголовок + RU-шаги (вычисляемые из `instructionsRu`) |
| `apps/web/src/assets/main.css`, `AssistantView.vue`, `HelpView.vue` | фикс «скачет» страница: `scrollbar-gutter: stable` |

## Решения

- **Переводы в `data-aug/`, не в клоне** — ADR-0006.
- **Общая библиотека `lib/llm.js`** — устойчивый разбор JSON и ретраи нужны обоим генераторам; дублировать 60 строк не стали.
- **Ремонтный проход в переводе** — если модель склеила/потеряла шаг (число RU-шагов ≠ EN), делается второй запрос, приводящий число ровно к исходному (см. `docs/pitfalls.md`).
- **RU-шаги в UI только** (решение пользователя): английские остаются в данных/API.
- **Индекс двуязычный**: в документ упражнения добавлены RU-название и RU-техника; пересборка обязательна.

## Риски и обратная совместимость

- EN-поля API сохранены; новые поля аддитивны — обратная совместимость есть.
- Пересборка индекса обязательна после генерации переводов; иначе RAG не увидит русские тексты.
- Требуется запущенная Ollama (эмбеддинги) и ключ DeepSeek.

## Документация к обновлению

`docs/api.md` (поля), `docs/data.md` (каталог переводов и процедура), `docs/SPEC.md` (FR-12), `GLOSSARY.md` (термин «Перевод»), `docs/architecture.md`, `AGENTS.md` (команда), `README.md`.
