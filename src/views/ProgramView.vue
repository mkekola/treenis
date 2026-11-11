<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProgramChips from '@/components/ProgramChips.vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { programProgress, templatesOf } from '@/lib/program'
import { exerciseCount } from '@/lib/template'
import { useExercises } from '@/stores/exercises'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'
import { DEFAULT_PROGRAM_COLOR, PROGRAM_COLORS, programVars } from '@/design/programPalette'
import { PROGRAM_LEVEL_LABELS, type Program, type ProgramLevel, type WorkoutTemplate } from '@/types/workout'

const route = useRoute()
const router = useRouter()
const programs = usePrograms()
const templates = useTemplates()
const exercises = useExercises()
const workouts = useWorkouts()
const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor('strength'), isDark.value))

const program = computed(() => programs.byId(String(route.params.id)))
const isActive = computed(() => program.value !== undefined && programs.active?.id === program.value.id)
const list = computed(() => (program.value ? templatesOf(program.value, templates.templates) : []))

/** Edistyminen näytetään vain käytössä olevalle ohjelmalle. */
const progress = computed(() =>
  program.value && isActive.value ? programProgress(program.value, workouts.workouts, new Date()) : null,
)

const tonnes = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 1 })
const formatTonnes = (kg: number) => (kg >= 1000 ? `${tonnes.format(kg / 1000)} t` : `${Math.round(kg)} kg`)

/** Liikkeiden nimet kortille, jotta treenit erottaa toisistaan avaamatta. */
const summary = (template: WorkoutTemplate) =>
  template.blocks
    .flatMap((block) => block.exercises)
    .map((entry) => exercises.byId.get(entry.exerciseId)?.name ?? 'Tuntematon liike')
    .join(', ')

// ------------------------------------------------------------------- nimi

const nameText = ref(program.value?.name ?? '')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

watch(
  () => program.value?.name,
  (name) => {
    if (name !== undefined) nameText.value = name
  },
)

function commitName() {
  if (!program.value) return
  const name = nameText.value.trim()
  if (!name) {
    nameText.value = program.value.name
    return
  }
  if (name !== program.value.name) void programs.save({ ...program.value, name })
}

// Uusi ohjelma avautuu nimi valittuna, jotta "Uusi ohjelma" korvautuu kirjoittamalla.
onMounted(async () => {
  if (route.query.uusi !== '1') return
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
})

// ---------------------------------------------------------------- tiedot

const currentColor = computed(() => program.value?.color ?? DEFAULT_PROGRAM_COLOR)

/** Tavallisimmat jaksojen pituudet. Jo tallennettu muu arvo pysyy listalla. */
const durationOptions = computed(() => {
  const common = [4, 6, 8, 10, 12, 16]
  const current = program.value?.durationWeeks
  return current && !common.includes(current) ? [...common, current].sort((a, b) => a - b) : common
})

function update(change: Partial<Program>) {
  if (program.value) void programs.save({ ...program.value, ...change })
}

function onDuration(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  update({ durationWeeks: value > 0 ? value : undefined })
}

function onLevel(event: Event) {
  const value = (event.target as HTMLSelectElement).value as ProgramLevel | ''
  update({ level: value || undefined })
}

// ------------------------------------------------------------ toiminnot

async function addWorkout() {
  if (!program.value) return
  const id = await programs.createTemplate(program.value.id)
  if (id) {
    await router.push({
      name: 'template-edit',
      params: { programId: program.value.id, id },
      query: { uusi: '1' },
    })
  }
}

const confirmingDelete = ref(false)

