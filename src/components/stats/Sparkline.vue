<script setup lang="ts">
import { computed } from 'vue'

/** Pieni kehityskäyrä ilman akseleita. Viimeinen piste korostettuna. */
const props = defineProps<{ values: number[]; label: string }>()

const WIDTH = 96
const HEIGHT = 32
const INSET = 5

const points = computed(() => {
  const min = Math.min(...props.values)
  const max = Math.max(...props.values)
  const span = max - min || 1
  return props.values.map((v, i) => ({
    x: INSET + (i * (WIDTH - 2 * INSET)) / Math.max(1, props.values.length - 1),
    // Tasainen sarja piirtyy keskelle, ei pohjalle.
    y: max === min ? HEIGHT / 2 : HEIGHT - INSET - ((HEIGHT - 2 * INSET) * (v - min)) / span,
  }))
})
const last = computed(() => points.value[points.value.length - 1])
</script>

<template>
  <svg :width="WIDTH" :height="HEIGHT" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="img" :aria-label="label" class="block">
    <polyline
      :points="points.map((p) => `${p.x},${p.y}`).join(' ')"
      fill="none"
      stroke="var(--c-data)"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <circle :cx="last.x" :cy="last.y" r="4" fill="var(--c-data)" stroke="var(--c-surface)" stroke-width="2" />
  </svg>
</template>
