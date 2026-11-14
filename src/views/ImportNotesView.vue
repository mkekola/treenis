<script setup lang="ts">
import { computed, ref } from 'vue'
import ExercisePicker from '@/components/ExercisePicker.vue'
import { formatShortDate } from '@/lib/format'
import { matchExercise, parseNotes, setsSummary, toWorkout, type ParsedWorkout } from '@/lib/notesImport'
import { useExercises } from '@/stores/exercises'
import { useWorkouts } from '@/stores/workouts'
import type { Exercise } from '@/types/workout'

const exercises = useExercises()
const workouts = useWorkouts()

/** Esikatselun treeni: tulkinta, valinta tuodaanko ja jokaisen liikkeen osuma kirjastosta. */
interface Draft {
  parsed: ParsedWorkout
  include: boolean
  /** null: kirjastosta ei löytynyt, joten liike luodaan omaksi liikkeeksi. */
  matches: (Exercise | null)[]
}

const text = ref('')
const drafts = ref<Draft[] | null>(null)
const done = ref(0)

function interpret() {
  done.value = 0
  drafts.value = parseNotes(text.value, new Date()).map((parsed) => ({
    parsed,
    include: parsed.exercises.length > 0,
    matches: parsed.exercises.map((e) => matchExercise(e.name, exercises.all, e.hint) ?? null),
  }))
}

const importable = computed(() => (drafts.value ?? []).filter((d) => d.include && d.parsed.exercises.length))

/** Samana päivänä on jo salitreeni: voi olla sama treeni, joka on jo kirjattu. */
function hasDuplicate(date: string) {
  return workouts.workouts.some((w) => w.date === date && w.sport === 'strength')
}

// Liikkeen vaihto esikatselussa.
const picking = ref<{ draft: number; exercise: number } | null>(null)
function pick(exercise: Exercise) {
  if (!picking.value || !drafts.value) return
  drafts.value[picking.value.draft].matches[picking.value.exercise] = exercise
  picking.value = null
}

const busy = ref(false)

async function save() {
  busy.value = true
  const chosen = importable.value
  for (const draft of chosen) {
    // Kirjastosta löytymätön liike luodaan omaksi liikkeeksi kirjoitetulla nimellä.
    const ids = new Map(
      draft.parsed.exercises.map((parsed, index) => [
        parsed,
        draft.matches[index]?.id ??
          exercises.addCustom({
            name: parsed.name,
            muscleGroup: 'full_body',
            measurement: parsed.sets.some((s) => s.weightKg !== undefined) ? 'weight_reps' : 'reps',
            perSide: false,
          }).id,
      ]),
    )
    await workouts.save(toWorkout(draft.parsed, (parsed) => ids.get(parsed)!, crypto.randomUUID()))
  }
  done.value = chosen.length
  drafts.value = null
  text.value = ''
  busy.value = false
}

