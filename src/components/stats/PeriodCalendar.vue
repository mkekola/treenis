<script setup lang="ts">
import { computed } from 'vue'
import { formatDurationShort } from '@/lib/format'
import { addDays, heatLevel, type Period } from '@/lib/stats'

const props = defineProps<{ period: Period; byDay: Map<string, number>; today: string }>()

const WEEKDAYS = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su']

/** Kuukausi tai viikko kalenterina, viikko alkaa maanantaista. */
const days = computed(() => {
  const list: { date: string; day: number; level: number; future: boolean; label: string }[] = []
  for (let date = props.period.start; date < props.period.end; date = addDays(date, 1)) {
    const seconds = props.byDay.get(date)
    const d = new Date(`${date}T00:00:00`)
    list.push({
      date,
      day: d.getDate(),
      level: heatLevel(seconds),
      future: date > props.today,
      label: `${d.getDate()}.${d.getMonth() + 1}.: ${seconds ? formatDurationShort(seconds) : 'ei treeniä'}`,
    })
  }
  return list
})

const leadingBlanks = computed(() => (new Date(`${props.period.start}T00:00:00`).getDay() + 6) % 7)
</script>

<template>
  <div class="grid grid-cols-7 gap-1" role="list" aria-label="Treenipäivät">
    <span v-for="weekday in WEEKDAYS" :key="weekday" aria-hidden="true" class="text-center text-[11px] text-ink-muted">
      {{ weekday }}
    </span>
    <span v-for="n in leadingBlanks" :key="`tyhja-${n}`" aria-hidden="true" />
    <span
      v-for="day in days"
      :key="day.date"
      role="listitem"
      :aria-label="day.label"
      :title="day.label"
      :class="[day.level >= 3 ? 'text-[var(--c-on-heat)]' : '', day.future ? 'opacity-40' : '']"
      :style="{ background: day.level ? `var(--c-heat-${day.level})` : 'var(--c-track)' }"
      class="aspect-square rounded-[10px] px-1.5 py-1 text-xs"
      data-numeric
    >
      {{ day.day }}
    </span>
  </div>
</template>
