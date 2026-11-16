<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ExercisePicker from '@/components/ExercisePicker.vue'
import FeelPrompt from '@/components/FeelPrompt.vue'
import SessionBlockList, { type BlockRow } from '@/components/SessionBlockList.vue'
import SetRow from '@/components/SetRow.vue'
import type { SetValues } from '@/components/SetRow.vue'
import { useNow } from '@/composables/useNow'
import { useTheme } from '@/composables/useTheme'
import { useWakeLock } from '@/composables/useWakeLock'
import { primeAudio } from '@/lib/beep'
import { formatDuration, formatSet, formatShortDate } from '@/lib/format'
import { recentHistory, sessionsFor } from '@/lib/history'
import { suggestNext } from '@/lib/progression'
import { loadRestSignal, signalRestEnd } from '@/lib/restSignal'
import { canRemoveSet, canSwap, isExerciseDone } from '@/lib/session'
import { formatWorkTime } from '@/lib/timed'
import { useExercises } from '@/stores/exercises'
import { useSession } from '@/stores/session'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useWorkouts } from '@/stores/workouts'
import type { SessionBlock, SessionExercise } from '@/types/session'
import type { Exercise } from '@/types/workout'

const router = useRouter()
const session = useSession()
const exercises = useExercises()
const workouts = useWorkouts()
const colors = useSportColors()
const { isDark } = useTheme()
const now = useNow()

useWakeLock()

// Ilman käynnissä olevaa treeniä tälle sivulle ei ole asiaa.
onBeforeMount(() => {
  if (!session.active) void router.replace('/')
})

const active = computed(() => session.active)
const vars = computed(() => sportVars(colors.swatchFor('strength'), isDark.value))
const block = computed(() => active.value?.blocks[active.value.currentBlock])

const nameOf = (exerciseId: string) => exercises.byId.get(exerciseId)?.name ?? exerciseId

const elapsed = computed(() => {
  if (!active.value) return '0.00'
  return formatDuration(Math.max(0, Math.floor((now.value - Date.parse(active.value.startedAt)) / 1000)))
})

// --- lepo ---

const restLeft = computed(() => {
  const end = active.value?.restEndsAt
  return end ? Math.max(0, Math.ceil((Date.parse(end) - now.value) / 1000)) : 0
})

const restShare = computed(() => {
  const total = block.value?.restSec ?? 0
  return total ? Math.min(100, Math.round((restLeft.value / total) * 100)) : 0
})

/** Taustalta palatessa lepo on voinut päättyä kauan sitten: silloin merkki tuli jo push-ilmoituksena. */
const SIGNAL_GRACE_MS = 3000

// Merkki vain kun lepo päättyy itsestään, ei kun se ohitetaan. Merkin laji on asetuksissa.
watch(restLeft, (left, before) => {
  const endsAt = active.value?.restEndsAt
  if (before > 0 && left === 0 && endsAt && Date.now() - Date.parse(endsAt) < SIGNAL_GRACE_MS) signalRestEnd()
})

// --- aikasarjan työaika ---

const workLeft = computed(() => {
  const end = active.value?.work?.endsAt
  return end ? Math.max(0, Math.ceil((Date.parse(end) - now.value) / 1000)) : null
})

/** Jäljellä oleva työaika vain sille riville, jonka ajastin on käynnissä. */
function workLeftFor(blockIndex: number, exerciseIndex: number, setIndex: number): number | undefined {
  const at = active.value?.work?.set
  if (!at || workLeft.value === null) return undefined
  return at.block === blockIndex && at.exercise === exerciseIndex && at.set === setIndex ? workLeft.value : undefined
}

function startWork(blockIndex: number, exerciseIndex: number, setIndex: number) {
  // Napautus avaa äänikanavan, jotta merkki kuuluu myös iPhonessa ajan lopussa.
  if (loadRestSignal() === 'sound') primeAudio()
  void session.startWork({ block: blockIndex, exercise: exerciseIndex, set: setIndex })
}

