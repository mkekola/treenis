<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import {
  addSegment,
  canMoveSegment,
  moveSegment,
  paceText,
  parsePace,
  removeSegment,
  totalsText,
  updateSegment,
} from '@/lib/cardio'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'
import {
  CARDIO_ZONE_LABELS,
  SPORT_LABELS,
  type CardioAmount,
  type CardioSegment,
  type CardioUnit,
  type CardioZone,
  type WorkoutTemplate,
} from '@/types/workout'

/**
 * Kestävyyspohjan muokkaus: osiot kuin salipohjan liikkeet. Jokainen muutos
 * tallentuu heti, kuten salipohjassa.
 */
const WORK_UNITS: CardioUnit[] = ['min', 's', 'km', 'm']
const RECOVERY_UNITS: CardioUnit[] = ['s', 'min', 'm']
const ZONES = Object.keys(CARDIO_ZONE_LABELS) as CardioZone[]
const MAX_REPS = 50

const route = useRoute()
const router = useRouter()
const templates = useTemplates()
const programs = usePrograms()
const colors = useSportColors()
const { isDark } = useTheme()

const template = computed(() => templates.templates.find((t) => t.id === route.params.id))
const program = computed(() => programs.byId(String(route.params.programId)))
const sport = computed(() => template.value?.sport ?? 'run')
const vars = computed(() => sportVars(colors.swatchFor(sport.value), isDark.value))
const backTo = computed(() =>
  program.value ? { name: 'program', params: { id: program.value.id } } : { name: 'programs' },
)
const segments = computed(() => template.value?.segments ?? [])
const totals = computed(() => (template.value ? totalsText(template.value) : ''))

function update(next: WorkoutTemplate) {
  void templates.save(next)
}

function change(index: number, patch: Partial<CardioSegment>) {
  if (template.value) update(updateSegment(template.value, index, patch))
}

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
  if (name !== template.value.name) update({ ...template.value, name })
}

// Uusi pohja avautuu nimi valittuna, jotta lajin nimen voi korvata kirjoittamalla.
onMounted(async () => {
  if (route.query.uusi !== '1') return
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
})

// ---------------------------------------------------------------- kentät

const input = (event: Event) => event.target as HTMLInputElement

/** Positiivinen luku, pilkku tai piste desimaalina. Muuten undefined. */
function positive(text: string): number | undefined {
  const value = Number(text.replace(',', '.').trim())
  return text.trim() && Number.isFinite(value) && value > 0 ? value : undefined
}

/** Virheellinen syöte palaa tallennettuun arvoon, jotta kenttä ei jää valehtelemaan. */
function onReps(index: number, event: Event) {
  const value = positive(input(event).value)
  if (value === undefined || !Number.isInteger(value) || value > MAX_REPS) {
    input(event).value = String(segments.value[index].reps)
    return
  }
  change(index, { reps: value })
}

function onWork(index: number, event: Event) {
  const value = positive(input(event).value)
  if (value === undefined) {
    input(event).value = String(segments.value[index].work.value)
    return
  }
  change(index, { work: { ...segments.value[index].work, value } })
}

function setWorkUnit(index: number, unit: CardioUnit) {
  change(index, { work: { ...segments.value[index].work, unit } })
}

/** Tyhjä palautus poistaa sen. Pelkkä yksikön valinta tallentaa palautuksen nollana, eli ei vielä palautusta. */
function onRecovery(index: number, event: Event) {
  const text = input(event).value
  const value = positive(text)
  const current = segments.value[index].recovery
  if (!text.trim()) {
    change(index, { recovery: undefined })
    return
  }
  if (value === undefined) {
    input(event).value = current ? String(current.value) : ''
    return
  }
  change(index, { recovery: { unit: current?.unit ?? 's', value } })
}

function setRecoveryUnit(index: number, unit: CardioUnit) {
  const current: CardioAmount = segments.value[index].recovery ?? { value: 0, unit }
  change(index, { recovery: { ...current, unit } })
}

function onName(index: number, event: Event) {
  change(index, { name: input(event).value.trim() })
}

// -------------------------------------------------------------- tavoitteet

/** Tavoitteet näkyvät, kun jokin on asetettu tai käyttäjä avasi ne. */
const goalsOpen = ref(new Set<string>())
const showGoals = (segment: CardioSegment) =>
  goalsOpen.value.has(segment.id) || Boolean(segment.zone || segment.paceSecPerKm || segment.heartRate)

function openGoals(segment: CardioSegment) {
  goalsOpen.value = new Set([...goalsOpen.value, segment.id])
}

function toggleZone(index: number, zone: CardioZone) {
  change(index, { zone: segments.value[index].zone === zone ? undefined : zone })
}

function onPace(index: number, event: Event) {
  const text = input(event).value
  const pace = parsePace(text)
  if (text.trim() && pace === undefined) {
    const current = segments.value[index].paceSecPerKm
    input(event).value = current ? paceText(current) : ''
    return
  }
  change(index, { paceSecPerKm: pace })
}

