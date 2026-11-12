<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SportIcon from '@/components/SportIcon.vue'
import WorkoutForm from '@/components/WorkoutForm.vue'
import { useTheme } from '@/composables/useTheme'
import { copyInput, manualWorkout, newInput, type ManualInput } from '@/lib/manual'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useWorkouts } from '@/stores/workouts'
import { SPORT_LABELS, type SportKey } from '@/types/workout'

const route = useRoute()
const router = useRouter()
const store = useWorkouts()
const colors = useSportColors()
const { isDark } = useTheme()

const sport = computed(() => (route.params.sport as SportKey) in SPORT_LABELS ? (route.params.sport as SportKey) : 'other')
const vars = computed(() => sportVars(colors.swatchFor(sport.value), isDark.value))

/** Kopioi uudeksi tuo tehdyn treenin tiedot valmiiksi, muuten aloitetaan tyhjästä. */
const initial = computed<ManualInput>(() => {
  const source = store.workouts.find((w) => w.id === route.query.kopio)
  return source ? copyInput(source, new Date()) : newInput(sport.value, new Date())
})

async function save(input: ManualInput) {
  await store.save(manualWorkout(crypto.randomUUID(), input))
  await router.replace('/')
}
</script>

<template>
  <div :style="vars" class="flex min-h-full flex-col gap-4 px-5 pt-5 pb-6">
    <RouterLink
      to="/kirjaa"
      aria-label="Takaisin lajivalintaan"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <div class="flex items-center gap-3">
      <span aria-hidden="true" class="flex size-13 items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]">
        <SportIcon :sport="sport" />
      </span>
      <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">{{ SPORT_LABELS[sport] }}</h1>
    </div>

    <WorkoutForm :key="sport + String(route.query.kopio ?? '')" :initial="initial" submit-label="Tallenna treeni" @submit="save" />
    <p class="text-center text-xs text-ink-muted">
      Jos sama treeni tulee myöhemmin Stravasta, Treenis kysyy, yhdistetäänkö ne.
    </p>
  </div>
</template>
