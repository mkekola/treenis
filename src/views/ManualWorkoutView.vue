<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SportIcon from '@/components/SportIcon.vue'
import WorkoutForm from '@/components/WorkoutForm.vue'
import { useTheme } from '@/composables/useTheme'
import { goalText, isCardio, planTotals, segmentText } from '@/lib/cardio'
import { copyInput, manualWorkout, newInput, type ManualInput } from '@/lib/manual'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'
import { SPORT_LABELS, type SportKey } from '@/types/workout'

const route = useRoute()
const router = useRouter()
const store = useWorkouts()
const templates = useTemplates()
const programs = usePrograms()
const colors = useSportColors()
const { isDark } = useTheme()

const sport = computed(() => (route.params.sport as SportKey) in SPORT_LABELS ? (route.params.sport as SportKey) : 'other')
const vars = computed(() => sportVars(colors.swatchFor(sport.value), isDark.value))

/** Ohjelman kestävyyspohja, josta treeni kirjataan: nimi valmiiksi ja suunnitelma näkyviin. */
const plan = computed(() => {
  const template = templates.templates.find((t) => t.id === route.query.pohja)
  return template && isCardio(template) && template.sport === sport.value ? template : undefined
})

const backTo = computed(() => {
  const owner = plan.value ? programs.ownerOf(plan.value.id) : undefined
  return owner && plan.value
    ? { name: 'template-edit', params: { programId: owner.id, id: plan.value.id } }
    : { path: '/kirjaa' }
})

/**
 * Kopioi uudeksi tuo tehdyn treenin tiedot valmiiksi. Pohjasta tulee nimi, ja pelkästä
 * ajasta tai pelkästä matkasta koostuva suunnitelma täyttää keston tai matkan.
 * Muuten aloitetaan tyhjästä.
 */
const initial = computed<ManualInput>(() => {
  const source = store.workouts.find((w) => w.id === route.query.kopio)
  if (source) return copyInput(source, new Date())
  const input = newInput(sport.value, new Date())
  if (!plan.value) return input
  const { timeSec, distanceM } = planTotals(plan.value)
  return {
    ...input,
    title: plan.value.name,
    ...(timeSec && !distanceM ? { durationSec: Math.round(timeSec) } : {}),
    ...(distanceM && !timeSec ? { distanceM: Math.round(distanceM) } : {}),
  }
})

const saveError = ref('')

async function save(input: ManualInput) {
  saveError.value = ''
  try {
    const workout = manualWorkout(crypto.randomUUID(), input)
    await store.save(plan.value ? { ...workout, templateId: plan.value.id } : workout)
    if (plan.value) await templates.save({ ...plan.value, lastUsedAt: new Date().toISOString() })
  } catch {
    saveError.value = 'Tallennus ei onnistunut. Yritä uudelleen.'
    return
  }
  await router.replace('/')
}
</script>

<template>
  <div :style="vars" class="flex min-h-full flex-col gap-4 px-5 pt-5 pb-6">
    <RouterLink
      :to="backTo"
      :aria-label="plan ? `Takaisin: ${plan.name}` : 'Takaisin lajivalintaan'"
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

    <!-- Suunnitelma pohjasta: mitä piti tehdä, kun kirjataan mitä tehtiin. -->
    <section v-if="plan" aria-labelledby="suunnitelma" class="rounded-(--radius-card) bg-surface p-3.5">
      <h2 id="suunnitelma" class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Suunnitelma · {{ plan.name }}
      </h2>
      <ul class="mt-1.5 flex flex-col gap-1 text-[15px]" data-numeric>
        <li v-for="segment in plan.segments" :key="segment.id">
          <span v-if="segment.name" class="font-semibold">{{ segment.name }} · </span>{{ segmentText(segment) }}
          <span v-if="goalText(segment)" class="text-ink-muted"> · {{ goalText(segment) }}</span>
        </li>
      </ul>
    </section>

    <WorkoutForm :key="sport + String(route.query.kopio ?? '') + String(route.query.pohja ?? '')" :initial="initial" submit-label="Tallenna treeni" :error="saveError" @submit="save" />
    <p class="text-center text-xs text-ink-muted">
      Jos sama treeni tulee myöhemmin Stravasta, Treenis kysyy, yhdistetäänkö ne.
    </p>
  </div>
</template>
