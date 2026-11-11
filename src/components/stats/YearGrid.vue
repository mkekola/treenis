<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useElementWidth } from '@/composables/useElementWidth'
import { formatDurationShort } from '@/lib/format'
import { heatLevel } from '@/lib/stats'

const props = defineProps<{ year: number; byDay: Map<string, number>; today: string }>()

const MONTHS = ['Tam', 'Hel', 'Maa', 'Huh', 'Tou', 'Kes', 'Hei', 'Elo', 'Syy', 'Lok', 'Mar', 'Jou']
const LEFT = 30
const GAP = 1.5
const ROW = 11
const ROW_GAP = 3

const box = useTemplateRef<HTMLElement>('box')
const width = useElementWidth(box)
const cellWidth = computed(() => (width.value - LEFT) / 31 - GAP)
const height = 12 * (ROW + ROW_GAP) + 14

const pad = (n: number) => String(n).padStart(2, '0')

/** Vuosi riveinä: jokainen kuukausi on rivi ja jokainen päivä ruutu. Puhelimen levyyn mahtuu 31 saraketta. */
const cells = computed(() =>
  MONTHS.flatMap((_, m) => {
    const days = new Date(props.year, m + 1, 0).getDate()
    return Array.from({ length: days }, (_, i) => {
      const date = `${props.year}-${pad(m + 1)}-${pad(i + 1)}`
      const seconds = props.byDay.get(date)
      return {
        date,
        x: LEFT + i * (cellWidth.value + GAP),
        y: m * (ROW + ROW_GAP),
        level: heatLevel(seconds),
        future: date > props.today,
        title: `${i + 1}.${m + 1}. ${seconds ? formatDurationShort(seconds) : 'ei treeniä'}`,
      }
    })
  }),
)

const dayTicks = computed(() =>
  [1, 10, 20, 31].map((d) => ({ d, x: LEFT + (d - 1) * (cellWidth.value + GAP) + cellWidth.value / 2 })),
)
</script>

<template>
  <div ref="box">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="`Treenipäivät vuonna ${year}. Ruudun tummuus kertoo päivän treeniajan.`"
      class="block"
    >
      <text
        v-for="(name, m) in MONTHS"
        :key="name + m"
        x="0"
        :y="m * (ROW + ROW_GAP) + ROW - 2"
        class="fill-ink-muted text-[10px]"
      >
        {{ name }}
      </text>
      <rect
        v-for="cell in cells"
        :key="cell.date"
        :x="cell.x"
        :y="cell.y"
        :width="cellWidth"
        :height="ROW"
        rx="2"
        :fill="cell.level ? `var(--c-heat-${cell.level})` : 'var(--c-track)'"
        :opacity="cell.future ? 0.35 : 1"
      >
        <title>{{ cell.title }}</title>
      </rect>
      <text
        v-for="tick in dayTicks"
        :key="tick.d"
        :x="tick.x"
        :y="height - 2"
        text-anchor="middle"
        class="fill-ink-muted text-[10px]"
      >
        {{ tick.d }}
      </text>
    </svg>
  </div>
</template>
