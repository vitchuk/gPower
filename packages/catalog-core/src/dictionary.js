const MUSCLES = {
  abdominals: 'Пресс',
  abductors: 'Отводящие мышцы бедра',
  adductors: 'Приводящие мышцы бедра',
  biceps: 'Бицепс',
  calves: 'Икры',
  chest: 'Грудь',
  forearms: 'Предплечья',
  glutes: 'Ягодицы',
  hamstrings: 'Бицепс бедра',
  lats: 'Широчайшие',
  'lower back': 'Поясница',
  'middle back': 'Середина спины',
  neck: 'Шея',
  quadriceps: 'Квадрицепс',
  shoulders: 'Плечи',
  traps: 'Трапеции',
  triceps: 'Трицепс',
}

const LEVEL = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  expert: 'Продвинутый',
}

const FORCE = {
  push: 'Толкающее',
  pull: 'Тянущее',
  static: 'Статическое',
}

const MECHANIC = {
  compound: 'Многосуставное',
  isolation: 'Изолирующее',
}

const EQUIPMENT = {
  'body only': 'Свой вес',
  barbell: 'Штанга',
  dumbbell: 'Гантели',
  cable: 'Блок',
  machine: 'Тренажёр',
  kettlebells: 'Гири',
  bands: 'Резинки',
  'medicine ball': 'Медбол',
  'exercise ball': 'Фитбол',
  'foam roll': 'Массажный ролл',
  'e-z curl bar': 'EZ-гриф',
  other: 'Другое',
}

const CATEGORY = {
  strength: 'Силовые',
  powerlifting: 'Пауэрлифтинг',
  'olympic weightlifting': 'Тяжёлая атлетика',
  strongman: 'Стронгмен',
  plyometrics: 'Плиометрика',
  cardio: 'Кардио',
  stretching: 'Растяжка',
}

const MAPS = {
  muscle: MUSCLES,
  level: LEVEL,
  force: FORCE,
  mechanic: MECHANIC,
  equipment: EQUIPMENT,
  category: CATEGORY,
}

export function labelFor(kind, value) {
  if (value == null) return '—'
  return MAPS[kind]?.[value] ?? value
}
