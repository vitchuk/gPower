# api.md — контракты REST и SSE

Источник истины по **API**. Базовый префикс — `/api`; формат — JSON UTF-8. Авторизация — серверная сессия в cookie `gp_session` (HttpOnly, `SameSite=Lax`, срок 30 дней). Ошибки: `{"error":"код", "message"?:"текст"}` с соответствующим HTTP-кодом.

## Каталог (без авторизации)

| Метод | Путь | Параметры | Ответ |
|---|---|---|---|
| GET | `/api/health` | — | `{status:"ok", exercises:number}` |
| GET | `/api/filters` | — | `{total, muscles[], equipment[], levels[], forces[], mechanics[], categories[]}` — каждый элемент `{value, label}` c RU-подписью |
| GET | `/api/exercises` | `q, muscle, equipment, level, force, mechanic, category, page, pageSize` | `{total, page, pageSize, items[]}` |
| GET | `/api/exercises/:id` | — | полная карточка упражнения; `404 {error:"not_found"}` |
| GET | `/images/*` | путь картинки из датасета | JPEG (статика из `free-exercise-db/exercises`) |
| GET | `/gifs/*` | имя GIF-файла | GIF (статика из `cesar-exercises-dataset/videos`) |

Статика `/images/*` и `/gifs/*` отдаётся с `Cache-Control: public, max-age=31536000, immutable` (датасеты — внешние клоны, файлы на месте не меняются).

`page` ≥ 1 (по умолчанию 1); `pageSize` — 1…100 (по умолчанию 24). `items[]` — карточка: `id, name, nameRu, level, levelLabel, mechanic, equipment, equipmentLabel, force, category, categoryLabel, primaryMuscles[], primaryMusclesLabels[], thumbnail`. Карточка по `:id` дополнительно содержит `instructions[]`, `instructionsRu[]`, `secondaryMuscles[]`, `secondaryMusclesLabels[]`, `forceLabel`, `mechanicLabel`, `imageUrls[]`, `gifUrl`.

`nameRu` и `instructionsRu` приходят из `data-aug/translations` (русский перевод названия и техники); если перевода нет — `null`. Английские поля всегда присутствуют.

`gifUrl` приходит из маппинга `data-aug/media` (анимированный GIF из `cesar-exercises-dataset`, © Gym visual); если GIF для упражнения не сопоставлен — `null`.

Поведение `q`: токенизация; стоп-слова и токены короче 3 символов отбрасываются; для русских слов работает словарь RU→EN (`грудь→chest`, `жим→press`, `гантели→dumbbell`…); совпадение — по всем токенам (AND); ранжирование по полям (название 8 / структурные поля 4 / текст 1).

## Авторизация

| Метод | Путь | Тело | Успех | Ошибки |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{username, password}` | `{user:{id,username}}`, ставит cookie | `400 invalid_input` (логин < 3 или пароль < 4), `409 username_taken` |
| POST | `/api/auth/login` | `{username, password}` | `{user:{id,username}}`, ставит cookie | `401 invalid_credentials` |
| POST | `/api/auth/logout` | — | `{ok:true}`, сбрасывает cookie | — |
| GET | `/api/auth/me` | — | `{user}` | `401 unauthorized` |

## Чаты (требуют авторизации; иначе `401`)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/chats` | — | `{chats:[{id,title,created_at}], index:number}` (`index` — число документов RAG) |
| POST | `/api/chats` | — | `{chat:{id,title:"Новый чат"}}` |
| DELETE | `/api/chats/:id` | — | `{ok:true}`; `404 not_found` |
| GET | `/api/chats/:id/messages` | — | `{chat:{id,title}, messages:[{id,role,content,citations[],tabata[],created_at}]}`; `404 not_found` |
| POST | `/api/chats/:id/messages` | `{content}` | SSE-поток; `400 empty`, `404 not_found` |

Первому сообщению чата заголовок берётся автоматически (первые 60 символов). `tabata[]` в сообщении — JSON-снимки табат, созданных ассистентом в этом ответе (пустой массив, если нет).

## Табаты (требуют авторизации; иначе `401`)

| Метод | Путь | Тело | Ответ | Ошибки |
|---|---|---|---|---|
| GET | `/api/tabatas` | — | `{tabatas:[Tabata]}` (по id убыв.) | `401` |
| POST | `/api/tabatas` | `{name, params, exercises}` | `{tabata:Tabata}` | `400 invalid` (`detail` — причина), `401` |
| GET | `/api/tabatas/:id` | — | `Tabata` | `401`, `404 not_found` |
| PUT | `/api/tabatas/:id` | `{name, params, exercises}` | `{tabata:Tabata}` | `400 invalid`, `401`, `404` |
| DELETE | `/api/tabatas/:id` | — | `{ok:true}` | `401`, `404` |

