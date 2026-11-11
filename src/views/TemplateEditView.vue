<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ExercisePicker from '@/components/ExercisePicker.vue'
import { useTheme } from '@/composables/useTheme'
import {
  addExercise,
  canJoin,
  canMove,
  detach,
  joinWithPrevious,
  move,
  removeExercise,
  rename,
  setRest,
  setTarget,
  targetOf,
  type ExerciseRef,
} from '@/lib/template'
import { useExercises } from '@/stores/exercises'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { usePrograms } from '@/stores/programs'
import { useTemplates } from '@/stores/templates'
import type { Exercise, Measurement, WorkoutTemplate } from '@/types/workout'

const REST_STEP_SEC = 15
const MAX_REST_SEC = 600

const route = useRoute()
const router = useRouter()
const templates = useTemplates()
const programs = usePrograms()
const exercises = useExercises()
const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor('strength'), isDark.value))

const template = computed(() => templates.templates.find((t) => t.id === route.params.id))
const program = computed(() => programs.byId(String(route.params.programId)))
const backTo = computed(() =>
  program.value ? { name: 'program', params: { id: program.value.id } } : { name: 'programs' },
)

/** Jokainen muutos tallennetaan heti, kuten treenin aikana. Erillistä Tallenna-nappia ei ole. */
function update(next: WorkoutTemplate) {
  void templates.save(next)
}

const exerciseOf = (id: string) => exercises.byId.get(id)
const nameOf = (id: string) => exerciseOf(id)?.name ?? 'Tuntematon liike'
const measurementOf = (id: string): Measurement => exerciseOf(id)?.measurement ?? 'weight_reps'

// ------------------------------------------------------------------- nimi

const nameText = ref(template.value?.name ?? '')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

watch(
  () => template.value?.name,
  (name) => {
    if (name !== undefined) nameText.value = name
  },
)

function commitName() {
  if (!template.value) return
  const name = nameText.value.trim()
  if (!name) {
    nameText.value = template.value.name
    return
  }
  if (name !== template.value.name) update(rename(template.value, name))
}

// Uusi pohja avautuu nimi valittuna, jotta "Uusi pohja" korvautuu kirjoittamalla.
onMounted(async () => {
  if (route.query.uusi !== '1') return
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
})

// ------------------------------------------------------------- tavoitteet

