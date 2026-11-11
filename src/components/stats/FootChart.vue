<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementWidth } from '@/composables/useElementWidth'
import type { Bucket } from '@/lib/stats'

/** Pylväät: kilometrit jalan. Väri tulee kutsujalta (--sport-on), jotta se vastaa lajiryhmää. */
const props = defineProps<{ buckets: Bucket[] }>()

const HEIGHT = 150
const TOP = 18
const BOTTOM = 20
const LEFT = 26
const BAR_MAX = 24
const RADIUS = 4

const box = useTemplateRef<HTMLElement>('box')
const width = useElementWidth(box)

const km = (meters: number) => meters / 1000
const fmt = (value: number, decimals = 0) =>
  value.toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const max = computed(() => Math.max(0, ...props.buckets.map((b) => km(b.meters))))
/** Akselin yläraja pyöreään lukuun, jotta jokainen merkintä on oikea arvo. */
const ceiling = computed(() => {
  const step = max.value > 40 ? 20 : max.value > 10 ? 10 : 2
  return Math.ceil(max.value / step) * step || step
})
const y = (value: number) => TOP + (HEIGHT - TOP - BOTTOM) * (1 - value / ceiling.value)
const slot = computed(() => (width.value - LEFT) / props.buckets.length)
const barWidth = computed(() => Math.min(BAR_MAX, slot.value * 0.62))

const bars = computed(() => {
  const peak = props.buckets.reduce((best, b) => (b.meters > best.meters ? b : best), props.buckets[0])
  return props.buckets.map((b, i) => {
    const value = km(b.meters)
    const x = LEFT + i * slot.value + (slot.value - barWidth.value) / 2
    const h = (HEIGHT - TOP - BOTTOM) * (value / ceiling.value)
    const r = Math.min(RADIUS, h)
    const w = barWidth.value
    // Pyöristetty pää ylhäällä, suora kulma perusviivalla.
    const path = h > 0 ? `M${x},${y(0)} v${-(h - r)} q0,-${r} ${r},-${r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z` : ''
    return { ...b, value, x, path, center: x + w / 2, peak: b === peak && value > 0 }
  })
})

const ticks = computed(() => [0, ceiling.value / 2, ceiling.value])
const summary = computed(() =>
  props.buckets.map((b) => `${b.title} ${fmt(km(b.meters), 1)} km`).join(', '),
)
</script>

<template>
  <div ref="box">
    <svg
      :width="width"
      :height="HEIGHT"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      role="img"
      :aria-label="`Kilometrit jalan: ${summary}`"
      class="block"
    >
      <g v-for="tick in ticks" :key="tick">
        <line :x1="LEFT" :x2="width" :y1="y(tick)" :y2="y(tick)" stroke="var(--c-line)" />
        <text x="0" :y="y(tick) + 3" class="fill-ink-muted text-[10px]">{{ fmt(tick) }}</text>
      </g>
      <g v-for="bar in bars" :key="bar.label + bar.x">
        <path v-if="bar.path" :d="bar.path" fill="var(--sport-on)">
          <title>{{ bar.title }}: {{ fmt(bar.value, 1) }} km</title>
        </path>
        <text
          v-if="bar.peak"
          :x="bar.center"
          :y="y(bar.value) - 5"
          text-anchor="middle"
          class="fill-ink text-[11px] font-semibold"
        >
          {{ fmt(bar.value, bar.value < 10 ? 1 : 0) }} km
        </text>
        <text
          :x="bar.center"
          :y="HEIGHT - 5"
          text-anchor="middle"
          :opacity="bar.future ? 0.5 : 1"
          class="fill-ink-muted text-[10px]"
        >
          {{ bar.label }}
        </text>
      </g>
    </svg>
  </div>
</template>