`Tabata` = `{id, name, params, exercises[], durationSec, created_at}`.

- `params` — `{prepare, work, rest, rounds, restBetween}` (все числа, секунды; `rounds` — раундов на упражнение). Лимиты: `prepare` 0–60, `work` 5–600, `rest` 0–300, `rounds` 1–20, `restBetween` 0–300.
- `exercises` — 1–20 элементов; в запросе `{id, rounds?}`, где `rounds` (1–20) переопределяет общий, `null` — общий. В ответе упражнение обогащено каталогом: `{id, name, nameRu, category, categoryLabel, thumbnail, imageUrls[], gifUrl, rounds}`. При чтении (`GET`) обогащение пересобирается из текущего каталога — сохранённые ранее табаты тоже получают новые поля.
- `name` — 1–80 символов. `durationSec` = `prepare + Σ(rounds·(work+rest)) + (n−1)·restBetween`.
- Неизвестный `exercise.id`, выход за лимиты или пустой состав → `400 invalid` с `detail` (`invalid_name`, `invalid_params`, `invalid_exercises_count`, `unknown_exercise:<id>`, `invalid_rounds`).

## Помощь (без авторизации, в базу не пишет)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/api/help` | `{content, history:[{role,content}]}` | SSE-поток; `400 empty`, `400 too_long` |

Ограничения: `content` ≤ 2000 символов, `history` — не более 10 последних сообщений (роли `user`/`assistant`). Rate-limit намеренно отсутствует (локальный MVP); ограничения длины — единственная защита от раздувания запроса.

## SSE-поток (общий для чатов и помощи)

Заголовки ответа: `Content-Type: text/event-stream`, `Cache-Control: no-cache`. Каждое событие — строка `data: {json}` + пустая строка.

| Событие | Поле | Значение |
|---|---|---|
| `token` | `text` | очередной фрагмент ответа (уже санитизирован: без `**`/`__`/`#`) |
| `citations` | `items[]` | карточки упражнений, на которые сослался ассистент (≤ 6); если в этом ответе создана табата — упражнения созданной табаты в её порядке (≤ 20) вместо поисковых карточек |
| `tabata` | `tabata` | созданная ассистентом табата (`Tabata`); по одному событию на каждую, перед `citations` и `done`; только в чатах (в `/api/help` не приходит) |
| `error` | `message` | человекочитаемая ошибка (например, не задан ключ LLM) |
| `done` | — | конец потока (приходит всегда последним) |

## Примеры

```bash
# здоровье и фильтры
curl http://localhost:3000/api/health
curl http://localhost:3000/api/filters

# поиск с кириллицей: GET-параметры — через --data-urlencode
curl -s -G http://localhost:3000/api/exercises --data-urlencode "q=жим на грудь" --data-urlencode "pageSize=3"

# регистрация и получение cookie
curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "content-type: application/json" -d "{\"username\":\"demo\",\"password\":\"demo1234\"}"

# чат (SSE); тело с кириллицей — из UTF-8 файла через --data-binary
curl -N -b cookies.txt -X POST http://localhost:3000/api/chats \
  -H "content-type: application/json" -d "{}"
curl -N -b cookies.txt -X POST http://localhost:3000/api/chats/1/messages \
  -H "content-type: application/json" --data-binary "@body.json"

# анонимная помощь
curl -N -X POST http://localhost:3000/api/help \
  -H "content-type: application/json" --data-binary "@help.json"

# табаты (нужна cookie из входа выше); тело с кириллицей — из UTF-8 файла
curl -s -b cookies.txt http://localhost:3000/api/tabatas
curl -s -b cookies.txt -X POST http://localhost:3000/api/tabatas \
  -H "content-type: application/json" --data-binary "@tabata.json"
curl -s -b cookies.txt -X DELETE http://localhost:3000/api/tabatas/1
```

`tabata.json` — в UTF-8 вида:
`{"name":"Утренняя табата","params":{"prepare":10,"work":20,"rest":10,"rounds":8,"restBetween":0},"exercises":[{"id":"Pushups"},{"id":"Bodyweight_Squat","rounds":6}]}`.

`body.json` и `help.json` — файлы в UTF-8 вида `{"content":"..."}`. В PowerShell **не** передавай кириллицу через `-d` — тело исказится (см. `docs/pitfalls.md`).
