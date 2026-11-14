<script setup lang="ts">
import { computed } from 'vue'
import SportIcon from './SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { formatClock, formatDurationShort, formatShortDate, workoutMetrics } from '@/lib/format'
import { isFromStrava } from '@/lib/workout'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { SPORT_LABELS, type Workout } from '@/types/workout'

const props = defineProps<{ workout: Workout }>()
const emit = defineEmits<{ open: [string]; confirmMatch: [string]; rejectMatch: [string] }>()

const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor(props.workout.sport), isDark.value))
const metrics = computed(() => workoutMetrics(props.workout))
const fromStrava = computed(() => isFromStrava(props.workout))
const pending = computed(() => props.workout.pendingMatch)
</script>

<template>
  <article :style="vars" class="rounded-(--radius-card) bg-surface">
    <!-- Koko yläosa avaa tiedot. Hiiri ja kosketus osuvat mihin tahansa kohtaan, ja otsikon
         painike vie näppäimistöllä samaan, koska sen painallus kulkee tänne. -->
    <div class="flex cursor-pointer items-center gap-3 p-3.5" @click="emit('open', workout.id)">
      <span
        aria-hidden="true"
        class="flex size-13 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]"
      >
        <SportIcon :sport="workout.sport" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-2">
          <span class="inline-flex items-center gap-1.5">
            <span class="text-[11px] font-bold tracking-[0.08em] text-[var(--sport-on)] uppercase">
              {{ SPORT_LABELS[workout.sport] }}
            </span>
            <span
              v-if="fromStrava"
              class="rounded-full border border-current px-1.5 py-px text-[9.5px] font-bold tracking-[0.06em] text-[var(--sport-on)] uppercase"
            >
              Strava
            </span>
          </span>
          <span class="text-[11px] text-ink-muted" data-numeric>
            {{ formatShortDate(workout.date) }}
          </span>
        </div>

        <h3 class="mt-0.5 text-base font-semibold tracking-[-0.01em]">
          <button
            type="button"
            class="block w-full truncate rounded-[4px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {{ workout.title }}
          </button>
        </h3>

        <p class="mt-1 flex flex-wrap gap-x-3.5 text-[13px] text-ink-muted" data-numeric>
          <span v-for="metric in metrics" :key="metric">{{ metric }}</span>
        </p>
      </div>
    </div>

    <!-- Epävarma osuma: Treenis ei yhdistä näitä itse, vaan kysyy. -->
    <div v-if="pending" class="border-t border-line px-3.5 py-3">
      <p class="text-[13px]">
        Stravassa on treeni samaan aikaan:
        <span class="font-semibold" data-numeric
          >{{ pending.stravaSportName }} klo {{ formatClock(pending.startedAt) }},
          {{ formatDurationShort(pending.durationSec) }}</span
        >. Onko tämä sama treeni?
      </p>
      <div class="mt-2.5 flex gap-2">
        <button
          type="button"
          class="min-h-10 flex-1 rounded-(--radius-button) bg-action text-sm font-semibold text-on-action"
          @click="emit('confirmMatch', workout.id)"
        >
          Sama treeni
        </button>
        <button
          type="button"
          class="min-h-10 flex-1 rounded-(--radius-button) border border-line text-sm font-semibold"
          @click="emit('rejectMatch', workout.id)"
        >
          Eri treeni
        </button>
      </div>
    </div>
  </article>
</template>
