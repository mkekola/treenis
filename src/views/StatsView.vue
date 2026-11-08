<script setup lang="ts">
import { computed } from 'vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { formatDistance, formatDurationShort, formatVolume } from '@/lib/format'
import { distanceM, durationSec, kindOf, totalVolumeKg } from '@/lib/workout'
import { useWorkouts } from '@/stores/workouts'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { SPORT_GROUP_LABELS, SPORT_GROUP_OF, type SportGroupKey } from '@/design/sportGroups'
import type { SportKey } from '@/types/workout'

const colors = useSportColors()
const { isDark } = useTheme()
const store = useWorkouts()
const workouts = computed(() => store.workouts)

const totalSeconds = computed(() =>
  workouts.value.reduce((sum, workout) => sum + durationSec(workout), 0),
)

/** Yhteenveto lajiryhmittäin: sama jako kuin värit, joten kaavio ja kortit vastaavat toisiaan. */
const summaries = computed(() => {
  const groups = new Map<SportGroupKey, { count: number; meters: number; volume: number; sport: SportKey }>()

  for (const workout of workouts.value) {
    const group = SPORT_GROUP_OF[workout.sport]
    const row = groups.get(group) ?? { count: 0, meters: 0, volume: 0, sport: workout.sport }
    row.count += 1
    row.meters += distanceM(workout) ?? 0
    if (kindOf(workout) === 'strength') row.volume += totalVolumeKg(workout)
    groups.set(group, row)
  }

  return [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([group, row]) => ({
      group,
      sport: row.sport,
      label: SPORT_GROUP_LABELS[group],
      count: row.count,
      detail:
        row.volume > 0
          ? `${formatVolume(row.volume)} yhteensä`
          : row.meters > 0
            ? `${formatDistance(row.sport, row.meters)} yhteensä`
            : '',
      vars: sportVars(colors.swatchForGroup(group), isDark.value),
    }))
})
</script>

<template>
  <div class="flex min-h-full flex-col gap-3.5 px-5 pt-6">
    <h1 class="font-display text-[32px] leading-[1.04] font-bold tracking-[-0.02em]">Tilastot</h1>

    <section class="rounded-(--radius-feature) bg-surface p-4.5">
      <p class="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
        Marraskuu 2026
      </p>
      <div class="mt-1 flex items-end justify-between gap-3">
        <p class="flex items-end gap-2.5">
          <span
            class="font-display text-[52px] leading-[0.95] font-bold tracking-[-0.035em]"
            data-numeric
          >
            {{ workouts.length }}
          </span>
          <span class="pb-1.5 text-[15px] text-ink-muted">treeniä</span>
        </p>
        <p class="pb-1.5 text-right">
          <span class="text-[17px] font-bold" data-numeric>
            {{ formatDurationShort(totalSeconds) }}
          </span>
          <span class="block text-[11px] text-ink-muted">yhteensä</span>
        </p>
      </div>
    </section>

    <!-- Vertailu: lajiryhmän väri täyttää pinnan. -->
    <section class="grid grid-cols-2 gap-2">
      <div
        v-for="summary in summaries"
        :key="summary.group"
        :style="summary.vars"
        class="rounded-(--radius-card) bg-[var(--sport-surface)] p-3.5"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-2xl font-bold tracking-[-0.02em]" data-numeric>{{ summary.count }}</p>
          <span aria-hidden="true" class="text-[var(--sport-on)]">
            <SportIcon :sport="summary.sport" :size="24" />
          </span>
        </div>
        <p class="mt-0.5 text-[11px] font-bold tracking-[0.06em] text-[var(--sport-on)] uppercase">
          {{ summary.label }}
        </p>
        <p v-if="summary.detail" class="mt-1 text-xs text-[var(--sport-on)]" data-numeric>
          {{ summary.detail }}
        </p>
      </div>
    </section>

    <p class="pb-4 text-xs text-ink-muted">
      Kaaviot ja ennätykset tulevat kun treenejä on tietokannassa. Nyt näkyvillä on
      esimerkkidataa.
    </p>
  </div>
</template>
