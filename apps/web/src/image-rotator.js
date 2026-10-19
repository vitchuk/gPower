import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export function useImageRotator(sources, intervalMs = 1000, autostart = true) {
  const index = ref(0)
  const playing = ref(false)
  let timer = null

  const count = computed(() => sources.value?.length || 0)
  const current = computed(() => {
    if (!count.value) return null
    return sources.value[index.value % count.value]
  })

  function advance() {
    if (count.value > 1) index.value = (index.value + 1) % count.value
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function play() {
    if (playing.value || count.value < 2) return
    playing.value = true
    timer = setInterval(advance, intervalMs)
  }

  function pause() {
    playing.value = false
    stop()
  }

  function toggle() {
    playing.value ? pause() : play()
  }

  function preload() {
    for (const url of sources.value || []) {
      if (!url) continue
      const img = new Image()
      img.src = url
      if (img.decode) img.decode().catch(() => {})
    }
  }

  watch(count, () => {
    index.value = 0
    if (autostart && count.value > 1) play()
    else if (count.value < 2) pause()
  })

  watch(
    sources,
    () => {
      index.value = 0
      preload()
    },
    { immediate: true },
  )

  onMounted(() => {
    if (autostart) play()
  })

  onBeforeUnmount(stop)

  return { index, count, current, playing, advance, play, pause, toggle }
}
