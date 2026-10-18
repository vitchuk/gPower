import { readSummary, readTranslation } from './data.js'
import { labelFor } from './dictionary.js'

const STOPWORDS = new Set([
  'на', 'со', 'с', 'и', 'для', 'под', 'в', 'во', 'по', 'из', 'к', 'ко', 'от', 'до',
  'как', 'что', 'мне', 'нужно', 'надо', 'хочу', 'можно', 'упражнение', 'упражнения',
  'the', 'a', 'an', 'with', 'for', 'and', 'of', 'to', 'on', 'in', 'my', 'me', 'how',
  'what', 'please', 'exercise', 'exercises', 'show', 'find',
])

// Русский токен -> английские термины, которые встречаются в данных каталога.
const RU_TO_EN = {
  // мышцы
  грудь: ['chest', 'груд'],
  груди: ['chest', 'груд'],
  грудные: ['chest', 'груд'],
  грудных: ['chest', 'груд'],
  груда: ['chest', 'груд'],
  спина: ['back', 'lats'],
  спины: ['back', 'lats'],
  спине: ['back', 'lats'],
  широчайшие: ['lats'],
  широчайших: ['lats'],
  пресс: ['abdominals', 'abs'],
  пресса: ['abdominals'],
  прессу: ['abdominals'],
  ягодицы: ['glutes'],
  ягодиц: ['glutes'],
  бицепс: ['biceps'],
  бицепса: ['biceps'],
  трицепс: ['triceps'],
  трицепса: ['triceps'],
  плечи: ['shoulders'],
  плеч: ['shoulders'],
  дельты: ['shoulders'],
  трапеции: ['traps'],
  ноги: ['legs', 'quadriceps', 'hamstrings'],
  ног: ['legs', 'quadriceps', 'hamstrings'],
  квадрицепс: ['quadriceps'],
  квадрицепса: ['quadriceps'],
  бицепсбедра: ['hamstrings'],
  икры: ['calves'],
  икроножные: ['calves'],
  предплечья: ['forearms'],
  шея: ['neck'],
  поясница: ['lower back', 'back'],
  // снаряжение
  штанга: ['barbell'],
  штангой: ['barbell'],
  штанги: ['barbell'],
  штанг: ['barbell'],
  гантель: ['dumbbell'],
  гантели: ['dumbbell'],
  гантелей: ['dumbbell'],
  гантелями: ['dumbbell'],
  гиря: ['kettlebell'],
  гири: ['kettlebell'],
  гирей: ['kettlebell'],
  тренажёр: ['machine'],
  тренажер: ['machine'],
  тренажёре: ['machine'],
  блок: ['cable'],
  кроссовер: ['cable'],
  резинки: ['bands'],
  резинка: ['bands'],
  эспандер: ['bands'],
  медбол: ['medicine ball'],
  фитбол: ['exercise ball'],
  турник: ['pullup', 'chin', 'bar'],
  брусья: ['dip', 'dips'],
  вес: ['body only', 'weight'],
  // движения
  жим: ['press'],
  жима: ['press'],
  жиме: ['press'],
  жиму: ['press'],
  тяга: ['row', 'deadlift', 'pull'],
  тяги: ['row', 'deadlift', 'pull'],
  тянуть: ['pull', 'row'],
  присед: ['squat'],
  приседания: ['squat'],
  приседание: ['squat'],
  приседать: ['squat'],
  становая: ['deadlift'],
  выпад: ['lunge'],
  выпады: ['lunge'],
  разводка: ['fly', 'flyes'],
  разведение: ['fly', 'flyes'],
  разведения: ['fly', 'flyes'],
  подтягивание: ['pullup', 'chin', 'pull-up'],
  подтягивания: ['pullup', 'chin', 'pull-up'],
  отжимание: ['pushup', 'push-up', 'dip'],
  отжимания: ['pushup', 'push-up', 'dip'],
  скручивание: ['crunch'],
  скручивания: ['crunch'],
  растяжка: ['stretch'],
  растяжки: ['stretch'],
  стретчинг: ['stretch'],
  подъём: ['raise', 'raise'],
  подъем: ['raise'],
  подъемы: ['raise'],
  сгибание: ['curl', 'flexion'],
  сгибания: ['curl', 'flexion'],
  разгибание: ['extension'],
  разгибания: ['extension'],
  махи: ['raise', 'swing'],
  кардио: ['cardio'],
  бег: ['run', 'running'],
  велосипед: ['bike', 'bicycle', 'cycling'],
  планка: ['plank'],
}

// Английские алиасы, которых может не быть дословно в данных.
const EN_ALIAS = {
  abs: ['abdominal', 'abdominals'],
  delts: ['deltoid', 'shoulder'],
  pullup: ['pull-up', 'pull up', 'chin'],
  pushup: ['push-up', 'push up'],
  flyes: ['fly', 'flyes'],
  dips: ['dip', 'dips'],
  cardio: ['cardio'],
}

const fieldsCache = new Map()

function fieldsFor(exercise) {
  let value = fieldsCache.get(exercise.id)
  if (value != null) return value

  const summary = readSummary(exercise.id)
  const translation = readTranslation(exercise.id)
  value = {
    name: [exercise.name, translation?.nameRu || ''].join(' ').toLowerCase(),
    structured: [
      exercise.primaryMuscles.join(' '),
      exercise.secondaryMuscles.map((m) => labelFor('muscle', m)).join(' '),
      exercise.primaryMuscles.map((m) => labelFor('muscle', m)).join(' '),
      labelFor('equipment', exercise.equipment),
      exercise.equipment || '',
      labelFor('category', exercise.category),
      exercise.category || '',
      labelFor('level', exercise.level),
      labelFor('force', exercise.force),
      labelFor('mechanic', exercise.mechanic),
    ]
      .join(' ')
      .toLowerCase(),
    body: [
      (exercise.instructions || []).join(' '),
      (translation?.instructionsRu || []).join(' '),
      summary?.ru || '',
      summary?.en || '',
    ]
      .join(' ')
      .toLowerCase(),
  }

  fieldsCache.set(exercise.id, value)
  return value
}

export function queryGroups(query) {
  const tokens = String(query)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

  const groups = []
  for (const token of tokens) {
    if (token.length < 3 || STOPWORDS.has(token)) continue
    const terms = new Set([token])
    for (const en of RU_TO_EN[token] || []) terms.add(en)
    for (const alias of EN_ALIAS[token] || []) terms.add(alias)
    // лёгкое усечение окончаний для длинных русских слов
    if (token.length >= 6) terms.add(token.slice(0, token.length - 1))
    groups.push([...terms])
  }
  return groups
}

const W_NAME = 8
const W_STRUCTURED = 4
const W_BODY = 1

export function scoreQuery(exercise, groups) {
  if (!groups.length) return { matched: true, score: 0 }
  const fields = fieldsFor(exercise)
  let score = 0

  for (const group of groups) {
    let best = 0
    for (const term of group) {
      if (fields.name.includes(term)) best = Math.max(best, W_NAME)
      else if (fields.structured.includes(term)) best = Math.max(best, W_STRUCTURED)
      else if (fields.body.includes(term)) best = Math.max(best, W_BODY)
    }
    if (best === 0) return { matched: false, score: 0 }
    score += best
  }

  return { matched: true, score }
}