function readNumber(event: Event): number | null {
  const value = Number((event.target as HTMLInputElement).value.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Virheellinen syöte palautetaan entiseksi: kenttä näyttää aina tallennetun arvon. */
function onTarget(at: ExerciseRef, field: 'sets' | 'value', event: Event) {
  if (!template.value) return
  const value = readNumber(event)
  const entry = template.value.blocks[at.block].exercises[at.exercise]
  if (value === null) {
    const target = targetOf(entry)
    const fallback = field === 'sets' ? target.sets : (target.reps ?? target.durationSec ?? '')
    ;(event.target as HTMLInputElement).value = String(fallback)
    return
  }
  update(setTarget(template.value, at, measurementOf(entry.exerciseId), { [field]: value }))
}

// --------------------------------------------------------- liikkeen valikko

const menuAt = ref<ExerciseRef | null>(null)
const menu = useTemplateRef<HTMLDialogElement>('menu')

watch(menuAt, async (at) => {
  if (!at) {
    menu.value?.close()
    return
  }
  await nextTick()
  if (!menu.value?.open) menu.value?.showModal()
})

const menuBlock = computed(() =>
  menuAt.value && template.value ? template.value.blocks[menuAt.value.block] : null,
)
const menuEntry = computed(() =>
  menuAt.value && menuBlock.value ? menuBlock.value.exercises[menuAt.value.exercise] : null,
)
const inSuperset = computed(() => (menuBlock.value?.exercises.length ?? 0) > 1)

/** Edellisen lohkon liikkeet, jotta yhdistäminen kertoo mihin liike liittyy. */
const previousNames = computed(() => {
  if (!menuAt.value || !template.value || menuAt.value.block === 0) return ''
  return template.value.blocks[menuAt.value.block - 1].exercises
    .map((e) => nameOf(e.exerciseId))
    .join(' + ')
})

function closeMenu() {
  menuAt.value = null
}

function onMenuBackdrop(event: MouseEvent) {
  if (event.target === menu.value) closeMenu()
}

/** Rakennetta muuttavat toiminnot sulkevat valikon, koska liikkeen paikka vaihtuu. */
function act(change: (t: WorkoutTemplate, at: ExerciseRef) => WorkoutTemplate) {
  if (!template.value || !menuAt.value) return
  update(change(template.value, menuAt.value))
  closeMenu()
}

const newBlockId = () => crypto.randomUUID()

function changeRest(delta: number) {
  if (!template.value || !menuAt.value || !menuBlock.value) return
  const rest = Math.min(MAX_REST_SEC, Math.max(0, menuBlock.value.restSec + delta))
  update(setRest(template.value, menuAt.value.block, rest))
}

// ---------------------------------------------------------- lisäys ja poisto

const pickerOpen = ref(false)

function onPick(exercise: Exercise) {
  pickerOpen.value = false
  if (template.value) update(addExercise(template.value, newBlockId(), exercise))
}

const confirmingDelete = ref(false)

async function deleteTemplate() {
  if (!template.value) return
  await programs.deleteTemplate(template.value.id)
  await router.replace(backTo.value)
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-5 pt-5" :style="vars">
    <RouterLink
      :to="backTo"
      :aria-label="`Takaisin: ${program?.name ?? 'Ohjelmat'}`"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>

    <p v-if="!template" class="py-6 text-center text-sm text-ink-muted">
      Pohjaa ei löytynyt. Se on ehkä poistettu toisella laitteella.
    </p>

    <template v-else>
      <label for="pohjan-nimi" class="sr-only">Pohjan nimi</label>
      <input
        id="pohjan-nimi"
        ref="nameInput"
        v-model="nameText"
        type="text"
        enterkeyhint="done"
        class="-mx-2 rounded-(--radius-field) bg-transparent px-2 py-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em] focus:bg-surface"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />

      <p v-if="!template.blocks.length" class="text-[13px] text-ink-muted">
        Lisää ensimmäinen liike. Sarjat ja toistot voi muuttaa suoraan riviltä.
      </p>

      <!-- Lohko: yksittäinen liike tai supersarja. Supersarjalla on yhteinen reunaviiva ja lepo. -->
      <section
        v-for="(block, b) in template.blocks"
        :key="block.id"
        :aria-label="block.exercises.length > 1 ? 'Supersarja' : undefined"
        :class="block.exercises.length > 1 ? 'border-l-4 border-[var(--sport-surface)] pl-2.5' : ''"
        class="flex flex-col gap-2"
      >
        <p
          v-if="block.exercises.length > 1"
          class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
        >
          Supersarja
        </p>

        <div
          v-for="(entry, e) in block.exercises"
          :key="`${block.id}-${e}-${entry.exerciseId}`"
          class="rounded-(--radius-card) bg-surface p-3.5"
        >
          <div class="flex items-start gap-2">
            <h2 class="min-w-0 flex-1 pt-2 text-base leading-snug font-semibold">
              {{ nameOf(entry.exerciseId) }}
            </h2>
            <button
              type="button"
              :aria-label="`Muokkaa: ${nameOf(entry.exerciseId)}`"
              class="-mt-1 -mr-1 flex size-11 flex-none items-center justify-center rounded-full"
              @click="menuAt = { block: b, exercise: e }"
            >
              <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
            <input
              :value="targetOf(entry).sets"
              type="text"
              inputmode="numeric"
              :aria-label="`${nameOf(entry.exerciseId)}: sarjoja`"
              class="h-11 w-14 rounded-xl border border-line bg-bg text-center text-lg font-bold"
              data-numeric
              @change="onTarget({ block: b, exercise: e }, 'sets', $event)"
            />
            <span class="text-ink-muted">sarjaa ×</span>
            <input
              :value="measurementOf(entry.exerciseId) === 'time' ? targetOf(entry).durationSec : targetOf(entry).reps"
              type="text"
              inputmode="numeric"
              :aria-label="`${nameOf(entry.exerciseId)}: ${measurementOf(entry.exerciseId) === 'time' ? 'sekuntia' : 'toistoja'}`"
              class="h-11 w-16 rounded-xl border border-line bg-bg text-center text-lg font-bold"
              data-numeric
              @change="onTarget({ block: b, exercise: e }, 'value', $event)"
            />
            <span class="text-ink-muted">
              {{ measurementOf(entry.exerciseId) === 'time' ? 's' : 'toistoa' }}
            </span>
            <span
              v-if="block.exercises.length === 1"
              class="ml-auto text-[13px] text-ink-muted"
              data-numeric
            >
              lepo {{ block.restSec }} s
            </span>
          </div>
        </div>

        <p v-if="block.exercises.length > 1" class="text-[13px] text-ink-muted" data-numeric>
          Lepo kierroksen jälkeen {{ block.restSec }} s
        </p>
      </section>

      <button
        type="button"
        class="mt-1 flex min-h-13 items-center justify-center rounded-(--radius-button) border border-dashed border-ink-muted text-base font-semibold"
        @click="pickerOpen = true"
      >
        + Lisää liike
      </button>

      <!-- Muutokset tallentuvat heti, joten Valmis vain palaa takaisin. Se kertoo, että kaikki on tallessa. -->
      <RouterLink
        :to="backTo"
        class="mt-3 flex min-h-13 items-center justify-center rounded-full bg-action text-base font-semibold text-on-action"
      >
        Valmis
      </RouterLink>
      <p class="-mt-1 text-center text-[13px] text-ink-muted">Muutokset tallentuvat automaattisesti.</p>

      <!-- Poisto vahvistetaan, koska pohjan rakentaminen on työtä. -->
      <div class="mt-2 mb-6">
        <button
          v-if="!confirmingDelete"
          type="button"
          class="min-h-11 w-full text-sm font-semibold text-ink-muted underline"
          @click="confirmingDelete = true"
        >
          Poista treeni
        </button>
        <div v-else class="rounded-(--radius-card) bg-surface p-3.5">
          <p class="text-[15px]">
            Poistetaanko {{ template.name }}? Tehdyt treenit säilyvät päiväkirjassa.
          </p>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold"
              @click="confirmingDelete = false"
            >
              Peruuta
            </button>
            <button
              type="button"
              class="min-h-11 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action"
              @click="deleteTemplate"
            >
              Poista
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Liikkeen valikko: harvoin tarvittavat toiminnot, jotta rivi pysyy väljänä. -->
    <dialog
      ref="menu"
      :aria-label="menuEntry ? nameOf(menuEntry.exerciseId) : 'Liike'"
      class="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-[480px] flex-col rounded-t-3xl bg-bg p-0 text-ink backdrop:bg-black/40 open:flex"
      @close="closeMenu"
      @click="onMenuBackdrop"
    >
      <template v-if="menuAt && menuEntry && menuBlock && template">
        <h2 class="px-5 pt-5 font-display text-[22px] leading-tight font-bold tracking-[-0.02em]">
          {{ nameOf(menuEntry.exerciseId) }}
        </h2>

        <div class="flex flex-col gap-2 px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="!canMove(template, menuAt, -1)"
              class="min-h-12 flex-1 rounded-(--radius-button) border border-line font-semibold disabled:opacity-40"
              @click="act((t, at) => move(t, at, -1))"
            >
              ↑ Siirrä ylös
            </button>
            <button
              type="button"
              :disabled="!canMove(template, menuAt, 1)"
              class="min-h-12 flex-1 rounded-(--radius-button) border border-line font-semibold disabled:opacity-40"
              @click="act((t, at) => move(t, at, 1))"
            >
              ↓ Siirrä alas
            </button>
          </div>

          <button
            v-if="inSuperset"
            type="button"
            class="min-h-12 rounded-(--radius-button) border border-line font-semibold"
            @click="act((t, at) => detach(t, at, newBlockId()))"
          >
            Erota supersarjasta
          </button>
          <button
            v-else-if="canJoin(template, menuAt.block)"
            type="button"
            class="flex min-h-12 flex-col items-center justify-center rounded-(--radius-button) border border-line px-3 py-2 font-semibold"
            @click="act((t, at) => joinWithPrevious(t, at.block))"
          >
            Supersarjaksi edellisen kanssa
            <span class="text-[13px] font-normal text-ink-muted">{{ previousNames }}</span>
          </button>

          <div class="flex items-center justify-between gap-3 rounded-(--radius-button) border border-line px-3.5 py-1.5">
            <span class="text-[15px] font-semibold">
              {{ inSuperset ? 'Lepo kierroksen jälkeen' : 'Lepo sarjojen välissä' }}
            </span>
            <span class="flex items-center gap-1">
              <button
                type="button"
                aria-label="Lyhennä lepoa"
                :disabled="menuBlock.restSec <= 0"
                class="flex size-11 items-center justify-center rounded-full text-xl font-bold disabled:opacity-40"
                @click="changeRest(-REST_STEP_SEC)"
              >
                −
              </button>
              <span class="w-14 text-center text-lg font-bold" aria-live="polite" data-numeric>
                {{ menuBlock.restSec }} s
              </span>
              <button
                type="button"
                aria-label="Pidennä lepoa"
                :disabled="menuBlock.restSec >= MAX_REST_SEC"
                class="flex size-11 items-center justify-center rounded-full text-xl font-bold disabled:opacity-40"
                @click="changeRest(REST_STEP_SEC)"
              >
                +
              </button>
            </span>
          </div>

          <button
            type="button"
            class="min-h-12 rounded-(--radius-button) border border-line font-semibold"
            @click="act(removeExercise)"
          >
            Poista liike
          </button>
          <button type="button" class="min-h-12 font-semibold text-ink-muted" @click="closeMenu">
            Valmis
          </button>
        </div>
      </template>
    </dialog>

    <ExercisePicker
      :open="pickerOpen"
      title="Lisää liike"
      @select="onPick"
      @close="pickerOpen = false"
    />
  </div>
</template>
