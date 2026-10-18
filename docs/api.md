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

`page` ≥ 1 (по умолчанию 1); `pageSize` — 1…100 (по умолчанию 24). `items[]` — карточка: `id, name, nameRu, level, levelLabel, mechanic, equipment, equipmentLabel, force, category, categoryLabel, primaryMuscles[], primaryMusclesLabels[], thumbnail`. Карточка по `:id` дополнительно содержит `instructions[]`, `instructionsRu[]`, `secondaryMuscles[]`, `secondaryMusclesLabels[]`, `forceLabel`, `mechanicLabel`, `imageUrls[]`.

`nameRu` и `instructionsRu` приходят из `data-aug/translations` (русский перевод названия и техники); если перевода нет — `null`. Английские поля всегда присутствуют.

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
| GET | `/api/chats/:id/messages` | — | `{chat:{id,title}, messages:[{id,role,content,citations[],created_at}]}`; `404 not_found` |
| POST | `/api/chats/:id/messages` | `{content}` | SSE-поток; `400 empty`, `404 not_found` |

Первому сообщению чата заголовок берётся автоматически (первые 60 символов).

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
| `citations` | `items[]` | карточки упражнений, на которые сослался ассистент (≤ 6) |
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
```

`body.json` и `help.json` — файлы в UTF-8 вида `{"content":"..."}`. В PowerShell **не** передавай кириллицу через `-d` — тело исказится (см. `docs/pitfalls.md`).