// Ajan loppuessa sama merkki kuin levon lopussa, ja toistokenttä aukeaa rivillä. Heti
// avattaessa, koska aika on voinut loppua sovelluksen ollessa suljettuna.
watch(
  workLeft,
  (left) => {
    const endsAt = active.value?.work?.endsAt
    if (left !== 0 || !endsAt) return
    if (Date.now() - Date.parse(endsAt) < SIGNAL_GRACE_MS) signalRestEnd()
    void session.stopWork()
  },
  { immediate: true },
)

// --- sarjat ---

function firstOpenSet(sets: { done: boolean }[]): number {
  return sets.findIndex((set) => !set.done)
}

function stateOf(setIndex: number, sets: { done: boolean }[]) {
  if (sets[setIndex].done) return 'done' as const
  return setIndex === firstOpenSet(sets) ? ('current' as const) : ('upcoming' as const)
}

function complete(blockIndex: number, exerciseIndex: number, setIndex: number) {
  // Äänikanava avataan vain äänimerkkiä varten: auki ollessaan se voi keskeyttää musiikin.
  if (loadRestSignal() === 'sound') primeAudio()
  void session.completeSet({ block: blockIndex, exercise: exerciseIndex, set: setIndex })
}

function edit(blockIndex: number, exerciseIndex: number, setIndex: number, values: SetValues) {
  void session.setValues({ block: blockIndex, exercise: exerciseIndex, set: setIndex }, values)
}

// --- muistiinpano ---

/** Liikkeet, joiden muistiinpanokenttä on avattu. Kirjoitettu muistiinpano pitää kentän auki. */
const noteOpen = ref(new Set<string>())
const showNote = (exercise: SessionExercise) => noteOpen.value.has(exercise.exerciseId) || Boolean(exercise.note)

function openNote(exerciseId: string) {
  noteOpen.value = new Set([...noteOpen.value, exerciseId])
}

// --- tuntuma ---

const kgFormat = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 })
const kg = (value: number) => kgFormat.format(value)

/** Tehty liike kutistuu riviksi ja kysyy tuntuman. Sarjat saa takaisin auki korjausta varten. */
const expanded = ref(new Set<string>())

const isCollapsed = (exercise: SessionExercise) =>
  isExerciseDone(exercise) && !expanded.value.has(exercise.exerciseId)

function toggleExpanded(exerciseId: string) {
  const next = new Set(expanded.value)
  if (next.has(exerciseId)) next.delete(exerciseId)
  else next.add(exerciseId)
  expanded.value = next
}

/** Toistoja yhteensä yli tavoitteen: sovellus huomaa, että teit enemmän kuin ohjelmassa. */
function surplus(exercise: SessionExercise): number {
  if (exercise.measurement !== 'weight_reps' || exercise.target.durationSec) return 0
  return exercise.sets.reduce((sum, set) => sum + Math.max(0, (set.reps ?? 0) - exercise.target.reps), 0)
}

/** Mitä vastaus teki: sama sääntö kuin seuraavan kerran ehdotuksessa, jotta lupaus pitää. */
function suggestionText(exercise: SessionExercise): string | null {
  if (exercise.feel === undefined && !exercise.feelSkipped) return null
  // Aikasarjan toistot eivät kerro painon sopivuudesta samalla tavalla kuin toistotavoite.
  if (exercise.target.durationSec) return null
  const definition = exercises.byId.get(exercise.exerciseId)
  if (!definition) return null

  const earlier = sessionsFor(exercise.exerciseId, recentHistory(workouts.workouts, new Date()), 1)
  const suggestion = suggestNext(definition, exercise.target, [
    { sets: exercise.sets, feel: exercise.feel },
    ...earlier,
  ])
  if (!suggestion) return null

  if (suggestion.kind === 'keep') {
    const keep = `Ensi kerralla sama paino, ${kg(suggestion.kg)} kg.`
    // Raskas tuntuma ei yksin laske painoa: yksi huono päivä ei kerro, että paino on liian iso.
    if (exercise.feel !== 'hard' && exercise.feel !== 'max') return keep
    const missed = exercise.sets.some((set) => (set.reps ?? 0) < exercise.target.reps)
    return missed
      ? `${keep} Jos tuntuu taas raskaalta eivätkä toistot täyty, paino laskee.`
      : `${keep} Toistot täyttyivät, joten paino pysyy.`
  }
  const delta = suggestion.toKg - suggestion.fromKg
  return `Ensi kerralle ehdotus ${kg(suggestion.toKg)} kg (${delta > 0 ? '+' : '−'}${kg(Math.abs(delta))})`
}

