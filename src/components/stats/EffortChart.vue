<script setup lang="ts">
import { computed, ref } from 'vue'
import { paceLabel, type EffortPoint } from '@/lib/endurance'
import { formatDistance, formatDurationShort, formatShortDate } from '@/lib/format'

/**
 * Vauhti ajan funktiona: yksi piste per juoksu. Nopeampi vauhti on ylempänä, jotta
 * kehitys näyttää nousulta. Viimeisin piste on korostettu ja nimetty suoraan.
 */
const props = defineProps<{ points: EffortPoint[]; from: string; to: string }>()

const WIDTH = 320
const HEIGHT = 168
const PAD = { top: 22, right: 14, bottom: 22, left: 34 }
const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu']

const dayMs = (iso: string) => new Date(`${iso}T00:00:00`).getTime()

/** Vauhtiasteikko 15 sekunnin portain, vähintään minuutin väli. */
const yScale = computed(() => {
  const paces = props.points.map((p) => p.paceSecPerKm)
  let low = Math.floor((Math.min(...paces) - 5) / 15) * 15
  let high = Math.ceil((Math.max(...paces) + 5) / 15) * 15
  if (high - low < 60) {
    const middle = (high + low) / 2
    low = Math.floor((middle - 30) / 15) * 15
    high = low + 60
  }
  return { low, high }
})

const x = (iso: string) => {
  const start = dayMs(props.from)
  const span = dayMs(props.to) - start || 1
  return PAD.left + ((dayMs(iso) - start) / span) * (WIDTH - PAD.left - PAD.right)
}
const y = (pace: number) => {
  const { low, high } = yScale.value
  return PAD.top + ((pace - low) / (high - low)) * (HEIGHT - PAD.top - PAD.bottom)
}

const plotted = computed(() => props.points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.paceSecPerKm) })))
const last = computed(() => plotted.value[plotted.value.length - 1])

/** Vaakaviivat pyöreisiin vauhteihin: 30 sekunnin välein, laajalla asteikolla minuutin. */
const yTicks = computed(() => {
  const { low, high } = yScale.value
  const step = high - low <= 120 ? 30 : 60
  const ticks: { pace: number; y: number }[] = []
  for (let pace = Math.ceil(low / step) * step; pace <= high; pace += step) ticks.push({ pace, y: y(pace) })
  return ticks
})

/** Kuukausien alut aikajanalla. */
const xTicks = computed(() => {
  const ticks: { label: string; x: number }[] = []
  const cursor = new Date(`${props.from}T00:00:00`)
  cursor.setDate(1)
  cursor.setMonth(cursor.getMonth() + 1)
  while (cursor.getTime() <= dayMs(props.to)) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`
    ticks.push({ label: MONTHS[cursor.getMonth()], x: x(iso) })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return ticks
})

const selectedId = ref<string | null>(null)
const selected = computed(() => props.points.find((p) => p.workoutId === selectedId.value) ?? null)

const detail = (p: EffortPoint) =>
  [
    formatShortDate(p.date),
    formatDurationShort(p.durationSec),
    formatDistance('run', p.distanceM),
    p.avgHr ? `syke ${p.avgHr}` : null,
    `${paceLabel(p.paceSecPerKm)} /km`,
  ]
    .filter(Boolean)
    .join(' · ')

const label = computed(() => {
  const first = props.points[0]
  const latest = props.points[props.points.length - 1]
  return `Vauhti ${props.points.length} juoksussa: ensimmäinen ${paceLabel(first.paceSecPerKm)}, viimeisin ${paceLabel(latest.paceSecPerKm)} minuuttia kilometrillä.`
})
</script>

<template>
  <div>
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="block h-auto w-full" role="img" :aria-label="label">
      <g aria-hidden="true">
        <g v-for="tick in yTicks" :key="tick.pace">
          <line :x1="PAD.left" :x2="WIDTH - PAD.right" :y1="tick.y" :y2="tick.y" stroke="var(--c-line)" stroke-width="1" />
          <text :x="PAD.left - 6" :y="tick.y + 3.5" text-anchor="end" font-size="10.5" fill="var(--c-ink-muted)" data-numeric>
            {{ paceLabel(tick.pace) }}
          </text>
        </g>
        <text
          v-for="tick in xTicks"
          :key="tick.label"
          :x="tick.x"
          :y="HEIGHT - 6"
          text-anchor="middle"
          font-size="10.5"
          fill="var(--c-ink-muted)"
        >
          {{ tick.label }}
        </text>

        <polyline
          v-if="plotted.length > 1"
          :points="plotted.map((p) => `${p.cx},${p.cy}`).join(' ')"
          fill="none"
          stroke="var(--c-data)"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.45"
        />
        <circle
          v-for="p in plotted"
          :key="p.workoutId"
          :cx="p.cx"
          :cy="p.cy"
          :r="p.workoutId === selectedId || p === last ? 5 : 4"
          fill="var(--c-data)"
          stroke="var(--c-surface)"
          stroke-width="2"
        />
        <circle
          v-if="selected"
          :cx="x(selected.date)"
          :cy="y(selected.paceSecPerKm)"
          r="9"
          fill="none"
          stroke="var(--c-ink)"
          stroke-width="1.5"
        />
        <text
          v-if="last"
          :x="Math.min(last.cx, WIDTH - PAD.right - 12)"
          :y="last.cy - 10"
          text-anchor="middle"
          font-size="11"
          font-weight="700"
          fill="var(--c-ink)"
          data-numeric
        >
          {{ paceLabel(last.paceSecPerKm) }}
        </text>
      </g>
      <!-- Osuma-alue pistettä isompi, jotta sormella osuu. -->
      <circle
        v-for="p in plotted"
        :key="`osuma-${p.workoutId}`"
        :cx="p.cx"
        :cy="p.cy"
        r="14"
        fill="transparent"
        class="cursor-pointer"
        aria-hidden="true"
        @click="selectedId = selectedId === p.workoutId ? null : p.workoutId"
      />
    </svg>
    <p class="min-h-5 text-[13px]" :class="selected ? 'text-ink' : 'text-ink-muted'" aria-live="polite" data-numeric>
      {{ selected ? detail(selected) : 'Napauta pistettä nähdäksesi juoksun.' }}
    </p>
  </div>
</template>
