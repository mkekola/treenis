<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ExercisePicker from '@/components/ExercisePicker.vue'
import RecoveryCard from '@/components/RecoveryCard.vue'
import { useDragReorder } from '@/composables/useDragReorder'
import { formatDurationShort } from '@/lib/format'
import { recentHistory } from '@/lib/history'
import { buildSession, newSessionExercise, orderBlocks, rotationChoice, swapExercise } from '@/lib/session'
import { DEFAULT_REPS, estimateDurationSec, setCount, exerciseCount } from '@/lib/template'
import { formatWorkTime } from '@/lib/timed'
import { useExercises } from '@/stores/exercises'
import { usePrograms } from '@/stores/programs'
import { useSession } from '@/stores/session'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'
import type { SessionExercise } from '@/types/session'
import type { Exercise } from '@/types/workout'

const route = useRoute()
const router = useRouter()
const templates = useTemplates()
const programs = usePrograms()
const exercises = useExercises()
const workouts = useWorkouts()
const session = useSession()

const template = computed(() => templates.templates.find((t) => t.id === route.params.templateId))
const program = computed(() => (template.value ? programs.ownerOf(template.value.id) : undefined))

const lookup = (id: string) => exercises.byId.get(id)

/**
 * Tämän kerran vaihdot ("lohko:liike" → uusi liike), esim. kun laite on varattu.
 * Pohja ei muutu. Toistuva vaihto tulee yhteenvedossa ehdotuksena päivittää pohja.
 */
const swaps = ref(new Map<string, string>())
const keyOf = (block: number, exercise: number) => `${block}:${exercise}`

/**
 * Tämän kerran järjestys pohjan lohkojen indekseinä. Tyhjä = pohjan oma järjestys.
 * Vaihdot viittaavat pohjan indekseihin, joten järjestys tehdään vasta niiden jälkeen.
 */
const order = ref<number[]>([])
const blockOrder = computed(() => {
  const count = template.value?.blocks.length ?? 0
  return order.value.length === count ? order.value : [...Array(count).keys()]
})
const reordered = computed(() => blockOrder.value.some((original, position) => original !== position))

function reorder(from: number, to: number) {
  const next = [...blockOrder.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  order.value = next
}

/** Lohkojen väli (gap-4), jotta raahattava lohko jättää oman kokoisensa raon. */
const BLOCK_GAP_PX = 16
const blockList = useTemplateRef<HTMLElement>('blockList')
const { drag, start, move, end, shift, moveBy } = useDragReorder(blockList, BLOCK_GAP_PX, reorder)

const history = computed(() => recentHistory(workouts.workouts, new Date()))

/**
 * Esikatselu rakennetaan samalla logiikalla kuin oikea treeni, mutta sitä ei
 * tallenneta. Näin painot, nousuehdotukset ja vaihtuvan liikkeen vuoro ovat
 * samat, jotka treenissä näkyvät.
 */
const planned = computed(() =>
  template.value
    ? buildSession({ id: 'esikatselu', now: new Date(), template: template.value, history: history.value, exercises: lookup })
    : null,
)

const preview = computed(() => {
  if (!planned.value) return null
  let built = planned.value
  for (const [key, exerciseId] of swaps.value) {
    const [block, index] = key.split(':').map(Number)
    const exercise = lookup(exerciseId)
    const current = built.blocks[block]?.exercises[index]
    if (!exercise || !current) continue
    const replacement =
      rotationChoice(current, exerciseId, history.value, lookup) ??
      newSessionExercise({
        exercise,
        sets: current.target.sets,
        reps: current.target.reps || DEFAULT_REPS,
        history: history.value,
        lookup,
      })
    built = swapExercise(built, block, index, replacement)
  }
  return orderBlocks(built, blockOrder.value)
})

/** Pohjan alkuperäinen liike, jotta vaihdetun rivin voi palauttaa ja nimetä. */
const originalOf = (block: number, exercise: number) =>
  template.value?.blocks[block]?.exercises[exercise]?.exerciseId

const swapping = ref<{ block: number; exercise: number } | null>(null)

function onPick(exercise: Exercise) {
  const at = swapping.value
  swapping.value = null
  if (!at) return
  const next = new Map(swaps.value)
  if (exercise.id === originalOf(at.block, at.exercise)) next.delete(keyOf(at.block, at.exercise))
  else next.set(keyOf(at.block, at.exercise), exercise.id)
  swaps.value = next
}

/** Vaihtuvan liikkeen valinta tälle kerralle. Vuorossa olevan valinta palauttaa vuoron. */
function choose(at: { block: number; exercise: number }, exerciseId: string) {
  const next = new Map(swaps.value)
  if (exerciseId === planned.value?.blocks[at.block]?.exercises[at.exercise]?.exerciseId) next.delete(keyOf(at.block, at.exercise))
  else next.set(keyOf(at.block, at.exercise), exerciseId)
  swaps.value = next
}

function restore(block: number, exercise: number) {
  const next = new Map(swaps.value)
  next.delete(keyOf(block, exercise))
  swaps.value = next
}

const nameOf = (id: string) => exercises.byId.get(id)?.name ?? 'Tuntematon liike'
const perSide = (id: string) => exercises.byId.get(id)?.perSide ?? false

const kgFormat = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 })
const kg = (value: number) => kgFormat.format(value)

