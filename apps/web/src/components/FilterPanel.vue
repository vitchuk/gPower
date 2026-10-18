<script setup>
const props = defineProps({
  filters: { type: Object, required: true },
  modelValue: { type: Object, required: true },
})

const emit = defineEmits(['update:modelValue', 'reset'])

const groups = [
  { key: 'muscle', filtersKey: 'muscles', label: 'Мышцы' },
  { key: 'equipment', filtersKey: 'equipment', label: 'Снаряжение' },
  { key: 'level', filtersKey: 'levels', label: 'Уровень' },
  { key: 'force', filtersKey: 'forces', label: 'Усилие' },
  { key: 'mechanic', filtersKey: 'mechanics', label: 'Тип' },
  { key: 'category', filtersKey: 'categories', label: 'Категория' },
]

function update(key, event) {
  emit('update:modelValue', { ...props.modelValue, [key]: event.target.value })
}
</script>

<template>
  <aside class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h2 class="font-semibold">Фильтры</h2>
      <button class="text-xs text-emerald-600 hover:underline" @click="emit('reset')">
        Сбросить
      </button>
    </div>

    <label v-for="group in groups" :key="group.key" class="flex flex-col gap-1">
      <span class="text-xs uppercase tracking-wide text-slate-500">{{ group.label }}</span>
      <select
        :value="modelValue[group.key]"
        class="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
        @change="update(group.key, $event)"
      >
        <option value="">— любой —</option>
        <option v-for="opt in filters[group.filtersKey]" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </label>
  </aside>
</template>
