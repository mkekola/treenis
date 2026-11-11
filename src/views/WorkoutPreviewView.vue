<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RecoveryCard from '@/components/RecoveryCard.vue'
import { formatDurationShort } from '@/lib/format'
import { buildSession } from '@/lib/session'
import { estimateDurationSec, setCount, exerciseCount } from '@/lib/template'
import { useExercises } from '@/stores/exercises'
import { usePrograms } from '@/stores/programs'
import { useSession } from '@/stores/session'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'
import type { SessionExercise } from '@/types/session'

const route = useRoute()
const router = useRouter()
const templates = useTemplates()
const programs = usePrograms()
const exercises = useExercises()
const workouts = useWorkouts()
const session = useSession()

const template = computed(() => templates.templates.find((t) => t.id === route.params.templateId))
const program = computed(() => (template.value ? programs.ownerOf(template.value.id) : undefined))

/**
 * Esikatselu rakennetaan samalla logiikalla kuin oikea treeni, mutta sitä ei
 * tallenneta. Näin painot ja nousuehdotukset ovat samat, jotka treenissä näkyvät.
 */
const preview = computed(() =>
  template.value
    ? buildSession({
        id: 'esikatselu',
        now: new Date(),
        template: template.value,
        history: workouts.workouts,
        exercises: (id) => exercises.byId.get(id),
      })
    : null,
)

const nameOf = (id: string) => exercises.byId.get(id)?.name ?? 'Tuntematon liike'
const perSide = (id: string) => exercises.byId.get(id)?.perSide ?? false

const kgFormat = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 })
const kg = (value: number) => kgFormat.format(value)

function targetText(entry: SessionExercise): string {
  const value = entry.measurement === 'time' ? `${entry.sets[0]?.durationSec ?? 0} s` : String(entry.target.reps)
  const sides = perSide(entry.exerciseId) ? ' per puoli' : ''
  const previous = entry.hint && entry.previous ? ` · viimeksi ${kg(entry.previous.weightKg)} kg` : ''
  return `${entry.sets.length} × ${value}${sides}${previous}`
}

/** Tämän kerran paino: ehdotettu muutos korostettuna, muuten edellisen kerran paino. */
function weightText(
  entry: SessionExercise,
): { text: string; hint?: 'increase' | 'decrease'; first?: boolean } | null {
  if (entry.measurement !== 'weight_reps') return null
  if (entry.hint) {
    const arrow = entry.hint.kind === 'increase' ? '↑' : '↓'
    return { text: `${arrow} ${kg(entry.hint.toKg)} kg`, hint: entry.hint.kind }
  }
  const weight = entry.sets[0]?.weightKg
  return weight !== undefined ? { text: `${kg(weight)} kg` } : { text: 'Ensimmäinen kerta', first: true }
}

/** Liikkeiden juokseva numerointi lohkojen yli. */
const numbered = computed(() => {
  let n = 0
  return (preview.value?.blocks ?? []).map((block) => ({
    ...block,
    exercises: block.exercises.map((entry) => ({ entry, number: ++n })),
  }))
})

async function begin() {
  if (!template.value || session.recovery) return
  await session.start(template.value)
  await router.push('/treeni')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col gap-3 px-5 pt-5 pb-28">
    <RouterLink
      to="/treeni/uusi"
      aria-label="Takaisin treenin valintaan"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>

    <p v-if="!template || !preview" class="py-6 text-center text-sm text-ink-muted">
      Treeniä ei löytynyt. Se on ehkä poistettu toisella laitteella.
    </p>

    <template v-else>
      <header class="flex flex-col gap-1">
        <p
          v-if="program"
          class="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase"
        >
          {{ program.name }}
        </p>
        <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">
          {{ template.name }}
        </h1>
      </header>

      <ul class="flex flex-wrap gap-1.5 text-[13px] font-semibold" data-numeric>
        <li class="rounded-full bg-surface px-3 py-1">{{ exerciseCount(template) }} liikettä</li>
        <li class="rounded-full bg-surface px-3 py-1">{{ setCount(template) }} sarjaa</li>
        <li v-if="estimateDurationSec(template)" class="rounded-full bg-surface px-3 py-1">
          noin {{ formatDurationShort(estimateDurationSec(template)) }}
        </li>
      </ul>

      <p v-if="!numbered.length" class="text-[13px] text-ink-muted">
        Treenissä ei ole vielä liikkeitä.
      </p>

      <!-- Lohko: yksittäinen liike tai supersarja, kuten muokkauksessa ja treenin aikana. -->
      <section
        v-for="block in numbered"
        :key="block.id"
        :aria-label="block.exercises.length > 1 ? 'Supersarja' : undefined"
        :class="block.exercises.length > 1 ? 'border-l-4 border-line pl-2.5' : ''"
        class="flex flex-col gap-2"
      >
        <p
          v-if="block.exercises.length > 1"
          class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
        >
          Supersarja · lepo {{ block.restSec }} s kierroksen jälkeen
        </p>
        <div
          v-for="{ entry, number } in block.exercises"
          :key="number"
          class="flex items-center gap-3 rounded-(--radius-card) bg-surface px-3.5 py-3"
        >
          <span
            class="flex size-7 flex-none items-center justify-center rounded-full bg-track text-[12px] font-bold"
            aria-hidden="true"
            data-numeric
          >
            {{ number }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-semibold">{{ nameOf(entry.exerciseId) }}</span>
            <span class="block text-[13px] text-ink-muted" data-numeric>{{ targetText(entry) }}</span>
          </span>
          <span
            v-if="weightText(entry)"
            class="flex-none whitespace-nowrap"
            :class="[
              weightText(entry)?.first ? 'text-[13px] font-medium text-ink-muted' : 'text-[14px] font-bold',
              weightText(entry)?.hint ? 'rounded-full bg-track px-2.5 py-0.5' : '',
            ]"
            data-numeric
          >
            <span v-if="weightText(entry)?.hint" class="sr-only">
              {{ weightText(entry)?.hint === 'increase' ? 'Ehdotettu nosto:' : 'Ehdotettu lasku:' }}
            </span>
            {{ weightText(entry)?.text }}
          </span>
        </div>
      </section>

      <RouterLink
        v-if="program"
        :to="{ name: 'template-edit', params: { programId: program.id, id: template.id } }"
        class="mt-1 self-center py-2 text-sm font-semibold text-ink-muted underline"
      >
        Muokkaa treeniä
      </RouterLink>

      <!-- Keskeneräinen treeni ratkaistaan ensin, jotta kahta ei ole käynnissä yhtä aikaa. -->
      <template v-if="session.recovery">
        <p class="text-[13px] text-ink-muted">
          Päätä tai hylkää keskeneräinen treeni ennen kuin aloitat uuden.
        </p>
        <RecoveryCard />
      </template>

      <!-- Kelluva aloitus: pysyy peukalon ulottuvilla, kun listaa vierittää. -->
      <div
        v-else
        class="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[480px] bg-gradient-to-t from-bg from-60% to-transparent px-5 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <button
          type="button"
          :disabled="!numbered.length"
          class="min-h-13 w-full rounded-full bg-action text-base font-semibold text-on-action disabled:opacity-50"
          @click="begin"
        >
          Aloita treeni
        </button>
      </div>
    </template>
  </div>
</template>