function targetText(entry: SessionExercise): string {
  const value = entry.target.durationSec
    ? formatWorkTime(entry.target.durationSec)
    : entry.measurement === 'time'
      ? `${entry.sets[0]?.durationSec ?? 0} s`
      : String(entry.target.reps)
  const sides = perSide(entry.exerciseId) ? ' per puoli' : ''
  const last = entry.previous
  const previous = entry.hint && last?.weightKg !== undefined
    ? ` · viimeksi ${kg(last.weightKg)} kg`
    : entry.target.durationSec && last?.reps
      ? ` · viimeksi ${last.reps} toistoa`
      : ''
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
  return (preview.value?.blocks ?? []).map((block, position) => {
    // Vaihdot ja palautus viittaavat pohjan alkuperäiseen lohkoon, eivät näytön paikkaan.
    const original = blockOrder.value[position]
    return {
      ...block,
      exercises: block.exercises.map((entry, exerciseIndex) => ({
        entry,
        number: ++n,
        at: { block: original, exercise: exerciseIndex },
        swapped: swaps.value.has(keyOf(original, exerciseIndex)),
      })),
    }
  })
})

async function begin() {
  if (!template.value || session.recovery) return
  await session.start(template.value)
  for (const [key, exerciseId] of swaps.value) {
    const [block, exercise] = key.split(':').map(Number)
    await session.swapExercise(block, exercise, exerciseId)
  }
  if (reordered.value) await session.orderBlocks(blockOrder.value)
  await router.push('/treeni')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col gap-4 px-5 pt-5 pb-28">
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
        <li class="rounded-full bg-surface px-3 py-1">{{ exerciseCount(preview) }} liikettä</li>
        <li class="rounded-full bg-surface px-3 py-1">{{ setCount(preview) }} sarjaa</li>
        <li v-if="estimateDurationSec(preview)" class="rounded-full bg-surface px-3 py-1">
          noin {{ formatDurationShort(estimateDurationSec(preview)) }}
        </li>
      </ul>

      <p v-if="!numbered.length" class="text-[13px] text-ink-muted">
        Treenissä ei ole vielä liikkeitä.
      </p>

      <p v-if="reordered" class="-mb-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">
        Järjestys muutettu tälle kerralle.
        <button type="button" class="min-h-9 font-semibold underline" @click="order = []">Palauta järjestys</button>
      </p>

      <!-- Lohkot raahattavina: kahvasta järjestys tälle kerralle, pohja pysyy ennallaan. -->
      <div ref="blockList" class="flex flex-col gap-4">
        <div
          v-for="(block, position) in numbered"
          :key="block.id"
          :style="{ transform: shift(position) }"
          class="relative flex items-stretch gap-1"
          :class="drag?.from === position ? 'z-10' : 'transition-transform duration-150 ease-out motion-reduce:transition-none'"
        >
          <button
            type="button"
            :aria-label="`Siirrä ${block.exercises.map((e) => nameOf(e.entry.exerciseId)).join(' + ')}. Raahaa tai käytä nuolinäppäimiä.`"
            class="-ml-2 flex w-9 flex-none cursor-grab touch-none items-center justify-center rounded-lg text-ink-muted active:cursor-grabbing"
            :class="drag?.from === position ? 'outline-2 outline-ink' : ''"
            @pointerdown="start(position, $event)"
            @pointermove="move"
            @pointerup="end"
            @pointercancel="end"
            @keydown.up.prevent="moveBy(position, -1, numbered.length)"
            @keydown.down.prevent="moveBy(position, 1, numbered.length)"
          >
            <svg class="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5.5" cy="3.5" r="1.5" />
              <circle cx="10.5" cy="3.5" r="1.5" />
              <circle cx="5.5" cy="8" r="1.5" />
              <circle cx="10.5" cy="8" r="1.5" />
              <circle cx="5.5" cy="12.5" r="1.5" />
              <circle cx="10.5" cy="12.5" r="1.5" />
            </svg>
          </button>
          <!-- Lohko: yksittäinen liike tai supersarja, kuten muokkauksessa ja treenin aikana. -->
          <section
            :aria-label="block.exercises.length > 1 ? 'Supersarja' : undefined"
            :class="block.exercises.length > 1 ? 'border-l-4 border-line pl-2.5' : ''"
            class="flex min-w-0 flex-1 flex-col gap-2"
          >
            <p
              v-if="block.exercises.length > 1"
              class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
            >
              Supersarja · lepo {{ block.restSec }} s kierroksen jälkeen
            </p>
            <div
              v-for="{ entry, number, at, swapped } in block.exercises"
              :key="number"
              class="flex flex-wrap items-center gap-x-3 rounded-(--radius-card) bg-surface px-3.5 pt-3 pb-1.5"
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
                <template v-if="!entry.rotation">
                  <span v-if="swapped" class="block text-[12px] text-ink-muted">
                    Vain tällä kertaa, pohjassa {{ nameOf(originalOf(at.block, at.exercise) ?? '') }}
                  </span>
                  <span class="flex gap-3 text-[13px] font-semibold text-ink-muted">
                    <button
                      type="button"
                      :aria-label="`Vaihda ${nameOf(entry.exerciseId)} tälle kerralle`"
                      class="min-h-9 underline"
                      @click="swapping = at"
                    >
                      Vaihda
                    </button>
                    <button
                      v-if="swapped"
                      type="button"
                      :aria-label="`Palauta ${nameOf(originalOf(at.block, at.exercise) ?? '')}`"
                      class="min-h-9 underline"
                      @click="restore(at.block, at.exercise)"
                    >
                      Palauta
                    </button>
                  </span>
                </template>
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
              <!-- Vaihtuva liike: kierron liikkeet valittavina, vuorossa oleva valmiiksi valittuna. -->
              <span
                v-if="entry.rotation"
                role="group"
                aria-label="Vaihtuva liike tällä kertaa"
                class="mb-1.5 flex w-full flex-wrap gap-1.5 pl-10"
              >
                <button
                  v-for="option in entry.rotation"
                  :key="option.exerciseId"
                  type="button"
                  :aria-pressed="option.exerciseId === entry.exerciseId"
                  class="min-h-9 rounded-full border px-3 text-[13px] font-semibold"
                  :class="option.exerciseId === entry.exerciseId ? 'border-action bg-action text-on-action' : 'border-line bg-bg'"
                  @click="choose(at, option.exerciseId)"
                >
                  {{ nameOf(option.exerciseId) }}
                </button>
              </span>
            </div>
          </section>
        </div>
      </div>

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

    <ExercisePicker :open="swapping !== null" title="Vaihda tälle kerralle" @select="onPick" @close="swapping = null" />
  </div>
</template>