function onHeartRate(index: number, event: Event) {
  const text = input(event).value
  const value = positive(text)
  if (text.trim() && (value === undefined || !Number.isInteger(value) || value < 40 || value > 230)) {
    input(event).value = segments.value[index].heartRate ? String(segments.value[index].heartRate) : ''
    return
  }
  change(index, { heartRate: value })
}

// --------------------------------------------------------------- osiot

/** Osio, jonka siirto- ja poistotoiminnot ovat auki. */
const menuOpen = ref<string | null>(null)

function add() {
  if (template.value) update(addSegment(template.value, crypto.randomUUID()))
}

function move(index: number, direction: -1 | 1) {
  if (template.value) update(moveSegment(template.value, index, direction))
}

function remove(index: number) {
  if (!template.value) return
  menuOpen.value = null
  update(removeSegment(template.value, index))
}

// ------------------------------------------------------------ toiminnot

/** Tehty treeni kirjataan päiväkirjaan tämän pohjan pohjalta. */
function logDone() {
  if (template.value) void router.push({ name: 'log-sport', params: { sport: sport.value }, query: { pohja: template.value.id } })
}

const confirmingDelete = ref(false)

async function deleteTemplate() {
  if (!template.value) return
  await programs.deleteTemplate(template.value.id)
  await router.replace(backTo.value)
}

const unitButton = (on: boolean) =>
  `min-h-8 rounded-full px-2.5 text-[13px] font-semibold ${on ? 'bg-bg text-ink' : 'text-ink-muted'}`
