<script setup lang="ts">
import { computed } from 'vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { inRotation, templatesOf } from '@/lib/program'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'
import { SPORT_LABELS, type SportKey } from '@/types/workout'

const programs = usePrograms()
const templates = useTemplates()
const colors = useSportColors()
const { isDark } = useTheme()

/**
 * Kolme lajia rivillä, ja jokainen rivi on oma kokonaisuutensa: kävely ja
 * juoksu, pyöräily ja kehonhallinta, vesi, talvi, sekä kiipeily ja muu.
 */
const SPORTS: SportKey[] = [
  'run', 'walk', 'hike',
  'bike', 'yoga', 'pilates',
  'swim', 'windsurf', 'kitesurf',
  'nordic', 'alpine', 'skating',
  'climb', 'other',
]

const vars = (sport: SportKey) => sportVars(colors.swatchFor(sport), isDark.value)

/** Sali on ylimpänä ja kertoo seuraavan treenin, jotta salille lähtiessä riittää yksi napautus. */
const next = computed(() => {
  const program = programs.active
  const first = program ? inRotation(templatesOf(program, templates.templates))[0] : undefined
  return first && program ? `Seuraavaksi ${first.name} · ${program.name}` : 'Valitse treeni tai aloita tyhjästä'
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

    <RouterLink
      to="/treeni/uusi"
      :style="vars('strength')"
      class="flex items-center gap-3 rounded-(--radius-card) bg-surface p-3.5"
    >
      <span aria-hidden="true" class="flex size-13 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]">
        <SportIcon sport="strength" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[17px] font-semibold tracking-[-0.01em]">Salitreeni</span>
        <span class="block text-[13px] text-ink-muted">{{ next }}</span>
      </span>
      <svg class="size-5 flex-none text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9,6 15,12 9,18" />
      </svg>
    </RouterLink>

    <h2 class="mt-2 text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Muut lajit</h2>
    <ul class="grid grid-cols-3 gap-2">
      <li v-for="sport in SPORTS" :key="sport">
        <RouterLink
          :to="`/kirjaa/${sport}`"
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