const doneIn = (b: SessionBlock) =>
  b.exercises.reduce((sum, e) => sum + e.sets.filter((s) => s.done).length, 0)
const totalIn = (b: SessionBlock) => b.exercises.reduce((sum, e) => sum + e.sets.length, 0)

const blockDone = computed(() => !!block.value && block.value.exercises.every(isExerciseDone))
const isBlockDone = (b: SessionBlock) => b.exercises.every(isExerciseDone)

/** Koko treenin järjestys listana, myös käsillä oleva liike, jotta raahatessa näkee paikan. */
const blockRows = computed<BlockRow[]>(() =>
  (active.value?.blocks ?? []).map((b) => ({
    id: b.id,
    name: b.exercises.map((e) => nameOf(e.exerciseId)).join(' + '),
    done: doneIn(b),
    total: totalIn(b),
    finished: isBlockDone(b),
  })),
)

/** Seuraava tekemätön liike: ensin käsillä olevan jälkeen, sitten alusta. -1, kun kaikki on tehty. */
const nextOpen = computed(() => {
  const blocks = active.value?.blocks ?? []
  const current = active.value?.currentBlock ?? 0
  const order = [...blocks.keys()].filter((i) => i > current).concat([...blocks.keys()].filter((i) => i < current))
  return order.find((i) => !isBlockDone(blocks[i])) ?? -1
})

const allDone = computed(() => !!active.value?.blocks.length && active.value.blocks.every(isBlockDone))

// --- siirtyminen seuraavaan liikkeeseen ---

/** Tuntumaa kysytään vain painoliikkeiltä. Vastattu tai ohitettu kelpaa. */
const feelAnswered = (e: SessionExercise) =>
  e.measurement !== 'weight_reps' || e.feel !== undefined || e.feelSkipped === true

const readyToMove = computed(
  () => !!block.value && block.value.exercises.every((e) => isExerciseDone(e) && feelAnswered(e)),
)

/**
 * Kun liike valmistuu ja tuntuma on vastattu, seuraava tekemätön liike aukeaa itsestään.
 * Siirto odottaa hetken, jotta "Ensi kerralle ehdotus" ehtii näkyä. Liikkeeseen, jolle
 * itse palaa, jäädään: siirto tapahtuu vain, kun valmistuminen tapahtuu tässä liikkeessä.
 */
const ADVANCE_DELAY_MS = 1500
let advanceTimer: ReturnType<typeof setTimeout> | undefined

watch([() => block.value?.id, readyToMove], ([id, ready], [previousId, wasReady]) => {
  clearTimeout(advanceTimer)
  if (id !== previousId || !ready || wasReady || nextOpen.value < 0) return
  const delay = block.value?.exercises.some((e) => e.measurement === 'weight_reps') ? ADVANCE_DELAY_MS : 0
  advanceTimer = setTimeout(() => {
    // Muistiinpanon kirjoitus jää kesken, jos liike vaihtuu alta: silloin siirrytään itse napista.
    if (document.activeElement instanceof HTMLTextAreaElement) return
    if (block.value?.id === id && nextOpen.value >= 0) void session.goToBlock(nextOpen.value)
  }, delay)
})
onBeforeUnmount(() => clearTimeout(advanceTimer))

// --- liikevalitsin: vaihda liike tai lisää uusi ---

const picker = ref<{ mode: 'swap'; exercise: number } | { mode: 'add' } | null>(null)

function onPick(exercise: Exercise) {
  const chosen = picker.value
  picker.value = null
  if (!chosen || !active.value) return
  if (chosen.mode === 'swap') void session.swapExercise(active.value.currentBlock, chosen.exercise, exercise.id)
  else void session.addExercise(exercise.id)
}

