# Задачи: Русский перевод названий и техники (0001)

- [x] `scrollbar-gutter: stable` в `main.css` и на скроллерах чатов — проверка: `npm run build`, визуально
- [x] `lib/llm.js` + рефакторинг `generate-summaries.js` — проверка: `node --check`
- [x] `generate-translations.js` + скрипт `npm run translations` — проверка: прогон на 2 упражнениях
- [x] Генерация 876 переводов (0 ошибок) — проверка: валидатор (876 файлов, счётчики шагов совпадают)
- [x] `catalog-core`: `readTranslation`, RU-поля, поиск — проверка: `toDetail('Barbell_Bench_Press_-_Medium_Grip').nameRu`
- [x] Web: карточка и деталь на русском — проверка: `npm run build`
- [x] `rag.js`: двуязычный документ — проверка: `rag.search('растяжка подколенных')`
- [x] Промпт ассистента: русские названия — проверка: `POST /api/help`
- [x] Пересборка индекса (2628 документов) — проверка: счётчик `docs`
- [x] Обновить документацию (`api.md`, `data.md`, `SPEC.md`, `GLOSSARY.md`, `architecture.md`, `AGENTS.md`, `README.md`)
- [x] Обе задачи пользователя закрыты, изменения закоммичены в `sdd`