async function deleteProgram() {
  if (!program.value) return
  await programs.remove(program.value.id)
  await router.replace({ name: 'programs' })
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-3 px-5 pt-5" :style="vars">
    <RouterLink
      :to="{ name: 'programs' }"
      aria-label="Takaisin ohjelmiin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>

    <p v-if="!program" class="py-6 text-center text-sm text-ink-muted">
      Ohjelmaa ei löytynyt. Se on ehkä poistettu toisella laitteella.
    </p>

    <template v-else>
      <!-- Juliste: sama ilme kuin ohjelmakortissa, ja käytössä olevalle ohjelmalle edistyminen. -->
      <section
        :style="programVars(program.color, isDark)"
        class="relative flex flex-col gap-3 overflow-hidden rounded-(--radius-feature) bg-[var(--program-surface)] p-4 text-[var(--program-on)]"
        aria-label="Ohjelma"
      >
        <SportIcon
          sport="strength"
          :size="220"
          class="pointer-events-none absolute -top-8 -right-16 opacity-20"
        />
        <span
          v-if="isActive"
          class="relative self-start rounded-full bg-[color-mix(in_srgb,var(--program-on)_18%,transparent)] px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase"
        >
          Käytössä
        </span>
        <label for="ohjelman-nimi" class="sr-only">Ohjelman nimi</label>
        <input
          id="ohjelman-nimi"
          ref="nameInput"
          v-model="nameText"
          type="text"
          enterkeyhint="done"
          class="relative -mx-2 min-w-0 rounded-(--radius-field) bg-transparent px-2 py-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em] text-[var(--program-on)] focus:bg-[color-mix(in_srgb,var(--program-on)_14%,transparent)]"
          @change="commitName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <ProgramChips :program="program" long class="relative" />

        <div v-if="progress" class="relative flex flex-col gap-2 pt-1">
          <p class="flex items-baseline justify-between text-[13px]">
            <span>Edistyminen</span>
            <span>
              <span class="font-display text-[20px] font-bold" data-numeric>Viikko {{ progress.week }}</span>
              <span v-if="progress.totalWeeks" data-numeric> / {{ progress.totalWeeks }}</span>
            </span>
          </p>
          <div
            v-if="progress.totalWeeks"
            class="grid gap-[3px]"
            :style="{ gridTemplateColumns: `repeat(${progress.totalWeeks}, 1fr)` }"
            aria-hidden="true"
          >
            <span
              v-for="week in progress.totalWeeks"
              :key="week"
              class="h-1.5 rounded-full bg-[var(--program-on)]"
              :class="week <= progress.week ? '' : 'opacity-25'"
            />
          </div>
          <p class="text-[13px]" data-numeric>
            {{ progress.planned ? `${progress.done} / ${progress.planned}` : progress.done }} treeniä
            <span v-if="progress.volumeKg > 0">· {{ formatTonnes(progress.volumeKg) }} nostettu</span>
          </p>
        </div>
      </section>

      <button
        v-if="!isActive"
        type="button"
        class="min-h-12 rounded-(--radius-button) bg-action font-semibold text-on-action"
        @click="programs.makeActive(program.id)"
      >
        Ota käyttöön
      </button>

      <h2 class="mt-2 text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Treenit
      </h2>

      <RouterLink
        v-for="template in list"
        :key="template.id"
        :to="{ name: 'template-edit', params: { programId: program.id, id: template.id } }"
        class="flex items-center gap-3 rounded-(--radius-card) bg-surface p-3.5"
      >
        <span
          aria-hidden="true"
          class="flex size-13 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]"
        >
          <SportIcon sport="strength" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[17px] font-semibold tracking-[-0.01em]">{{ template.name }}</span>
          <span class="mt-0.5 block text-[13px] text-ink-muted" data-numeric>
            {{ exerciseCount(template) }} liikettä
          </span>
          <span v-if="exerciseCount(template)" class="block truncate text-[13px] text-ink-muted">
            {{ summary(template) }}
          </span>
        </span>
        <svg class="size-[18px] flex-none text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9,6 15,12 9,18" />
        </svg>
      </RouterLink>

      <p v-if="!list.length" class="text-[13px] text-ink-muted">
        Ei vielä treenejä. Lisää ensimmäinen, esimerkiksi ylä- tai alakropan päivä.
      </p>

      <button
        type="button"
        class="mt-1 flex min-h-13 items-center justify-center rounded-(--radius-button) border border-dashed border-ink-muted text-base font-semibold"
        @click="addWorkout"
      >
        + Lisää treeni
      </button>

      <!-- Ohjelman tiedot: väri erottaa ohjelmat toisistaan, kesto ja taso näkyvät kortilla. -->
      <section class="mt-3 flex flex-col gap-3 rounded-(--radius-feature) bg-surface p-3.5" aria-labelledby="ohjelman-tiedot">
        <h2 id="ohjelman-tiedot" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Tiedot
        </h2>

        <!-- Seitsemän väriä yhdellä rivillä: yksin jäävä väri näyttäisi unohtuneelta. -->
        <fieldset class="grid grid-cols-7 gap-1.5">
          <legend class="sr-only">Ohjelman väri</legend>
          <label
            v-for="color in PROGRAM_COLORS"
            :key="color.id"
            :style="programVars(color.id, isDark)"
            class="flex justify-center"
          >
            <input
              type="radio"
              name="ohjelman-vari"
              class="peer sr-only"
              :value="color.id"
              :checked="currentColor === color.id"
              @change="update({ color: color.id })"
            />
            <span class="sr-only">{{ color.name }}</span>
            <span
              aria-hidden="true"
              class="flex aspect-square w-full max-w-11 items-center justify-center rounded-full bg-[var(--program-surface)] text-[var(--program-on)] peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2"
            >
              <svg
                v-if="currentColor === color.id"
                class="size-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="5,13 10,18 19,7" />
              </svg>
            </span>
          </label>
        </fieldset>

        <div class="grid grid-cols-2 gap-2">
          <label class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Kesto
            <select
              :value="program.durationWeeks ?? ''"
              class="mt-1 block h-12 w-full rounded-(--radius-field) border border-line bg-bg px-3 text-[15px] font-normal tracking-normal text-ink normal-case"
              @change="onDuration"
            >
              <option value="">Ei kestoa</option>
              <option v-for="weeks in durationOptions" :key="weeks" :value="weeks">{{ weeks }} viikkoa</option>
            </select>
          </label>
          <label class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Taso
            <select
              :value="program.level ?? ''"
              class="mt-1 block h-12 w-full rounded-(--radius-field) border border-line bg-bg px-3 text-[15px] font-normal tracking-normal text-ink normal-case"
              @change="onLevel"
            >
              <option value="">Ei tasoa</option>
              <option v-for="(label, level) in PROGRAM_LEVEL_LABELS" :key="level" :value="level">
                {{ label }}
              </option>
            </select>
          </label>
        </div>
      </section>

      <!-- Poisto vahvistetaan: se vie ohjelman treenit mukanaan. -->
      <div class="mt-4 mb-6">
        <button
          v-if="!confirmingDelete"
          type="button"
          class="min-h-11 w-full text-sm font-semibold text-ink-muted underline"
          @click="confirmingDelete = true"
        >
          Poista ohjelma
        </button>
        <div v-else class="rounded-(--radius-card) bg-surface p-3.5">
          <p class="text-[15px]">
            Poistetaanko {{ program.name }} ja sen {{ list.length }} treeniä? Tehdyt treenit
            säilyvät päiväkirjassa.
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
              @click="deleteProgram"
            >
              Poista
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