const EXAMPLE = `Ma 10.11. Treeni 1
Jalkakyykky 3x10 60kg
Penkki 45/8 45/8 47,5/6

12.11.
Kyykky
60x10
65x8
Soutu 40kg 12-12-10`
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <RouterLink
      to="/asetukset/tiedot"
      aria-label="Takaisin omiin tietoihin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <h1 class="-mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Tuo muistiinpanoista</h1>

    <p v-if="done" role="status" class="rounded-(--radius-card) bg-surface p-3.5 text-[15px]">
      {{ done === 1 ? '1 treeni tuotu' : `${done} treeniä tuotu` }} päiväkirjaan.
      <RouterLink to="/" class="font-semibold underline">Päiväkirjaan</RouterLink>
    </p>

    <!-- 1. Teksti -->
    <form v-if="!drafts" class="flex flex-col gap-3" @submit.prevent="interpret">
      <p class="text-[15px] text-ink-muted">
        Liitä vanhat salitreenimuistiinpanosi. Treenis tunnistaa päivämäärät ja liikerivit, ja näet
        esikatselun ennen kuin mitään tallennetaan.
      </p>
      <details class="rounded-(--radius-card) bg-surface p-3.5 text-[13px]">
        <summary class="cursor-pointer font-semibold">Tunnistettavat muodot</summary>
        <pre class="mt-2 font-sans whitespace-pre-wrap text-ink-muted">{{ EXAMPLE }}</pre>
        <p class="mt-2 text-ink-muted">
          Päivämäärärivi aloittaa treenin. Teksti, jota ei tunnisteta liikkeeksi tai sarjaksi, tallennetaan
          treenin muistiinpanoksi, joten mitään ei katoa.
        </p>
      </details>
      <label for="muistiinpanot" class="sr-only">Muistiinpanot</label>
      <textarea
        id="muistiinpanot"
        v-model="text"
        rows="10"
        placeholder="Liitä muistiinpanot tähän"
        class="rounded-(--radius-field) border border-line bg-bg p-3 text-base placeholder:text-ink-muted"
      />
      <button
        type="submit"
        :disabled="!text.trim()"
        class="min-h-12 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-40"
      >
        Tulkitse
      </button>
    </form>

    <!-- 2. Esikatselu -->
    <template v-else>
      <p class="text-[15px]" role="status">
        {{ drafts.length ? `Löytyi ${drafts.length === 1 ? '1 treeni' : `${drafts.length} treeniä`}.` : 'Tekstistä ei löytynyt treenejä.' }}
        Tarkista liikkeet ennen tuontia.
      </p>

      <article
        v-for="(draft, d) in drafts"
        :key="d"
        class="rounded-(--radius-card) bg-surface p-3.5"
        :class="draft.include ? '' : 'opacity-60'"
      >
        <div class="flex items-center gap-3">
          <label class="flex min-h-11 flex-1 items-center gap-3">
            <input v-model="draft.include" type="checkbox" :disabled="!draft.parsed.exercises.length" class="size-5 accent-[var(--c-action)]" />
            <span class="min-w-0">
              <span class="block text-[15px] font-semibold">{{ draft.parsed.title || 'Salitreeni' }}</span>
              <span class="block text-[13px] text-ink-muted" data-numeric>{{ formatShortDate(draft.parsed.date) }}</span>
            </span>
          </label>
          <label class="text-[12px] text-ink-muted">
            <span class="sr-only">Päivämäärä</span>
            <input v-model="draft.parsed.date" type="date" class="h-10 rounded-(--radius-field) border border-line bg-bg px-2 text-[14px] text-ink" />
          </label>
        </div>

        <p v-if="draft.parsed.dateGuessed" class="mt-2 text-[13px] font-semibold">
          Päivämäärää ei löytynyt, joten käytössä on tämä päivä. Tarkista se.
        </p>
        <p v-if="draft.include && hasDuplicate(draft.parsed.date)" class="mt-2 text-[13px] font-semibold">
          Tälle päivälle on jo salitreeni. Jätä tämä pois, jos se on sama treeni.
        </p>

        <ul v-if="draft.parsed.exercises.length" class="mt-2">
          <li
            v-for="(exercise, e) in draft.parsed.exercises"
            :key="e"
            class="flex items-center gap-2 border-t border-line py-2 first:border-t-0"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[15px]">
                {{ draft.matches[e]?.name ?? exercise.name }}
                <span
                  v-if="!draft.matches[e]"
                  class="ml-1 rounded-full border border-current px-1.5 py-px text-[10px] font-bold tracking-[0.06em] text-ink-muted uppercase"
                >Uusi liike</span>
              </span>
              <span class="block text-[13px] text-ink-muted" data-numeric>
                <template v-if="draft.matches[e] && draft.matches[e]?.name !== exercise.name">"{{ exercise.name }}" · </template>{{ setsSummary(exercise.sets) }}
              </span>
            </span>
            <button
              type="button"
              class="min-h-11 px-2 text-sm font-semibold text-ink-muted underline"
              :aria-label="`Vaihda liike ${draft.matches[e]?.name ?? exercise.name}`"
              @click="picking = { draft: d, exercise: e }"
            >
              Vaihda
            </button>
          </li>
        </ul>

        <div v-if="draft.parsed.unrecognized.length" class="mt-2 rounded-(--radius-chip) bg-bg p-2.5">
          <p class="text-[12px] font-semibold text-ink-muted">
            {{ draft.parsed.exercises.length ? 'Tallennetaan treenin muistiinpanoksi:' : 'Ei liikkeitä, ei tuoda:' }}
          </p>
          <p v-for="(line, i) in draft.parsed.unrecognized" :key="i" class="text-[13px] text-ink-muted">{{ line }}</p>
        </div>
      </article>

      <button
        type="button"
        :disabled="!importable.length || busy"
        class="min-h-12 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-40"
        @click="save"
      >
        {{ busy ? 'Tuodaan…' : `Tuo ${importable.length === 1 ? '1 treeni' : `${importable.length} treeniä`}` }}
      </button>
      <button
        type="button"
        class="min-h-11 rounded-(--radius-button) border border-line font-semibold"
        @click="drafts = null"
      >
        Muokkaa tekstiä
      </button>
    </template>

    <ExercisePicker :open="picking !== null" title="Vaihda liike" @select="pick" @close="picking = null" />
  </div>
</template>