const numberField = 'h-11 rounded-xl border border-line bg-bg text-center text-lg font-bold'
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
      <div>
        <p class="text-[11px] font-bold tracking-[0.08em] text-[var(--sport-on)] uppercase">{{ SPORT_LABELS[sport] }}</p>
        <label for="pohjan-nimi" class="sr-only">Pohjan nimi</label>
        <input
          id="pohjan-nimi"
          ref="nameInput"
          v-model="nameText"
          type="text"
          enterkeyhint="done"
          class="-mx-2 w-full rounded-(--radius-field) bg-transparent px-2 py-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em] focus:bg-surface"
          @change="commitName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <p v-if="totals" class="text-[13px] text-ink-muted" data-numeric>{{ totals }}</p>
      </div>

      <p v-if="!segments.length" class="text-[13px] text-ink-muted">
        Lisää ensimmäinen osio, esimerkiksi 45 min peruskestävyyttä tai lämmittely ennen vetoja.
      </p>

      <section
        v-for="(segment, i) in segments"
        :key="segment.id"
        :aria-label="segment.name || `Osio ${i + 1}`"
        class="flex flex-col gap-2.5 rounded-(--radius-card) bg-surface p-3.5"
      >
        <div class="flex items-center gap-2">
          <label :for="`osio-${segment.id}`" class="sr-only">Osion nimi</label>
          <input
            :id="`osio-${segment.id}`"
            :value="segment.name"
            type="text"
            placeholder="Osion nimi, esim. Lämmittely"
            enterkeyhint="done"
            class="-mx-1 min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-base font-semibold placeholder:font-normal placeholder:text-ink-muted focus:bg-bg"
            @change="onName(i, $event)"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
          <button
            type="button"
            :aria-label="`Osion toiminnot: ${segment.name || `Osio ${i + 1}`}`"
            :aria-expanded="menuOpen === segment.id"
            class="-mr-1 flex size-11 flex-none items-center justify-center rounded-full"
            @click="menuOpen = menuOpen === segment.id ? null : segment.id"
          >
            <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>

        <div v-if="menuOpen === segment.id" class="flex gap-2">
          <button type="button" :disabled="!canMoveSegment(template, i, -1)" class="min-h-11 flex-1 rounded-(--radius-button) border border-line bg-bg text-sm font-semibold disabled:opacity-40" @click="move(i, -1)">
            ↑ Ylös
          </button>
          <button type="button" :disabled="!canMoveSegment(template, i, 1)" class="min-h-11 flex-1 rounded-(--radius-button) border border-line bg-bg text-sm font-semibold disabled:opacity-40" @click="move(i, 1)">
            ↓ Alas
          </button>
          <button type="button" class="min-h-11 flex-1 rounded-(--radius-button) border border-line bg-bg text-sm font-semibold" @click="remove(i)">
            Poista
          </button>
        </div>

        <!-- Toistot × kesto tai matka. Yksikkö kertoo, onko kyse ajasta vai matkasta. -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
          <input
            :value="segment.reps"
            type="text"
            inputmode="numeric"
            :aria-label="`${segment.name || `Osio ${i + 1}`}: toistot`"
            :class="[numberField, 'w-12']"
            data-numeric
            @change="onReps(i, $event)"
          />
          <span class="text-ink-muted" aria-hidden="true">×</span>
          <input
            :value="segment.work.value.toLocaleString('fi-FI')"
            type="text"
            inputmode="decimal"
            :aria-label="`${segment.name || `Osio ${i + 1}`}: määrä`"
            :class="[numberField, 'w-18']"
            data-numeric
            @change="onWork(i, $event)"
          />
          <div role="group" :aria-label="`${segment.name || `Osio ${i + 1}`}: yksikkö`" class="flex rounded-full bg-track p-0.5">
            <button
              v-for="unit in WORK_UNITS"
              :key="unit"
              type="button"
              :aria-pressed="segment.work.unit === unit"
              :class="unitButton(segment.work.unit === unit)"
              @click="setWorkUnit(i, unit)"
            >
              {{ unit }}
            </button>
          </div>
        </div>

        <div v-if="segment.reps > 1" class="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span class="w-17 text-[13px] text-ink-muted">Palautus</span>
          <input
            :value="segment.recovery?.value ? segment.recovery.value.toLocaleString('fi-FI') : ''"
            type="text"
            inputmode="decimal"
            placeholder="–"
            :aria-label="`${segment.name || `Osio ${i + 1}`}: palautus`"
            :class="[numberField, 'w-18']"
            data-numeric
            @change="onRecovery(i, $event)"
          />
          <div role="group" :aria-label="`${segment.name || `Osio ${i + 1}`}: palautuksen yksikkö`" class="flex rounded-full bg-track p-0.5">
            <button
              v-for="unit in RECOVERY_UNITS"
              :key="unit"
              type="button"
              :aria-pressed="(segment.recovery?.unit ?? 's') === unit"
              :class="unitButton((segment.recovery?.unit ?? 's') === unit)"
              @click="setRecoveryUnit(i, unit)"
            >
              {{ unit }}
            </button>
          </div>
        </div>

        <!-- Tavoitteet ovat vapaaehtoisia: piilossa, kunnes niitä pyydetään tai jokin on asetettu. -->
        <template v-if="showGoals(segment)">
          <div role="group" :aria-label="`${segment.name || `Osio ${i + 1}`}: teho`" class="flex flex-wrap gap-1.5">
            <button
              v-for="zone in ZONES"
              :key="zone"
              type="button"
              :aria-pressed="segment.zone === zone"
              class="min-h-9 rounded-full px-3 text-[13px] font-bold"
              :class="segment.zone === zone ? 'bg-[var(--sport-surface)] text-[var(--sport-on)]' : 'bg-track text-ink-muted'"
              @click="toggleZone(i, zone)"
            >
              {{ CARDIO_ZONE_LABELS[zone] }}
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
            <label class="flex items-center gap-2">
              <span class="w-17 text-[13px] text-ink-muted">Vauhti</span>
              <input
                :value="segment.paceSecPerKm ? paceText(segment.paceSecPerKm) : ''"
                type="text"
                inputmode="decimal"
                placeholder="–"
                :class="[numberField, 'w-18 placeholder:font-normal placeholder:text-ink-muted']"
                data-numeric
                @change="onPace(i, $event)"
              />
              <span class="text-[13px] text-ink-muted">/km</span>
            </label>
            <label class="ml-auto flex items-center gap-2">
              <span class="text-[13px] text-ink-muted">Syke</span>
              <input
                :value="segment.heartRate ?? ''"
                type="text"
                inputmode="numeric"
                placeholder="–"
                :class="[numberField, 'w-16 placeholder:font-normal placeholder:text-ink-muted']"
                data-numeric
                @change="onHeartRate(i, $event)"
              />
            </label>
          </div>
        </template>
        <button
          v-else
          type="button"
          class="min-h-9 self-start text-[13px] font-semibold text-ink-muted underline"
          @click="openGoals(segment)"
        >
          + Lisää tavoite
        </button>
      </section>

      <button
        type="button"
        class="flex min-h-13 items-center justify-center rounded-(--radius-button) border border-dashed border-ink-muted text-base font-semibold"
        @click="add"
      >
        + Lisää osio
      </button>

      <button
        type="button"
        :disabled="!segments.length"
        class="mt-3 flex min-h-13 items-center justify-center rounded-full bg-action text-base font-semibold text-on-action disabled:opacity-40"
        @click="logDone"
      >
        Kirjaa tehdyksi
      </button>
      <RouterLink
        :to="backTo"
        class="flex min-h-13 items-center justify-center rounded-full border border-line text-base font-semibold"
      >
        Valmis
      </RouterLink>
      <p class="-mt-1 text-center text-[13px] text-ink-muted">Muutokset tallentuvat automaattisesti.</p>

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
          <p class="text-[15px]">Poistetaanko {{ template.name }}? Tehdyt treenit säilyvät päiväkirjassa.</p>
          <div class="mt-3 flex gap-2">
            <button type="button" class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold" @click="confirmingDelete = false">
              Peruuta
            </button>
            <button type="button" class="min-h-11 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action" @click="deleteTemplate">
              Poista
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
