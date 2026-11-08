<script setup lang="ts">
import { computed } from 'vue'
import WorkoutCard from '@/components/WorkoutCard.vue'
import { useTheme } from '@/composables/useTheme'
import { formatDurationShort } from '@/lib/format'
import { durationSec } from '@/lib/workout'
import { useWorkouts } from '@/stores/workouts'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { SPORT_GROUP_LABELS, SPORT_GROUP_OF, type SportGroupKey } from '@/design/sportGroups'

const colors = useSportColors()
const { isDark } = useTheme()

const store = useWorkouts()
const workouts = computed(() => store.workouts)

const sorted = computed(() => [...workouts.value].sort((a, b) => b.date.localeCompare(a.date)))

const totalSeconds = computed(() => workouts.value.reduce((sum, w) => sum + durationSec(w), 0))

/** Ryhmät yleisimmästä harvinaisimpaan, palkkia ja selitettä varten. */
const byGroup = computed(() => {
  const counts = new Map<SportGroupKey, number>()
  for (const workout of workouts.value) {
    const group = SPORT_GROUP_OF[workout.sport]
    counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([group, count]) => ({
      group,
      count,
      label: SPORT_GROUP_LABELS[group],
      vars: sportVars(colors.swatchForGroup(group), isDark.value),
    }))
})
</script>

<template>
  <div class="flex min-h-full flex-col">
    <header class="flex items-center justify-between gap-3 px-5 pt-6">
      <div class="flex min-w-0 items-center gap-2.5">
        <span
          :style="sportVars(colors.swatchForGroup('strength'), isDark)"
          class="flex size-11 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[15px] font-bold text-[var(--sport-on)]"
        >
          MK
        </span>
        <div class="min-w-0">
          <p class="text-xs text-ink-muted">Keskiviikko 12.11.</p>
          <p class="text-[15px] font-semibold tracking-[-0.01em]">Hei Maria</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Haku"
        class="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface"
      >
        <svg
          class="size-[19px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </button>
    </header>

    <!-- Yhteenveto: täällä väri vertailee, joten se saa täyttää pinnan. -->
    <section class="px-5 pt-4.5">
      <h1 class="font-display text-[32px] leading-[1.04] font-bold tracking-[-0.02em]">
        Tämä viikko
      </h1>

      <div class="mt-3.5 rounded-(--radius-feature) bg-surface p-4">
        <div class="flex items-end justify-between gap-3">
          <p class="flex items-end gap-2">
            <span
              class="font-display text-[40px] leading-[0.95] font-bold tracking-[-0.03em]"
              data-numeric
            >
              {{ workouts.length }}
            </span>
            <span class="pb-1 text-sm text-ink-muted">treeniä</span>
          </p>
          <p class="text-right">
            <span class="text-[17px] font-bold" data-numeric>
              {{ formatDurationShort(totalSeconds) }}
            </span>
            <span class="block text-[11px] text-ink-muted">yhteensä</span>
          </p>
        </div>

        <div class="mt-3 flex h-2.5 gap-[3px]" aria-hidden="true">
          <span
            v-for="row in byGroup"
            :key="row.group"
            :style="{ ...row.vars, flexGrow: row.count }"
            class="flex-1 rounded-full bg-[var(--sport-surface)]"
          />
        </div>

        <ul class="mt-2 flex flex-wrap gap-x-3.5 gap-y-2.5 text-[11px] text-ink-muted">
          <li v-for="row in byGroup" :key="row.group" class="inline-flex items-center gap-1.5">
            <span
              :style="row.vars"
              aria-hidden="true"
              class="size-2.5 rounded-[3px] bg-[var(--sport-surface)]"
            />
            {{ row.label }} {{ row.count }}
          </li>
        </ul>
      </div>
    </section>

    <!-- Aikajana: täällä luetaan, joten kortit pysyvät valkoisina. -->
    <section class="flex flex-1 flex-col gap-2 px-5 pt-4.5">
      <div class="flex items-baseline justify-between">
        <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Marraskuu
        </h2>
        <RouterLink to="/tilastot" class="text-[13px] font-semibold text-ink">
          Kaikki
        </RouterLink>
      </div>

      <WorkoutCard
        v-for="workout in sorted"
        :key="workout.id"
        :workout="workout"
        @confirm-match="store.confirmMatch"
        @reject-match="store.rejectMatch"
      />

      <p v-if="!sorted.length" class="py-6 text-center text-sm text-ink-muted">
        Ei vielä treenejä. Kirjaa ensimmäinen alta.
      </p>
    </section>

    <div class="px-5 pt-3">
      <RouterLink
        to="/treeni/uusi"
        class="flex min-h-13 items-center justify-center gap-2 rounded-(--radius-button) bg-action text-base font-semibold tracking-[-0.01em] text-on-action"
      >
        <svg
          class="size-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Kirjaa treeni
      </RouterLink>
    </div>
  </div>
</template>
