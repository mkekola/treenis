<script setup lang="ts">
import { computed } from 'vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { planSummary } from '@/lib/cardio'
import { nextFor, weekGoals } from '@/lib/program'
import { exerciseCount } from '@/lib/template'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'
import { SPORT_LABELS, type SportKey } from '@/types/workout'

const programs = usePrograms()
const templates = useTemplates()
const workouts = useWorkouts()
const colors = useSportColors()
const { isDark } = useTheme()

/**
 * Kolme lajia rivillä, ja jokainen rivi on oma kokonaisuutensa: sali, pyöräily ja
 * kiipeily, kävely ja juoksu, vesi, talvi, sekä kehonhallinta ja muu.
 */
const SPORTS: SportKey[] = [
  'strength', 'bike', 'climb',
  'run', 'walk', 'hike',
  'swim', 'windsurf', 'kitesurf',
  'nordic', 'alpine', 'skating',
  'yoga', 'pilates', 'other',
]

/** Salitreeni aloitetaan valitsemalla pohja, muut lajit kirjataan lomakkeella. */
const linkOf = (sport: SportKey) => (sport === 'strength' ? '/treeni/uusi' : `/kirjaa/${sport}`)

const vars = (sport: SportKey) => sportVars(colors.swatchFor(sport), isDark.value)

/**
 * Käytössä oleva ohjelma kokonaisuutena: rivi per laji, jossa seuraava treeni ja
 * viikon tilanne ("0/2"). Salirivi vie salitreenin valintaan, kestävyysrivi
 * kirjaukseen valmiiksi täytettynä.
 */
const programRows = computed(() => {
  const program = programs.active
  if (!program) return []
  return weekGoals(program, templates.templates, workouts.workouts, new Date()).flatMap((goal) => {
    const next = nextFor(program, templates.templates, goal.sport)
    if (!next) return []
    const strength = goal.sport === 'strength'
    return [{
      ...goal,
      next,
      detail: strength ? `${exerciseCount(next)} liikettä` : planSummary(next) || SPORT_LABELS[goal.sport],
      to: strength ? '/treeni/uusi' : { path: `/kirjaa/${goal.sport}`, query: { pohja: next.id } },
    }]
  })
})

</script>

<template>
  <div class="flex min-h-full flex-col gap-3.5 px-5 pt-5 pb-6">
    <RouterLink
      to="/"
      aria-label="Takaisin päiväkirjaan"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Kirjaa treeni</h1>

    <section v-if="programRows.length && programs.active" aria-labelledby="ohjelma" class="rounded-(--radius-card) bg-surface px-3.5 pt-3 pb-1">
      <h2 id="ohjelma" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        {{ programs.active.name }}
      </h2>
      <ul>
        <li v-for="row in programRows" :key="row.sport" class="border-t border-line first:border-t-0">
          <RouterLink :to="row.to" :style="vars(row.sport)" class="flex items-center gap-3 py-2.5">
            <span aria-hidden="true" class="flex size-11 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)] [&_svg]:size-6">
              <SportIcon :sport="row.sport" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[16px] font-semibold tracking-[-0.01em]">
                <span class="sr-only">Seuraavaksi </span>{{ row.next.name }}
              </span>
              <span class="block truncate text-[13px] text-ink-muted" data-numeric>{{ row.detail }}</span>
            </span>
            <span
              class="flex-none text-[15px] font-semibold"
              :class="row.done >= row.target ? 'text-ink' : 'text-ink-muted'"
              data-numeric
            >
              <span class="sr-only">{{ SPORT_LABELS[row.sport] }} tällä viikolla </span>{{ row.done }}/{{ row.target }}
            </span>
            <svg class="size-5 flex-none text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9,6 15,12 9,18" />
            </svg>
          </RouterLink>
        </li>
      </ul>
    </section>

    <h2 class="mt-2 text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Kaikki lajit</h2>
    <ul class="grid grid-cols-3 gap-2">
      <li v-for="sport in SPORTS" :key="sport">
        <RouterLink
          :to="linkOf(sport)"
          :style="vars(sport)"
          class="flex min-h-22 flex-col items-center justify-center gap-1.5 rounded-[18px] bg-surface px-1.5 py-3 text-center text-[13px] font-semibold"
        >
          <span aria-hidden="true" class="flex size-11 items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]">
            <SportIcon :sport="sport" :size="24" />
          </span>
          {{ SPORT_LABELS[sport] }}
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