function finish() {
  return router.push('/treeni/yhteenveto')
}
</script>

<template>
  <div v-if="active" :style="vars" class="flex min-h-dvh flex-col pb-6">
    <header class="flex items-center justify-between gap-3 px-5 pt-4">
      <RouterLink
        to="/"
        aria-label="Takaisin päiväkirjaan, treeni jatkuu"
        class="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface"
      >
        <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="11,6 5,12 11,18" />
        </svg>
      </RouterLink>
      <p class="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2">
        <span aria-hidden="true" class="size-2 rounded-full bg-[#b3434f]" />
        <span class="text-[15px] font-bold" data-numeric>{{ elapsed }}</span>
      </p>
      <span class="size-11 flex-none" aria-hidden="true" />
    </header>

    <div class="flex items-baseline justify-between gap-3 px-5 pt-3.5">
      <h1 class="font-display text-[26px] leading-[1.05] font-bold tracking-[-0.02em]">
        {{ active.title }}
      </h1>
      <p
        v-if="block"
        class="text-xs font-semibold tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase"
      >
        Liike {{ active.currentBlock + 1 }} / {{ active.blocks.length }}
      </p>
    </div>

    <!-- Käsillä oleva lohko. Jokainen lohkon liike saa oman korttinsa. -->
    <section
      v-for="(exercise, exerciseIndex) in block?.exercises ?? []"
      :key="exercise.exerciseId"
      class="mx-5 mt-3.5 rounded-(--radius-feature) bg-[var(--sport-surface)] p-3.5"
    >
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-lg font-bold tracking-[-0.01em]">{{ nameOf(exercise.exerciseId) }}</h2>
        <!--
          Vaihto ja poisto vain ennen ensimmäistä tehtyä sarjaa, jottei kirjattu katoa.
          Poistettu liike palaa "Lisää liike" -napista, joten varmistusta ei tarvita.
        -->
        <div v-if="canSwap(exercise)" class="flex flex-none gap-1.5">
          <button
            type="button"
            class="min-h-8 rounded-full bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] px-3 text-[13px] font-semibold text-[var(--sport-on)]"
            @click="picker = { mode: 'swap', exercise: exerciseIndex }"
          >
            Vaihda liike
          </button>
          <button
            type="button"
            :aria-label="`Poista ${nameOf(exercise.exerciseId)} treenistä`"
            class="min-h-8 rounded-full bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] px-3 text-[13px] font-semibold text-[var(--sport-on)]"
            @click="session.removeExercise(active.currentBlock, exerciseIndex)"
          >
            Poista
          </button>
        </div>
      </div>
      <!-- Vaihtuva liike: tämän kerran liikkeen voi vaihtaa kierrosta, kunnes ensimmäinen sarja on tehty. -->
      <div
        v-if="exercise.rotation && canSwap(exercise)"
        role="group"
        aria-label="Vaihtuva liike tällä kertaa"
        class="my-2 flex flex-wrap gap-1.5"
      >
        <button
          v-for="option in exercise.rotation"
          :key="option.exerciseId"
          type="button"
          :aria-pressed="option.exerciseId === exercise.exerciseId"
          class="min-h-9 rounded-full px-3 text-[13px] font-semibold"
          :class="
            option.exerciseId === exercise.exerciseId
              ? 'bg-[var(--sport-on)] text-[var(--sport-surface)]'
              : 'bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] text-[var(--sport-on)]'
          "
          @click="option.exerciseId !== exercise.exerciseId && session.swapExercise(active.currentBlock, exerciseIndex, option.exerciseId)"
        >
          {{ nameOf(option.exerciseId) }}
        </button>
      </div>
      <p class="mt-0.5 text-xs text-[var(--sport-on)]" data-numeric>
        Tavoite {{ exercise.target.sets }} ×
        {{ exercise.target.durationSec ? formatWorkTime(exercise.target.durationSec) : exercise.target.reps }}
        <template v-if="!exercise.previous"> · ensimmäinen kerta</template>
      </p>

      <!-- Edellinen muistiinpano vihjeenä, esim. laiteasetus. Tämän kerran muistiinpano alkaa tyhjänä. -->
      <p v-if="exercise.previousNote" class="mt-1.5 text-[13px] text-[var(--sport-on)]">
        <span class="font-semibold">Viime kerralla {{ formatShortDate(exercise.previousNote.date) }}:</span>
        {{ exercise.previousNote.text }}
      </p>
      <label v-if="showNote(exercise)" class="mt-2 block">
        <span class="sr-only">Muistiinpano: {{ nameOf(exercise.exerciseId) }}</span>
        <textarea
          :value="exercise.note ?? ''"
          rows="2"
          maxlength="500"
          placeholder="Esim. laite 2, istuin 4"
          class="w-full resize-none rounded-xl border border-[color-mix(in_srgb,var(--sport-on)_30%,transparent)] bg-[var(--sport-sunken)] px-3 py-2 text-[15px] placeholder:text-[color-mix(in_srgb,var(--sport-on)_60%,transparent)]"
          @input="session.setExerciseNote(active.currentBlock, exerciseIndex, ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <button
        v-else
        type="button"
        class="mt-1 min-h-9 text-[13px] font-semibold text-[var(--sport-on)] underline"
        @click="openNote(exercise.exerciseId)"
      >
        + Muistiinpano
      </button>

      <template v-if="isCollapsed(exercise)">
        <div class="mt-2.5 flex gap-1.5">
          <span
            v-for="(set, setIndex) in exercise.sets"
            :key="setIndex"
            class="min-w-0 flex-1 rounded-xl bg-[var(--sport-raised)] py-2 text-center text-sm font-semibold"
            data-numeric
          >
            {{ formatSet(set, exercise.measurement) }}
          </span>
        </div>
        <p v-if="surplus(exercise) > 0" class="mt-2 text-xs text-[var(--sport-on)]" data-numeric>
          Toistoja {{ surplus(exercise) }} yli tavoitteen.
        </p>

        <FeelPrompt
          v-if="exercise.measurement === 'weight_reps'"
          :feel="exercise.feel"
          :skipped="exercise.feelSkipped"
          :message="suggestionText(exercise)"
          @select="(feel) => session.setFeel(active!.currentBlock, exerciseIndex, feel)"
          @skip="session.setFeel(active!.currentBlock, exerciseIndex, 'skip')"
        />

        <button
          type="button"
          class="mt-2 min-h-10 w-full rounded-xl bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] text-sm font-semibold text-[var(--sport-on)]"
          @click="toggleExpanded(exercise.exerciseId)"
        >
          Muokkaa sarjoja
        </button>
      </template>

      <template v-else>
        <div class="mt-2.5 flex flex-col gap-1.5">
          <SetRow
            v-for="(set, setIndex) in exercise.sets"
            :key="setIndex"
            :set="set"
            :index="setIndex"
            :state="stateOf(setIndex, exercise.sets)"
            :measurement="exercise.measurement"
            :hint="exercise.hint"
            :previous="exercise.previous"
            :work-sec="exercise.target.durationSec"
            :work-left="workLeftFor(active.currentBlock, exerciseIndex, setIndex)"
            @start-work="startWork(active.currentBlock, exerciseIndex, setIndex)"
            @stop-work="session.stopWork()"
            @complete="complete(active.currentBlock, exerciseIndex, setIndex)"
            @undo="session.uncompleteSet({ block: active.currentBlock, exercise: exerciseIndex, set: setIndex })"
            @edit="(values) => edit(active!.currentBlock, exerciseIndex, setIndex, values)"
          />
        </div>

        <div class="mt-2 flex gap-2">
          <button
            type="button"
            class="min-h-10 flex-1 rounded-xl bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] text-sm font-semibold text-[var(--sport-on)]"
            @click="session.addSet(active.currentBlock, exerciseIndex)"
          >
            + Lisää sarja
          </button>
          <button
            type="button"
            class="min-h-10 flex-1 rounded-xl bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] text-sm font-semibold text-[var(--sport-on)] disabled:opacity-40"
            :disabled="!canRemoveSet(active, active.currentBlock, exerciseIndex)"
            @click="session.removeLastSet(active.currentBlock, exerciseIndex)"
          >
            − Poista sarja
          </button>
        </div>

        <button
          v-if="isExerciseDone(exercise)"
          type="button"
          class="mt-2 min-h-10 w-full rounded-xl bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] text-sm font-semibold text-[var(--sport-on)]"
          @click="toggleExpanded(exercise.exerciseId)"
        >
          Valmis
        </button>
      </template>
    </section>

    <!-- Tyhjästä aloitettu treeni: ensimmäinen liike valitaan itse. -->
    <section v-if="!block" class="mx-5 mt-3.5 rounded-(--radius-feature) bg-surface p-4">
      <h2 class="text-lg font-bold tracking-[-0.01em]">Ei vielä liikkeitä</h2>
      <p class="mt-1 text-[13px] text-ink-muted">
        Hae ensimmäinen liike. Tuttu liike tulee valmiiksi täytettynä viime kerran painolla.
      </p>
      <button
        type="button"
        class="mt-3 min-h-12 w-full rounded-(--radius-button) bg-action font-semibold text-on-action"
        @click="picker = { mode: 'add' }"
      >
        + Lisää ensimmäinen liike
      </button>
    </section>

    <!-- Lepo -->
    <section v-if="restLeft > 0" class="mx-5 mt-2.5 rounded-(--radius-card) bg-surface px-3.5 py-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Lepo</span>
        <span class="text-xl font-bold tracking-[-0.02em]" data-numeric aria-live="off">
          {{ formatDuration(restLeft) }}
        </span>
        <button
          type="button"
          class="min-h-8 rounded-full border border-line px-3 text-[13px] font-semibold"
          @click="session.skipRest()"
        >
          Ohita
        </button>
      </div>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div class="h-full rounded-full bg-action transition-[width] duration-1000 ease-linear" :style="{ width: `${restShare}%` }" />
      </div>
    </section>

    <!-- Treenin järjestys: napauttamalla pääsee liikkeeseen, kahvasta raahaamalla järjestys vaihtuu. -->
    <SessionBlockList
      v-if="blockRows.length > 1"
      class="mx-5 mt-3"
      :rows="blockRows"
      :current="active.currentBlock"
      @select="session.goToBlock"
      @move="session.moveBlock"
    />

    <div class="flex-1" />

    <section v-if="allDone" role="status" class="mx-5 mt-4 rounded-(--radius-feature) bg-[var(--sport-surface)] p-4 text-center">
      <p class="font-display text-[22px] leading-tight font-bold text-[var(--sport-on)]">Kaikki liikkeet tehty</p>
      <p class="mt-1 text-[13px] text-[var(--sport-on)]">Päätä treeni, niin se tallentuu päiväkirjaan.</p>
    </section>

    <div class="mx-5 mt-4 flex flex-col gap-2">
      <button
        v-if="block"
        type="button"
        class="min-h-11 rounded-(--radius-button) border border-dashed border-ink-muted text-sm font-semibold"
        @click="picker = { mode: 'add' }"
      >
        + Lisää liike
      </button>
      <button
        v-if="blockDone && nextOpen >= 0"
        type="button"
        class="min-h-13 rounded-(--radius-button) bg-action text-base font-semibold text-on-action"
        @click="session.goToBlock(nextOpen)"
      >
        Seuraava liike
      </button>
      <button
        type="button"
        class="min-h-13 rounded-(--radius-button) text-base font-semibold"
        :class="blockDone && nextOpen >= 0 ? 'border border-line' : 'bg-action text-on-action'"
        @click="finish"
      >
        Päätä treeni
      </button>
    </div>

    <ExercisePicker
      :open="picker !== null"
      :title="picker?.mode === 'swap' ? 'Vaihda liike' : 'Lisää liike'"
      @select="onPick"
      @close="picker = null"
    />
  </div>
</template>
