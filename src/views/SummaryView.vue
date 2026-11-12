<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { recurringDeviations, type Deviation } from '@/lib/deviation'
import { durationParts, formatDurationShort, formatShortDate } from '@/lib/format'
import { startedAtOf, timeOf } from '@/lib/manual'
import { findRecords } from '@/lib/records'
import { localDate, progress, toWorkout, withTiming } from '@/lib/session'
import { totalVolumeKg } from '@/lib/workout'
import DateChips from '@/components/DateChips.vue'
import DurationInput from '@/components/DurationInput.vue'
import SaveTemplateSheet from '@/components/SaveTemplateSheet.vue'
import { useTheme } from '@/composables/useTheme'
import { useExercises } from '@/stores/exercises'
import { useSession } from '@/stores/session'
import { recordVars, sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'

const router = useRouter()
const session = useSession()
const exercises = useExercises()
const workouts = useWorkouts()
const templates = useTemplates()
const { isDark } = useTheme()
const colors = useSportColors()
const vars = computed(() => sportVars(colors.swatchFor('strength'), isDark.value))

// Ilman käynnissä olevaa treeniä tälle sivulle ei ole asiaa.
onBeforeMount(() => {
  if (!session.active) void router.replace('/')
})

const active = computed(() => session.active)

/** Kesto lasketaan yhteenvedon avaushetkellä, ei kasvamaan jäävänä kellona. */
const openedAt = new Date()

const timed = computed(() => (active.value ? toWorkout(active.value, openedAt) : null))

// Ajankohdan voi korjata, kun treeni kirjataan jälkikäteen: oletuksena ajastimen arvot.
const editingWhen = ref(false)
const date = ref(active.value ? localDate(new Date(active.value.startedAt)) : '')
const startTime = ref(active.value ? timeOf(active.value.startedAt) : '')
const durationSec = ref(timed.value?.logged?.durationSec ?? 0)
const timerSec = timed.value?.logged?.durationSec ?? 0

const timing = computed(() => ({
  date: date.value,
  startedAt: startedAtOf(date.value, startTime.value),
  durationSec: durationSec.value,
}))
const workout = computed(() => (timed.value ? withTiming(timed.value, timing.value) : null))
const counts = computed(() => (active.value ? progress(active.value) : { done: 0, total: 0 }))

const volume = computed(() =>
  workout.value
    ? totalVolumeKg(workout.value, (id) => exercises.byId.get(id)?.perSide ?? false)
    : 0,
)

const records = computed(() =>
  active.value
    ? findRecords(
        active.value.blocks.flatMap((block) => block.exercises),
        workouts.workouts,
      )
    : [],
)

const nameOf = (exerciseId: string) => exercises.byId.get(exerciseId)?.name ?? exerciseId

const kgFormat = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 })
const kg = (value: number) => kgFormat.format(value)

const notes = ref(active.value?.notes ?? '')

// Tyhjästä aloitetun treenin voi tallentaa pohjaksi. Pohjasta aloitettua ei,
// koska sen muutokset käsitellään pohjan päivityksenä.
const canSaveTemplate = computed(() => !active.value?.templateId)
const savingTemplate = ref(false)
const savedTemplate = ref('')

// Pohjasta aloitettu treeni: sama muutos myös viime kerralla → kysytään pohjan päivityksestä.
const template = computed(() => templates.templates.find((t) => t.id === active.value?.templateId))
const recurring = computed(() =>
  template.value && workout.value
    ? recurringDeviations(template.value, workout.value, workouts.workouts)
    : [],
)

// Päätöksen jälkeen kortti näyttää vahvistuksen. Muutokset otetaan talteen,
// koska päivitetty pohja ei enää poikkea eikä lista muuten jäisi näkyviin.
const decided = ref<{ choice: 'update' | 'keep'; templateName: string } | null>(null)

function describe(d: Deviation): string {
  switch (d.kind) {
    case 'swap':
      return `${nameOf(d.fromId)} → ${nameOf(d.toId)}`
    case 'sets':
      return `${nameOf(d.exerciseId)}: ${d.from} → ${d.to} sarjaa`
    case 'add':
      return `Uusi liike: ${nameOf(d.exerciseId)}`
    case 'remove':
      return `Pois: ${nameOf(d.exerciseId)}`
  }
}

async function decide(choice: 'update' | 'keep') {
  const changes = recurring.value
  const templateName = template.value?.name ?? ''
  if (choice === 'update') await session.updateTemplate(changes)
  else await session.keepTemplate(changes)
  decided.value = { choice, templateName }
}

function onTemplateSaved(templateName: string, programName: string) {
  savingTemplate.value = false
  savedTemplate.value = `${templateName} tallennettu ohjelmaan ${programName}.`
}

async function finish() {
  await session.finish(timing.value)
  await router.push('/')
}

async function discard() {
  await session.discard()
  await router.push('/')
}
</script>

<template>
  <div v-if="active && workout" class="flex min-h-dvh flex-col px-5 pt-5 pb-6">
    <RouterLink
      to="/treeni"
      aria-label="Takaisin treeniin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>

    <p class="mt-3.5 text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
      {{ active.title }} · {{ formatShortDate(date) }}
    </p>
    <h1 class="mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">
      Treeni valmis
    </h1>

    <!-- Ei yhtään tehtyä sarjaa: tallennettava ei ole mitään, joten tarjotaan hylkäys. -->
    <template v-if="counts.done === 0">
      <p class="mt-4 text-[15px]">Et kirjannut yhtään sarjaa, joten tästä ei tallennu mitään.</p>
      <div class="flex-1" />
      <div class="mt-4 flex flex-col gap-2">
        <RouterLink
          to="/treeni"
          class="flex min-h-13 items-center justify-center rounded-(--radius-button) border border-line text-base font-semibold"
        >
          Takaisin treeniin
        </RouterLink>
        <button
          type="button"
          class="min-h-13 rounded-(--radius-button) bg-action text-base font-semibold text-on-action"
          @click="discard"
        >
          Hylkää treeni
        </button>
      </div>
    </template>

    <template v-else>
      <!-- Luvut. Kesto on oma ajastus kunnes Strava täydentää sen. -->
      <section class="mt-3.5 rounded-(--radius-feature) bg-surface p-4">
        <div class="grid grid-cols-3 gap-2">
          <p>
            <span class="block text-[26px] font-bold tracking-[-0.02em]" data-numeric>
              {{ counts.done }}
            </span>
            <span class="text-xs text-ink-muted">sarjaa</span>
          </p>
          <p class="border-l border-line pl-3">
            <span class="block text-[26px] font-bold tracking-[-0.02em]" data-numeric>
              {{ volume > 0 ? kg(Math.round(volume)) : '–' }}
              <span v-if="volume > 0" class="text-[13px] font-medium text-ink-muted">kg</span>
            </span>
            <span class="text-xs text-ink-muted">tilavuus</span>
          </p>
          <p class="border-l border-line pl-3">
            <span class="block text-[26px] font-bold tracking-[-0.02em]" data-numeric>
              <template v-for="(part, i) in durationParts(workout.logged?.durationSec ?? 0)" :key="part.unit"
                >{{ i > 0 ? ' ' : '' }}{{ part.value
                }}<span class="text-[13px] font-medium text-ink-muted">&#8239;{{ part.unit }}</span></template
              >
            </span>
            <span class="text-xs text-ink-muted">kesto</span>
          </p>
        </div>
        <p class="mt-2.5 text-xs text-ink-muted">
          Kello täydentää keston ja sykkeen kun Strava synkkaa.
        </p>
      </section>

      <!-- Ajankohta: jälkikäteen kirjatulle treenille oikea päivä ja kesto. -->
      <section :style="vars" aria-labelledby="ajankohta" class="mt-2.5 rounded-(--radius-feature) bg-surface p-3.5">
        <div class="flex items-center justify-between gap-2">
          <h2 id="ajankohta" class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Ajankohta</h2>
          <button
            type="button"
            :aria-expanded="editingWhen"
            aria-controls="ajankohdan-kentat"
            class="min-h-9 rounded-full px-2 text-sm font-semibold"
            @click="editingWhen = !editingWhen"
          >
            {{ editingWhen ? 'Valmis' : 'Muokkaa' }}
          </button>
        </div>
        <p v-if="!editingWhen" class="text-[15px]" data-numeric>
          {{ formatShortDate(date) }}<template v-if="startTime"> klo {{ startTime.replace(':', '.') }}</template>
          · {{ formatDurationShort(durationSec) }}
        </p>
        <div v-else id="ajankohdan-kentat" class="mt-1 flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <span id="ajankohta-paiva" class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Päivä</span>
            <DateChips v-model="date" label-id="ajankohta-paiva" />
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <label class="flex min-w-0 flex-col gap-1">
              <span class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Alkoi klo</span>
              <input
                id="ajankohta-alku"
                v-model="startTime"
                type="time"
                class="h-12 w-full min-w-0 rounded-(--radius-field) border border-line bg-bg px-3 text-base"
                data-numeric
              />
            </label>
            <div class="flex min-w-0 flex-col gap-1">
              <span id="ajankohta-kesto" class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Kesto</span>
              <DurationInput v-model="durationSec" label-id="ajankohta-kesto" />
            </div>
          </div>
          <p class="text-[13px] text-ink-muted" data-numeric>
            Ajastimen mukaan {{ formatDurationShort(timerSec) }}. Korjaa, jos kirjasit treenin jälkikäteen.
          </p>
        </div>
      </section>

      <!-- Ennätykset: ruusunpunainen on varattu vain näille. -->
      <section
        v-if="records.length"
        :style="recordVars(isDark)"
        class="mt-2.5 rounded-(--radius-feature) bg-surface p-3.5"
      >
        <h2 class="mb-2 text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Ennätykset
        </h2>
        <ul class="flex flex-col gap-1.5">
          <li v-for="record in records" :key="record.exerciseId" class="flex items-center gap-2.5">
            <span class="min-w-0 flex-1 text-[15px] font-semibold">
              {{ nameOf(record.exerciseId) }}
            </span>
            <span class="text-[15px] font-bold" data-numeric>{{ kg(record.weightKg) }} kg</span>
            <span
              class="rounded-full bg-[var(--record-surface)] px-2 py-0.5 text-[11px] font-bold text-[var(--record-on)]"
              data-numeric
            >
              +{{ kg(record.deltaKg) }}
            </span>
          </li>
        </ul>
      </section>

      <div class="mt-2.5">
        <label
          for="muistiinpano"
          class="mb-1.5 block text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
        >
          Muistiinpano
        </label>
        <textarea
          id="muistiinpano"
          v-model="notes"
          rows="2"
          placeholder="Miltä tuntui?"
          class="w-full resize-none rounded-(--radius-field) border border-line bg-surface px-3 py-2.5 text-[15px]"
          @input="session.setNotes(notes)"
        />
      </div>

      <div class="flex-1" />

      <p v-if="decided" role="status" class="mt-4 text-center text-[13px] text-ink-muted">
        <template v-if="decided.choice === 'update'">{{ decided.templateName }} päivitetty.</template>
        <template v-else>
          {{ decided.templateName }} pysyy ennallaan, eikä näistä muutoksista kysytä uudelleen.
        </template>
      </p>
      <section
        v-else-if="recurring.length"
        aria-labelledby="pohjan-paivitys"
        class="mt-4 rounded-(--radius-feature) bg-surface p-4"
      >
        <h2 id="pohjan-paivitys" class="text-[17px] font-semibold tracking-[-0.01em]">
          Päivitetäänkö {{ template?.name }}?
        </h2>
        <p class="mt-0.5 text-[13px] text-ink-muted">Teit nämä muutokset myös viime kerralla.</p>
        <ul class="mt-2.5 flex flex-col gap-1 text-[15px]">
          <li v-for="d in recurring" :key="d.key">{{ describe(d) }}</li>
        </ul>
        <div class="mt-3.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="min-h-11 rounded-(--radius-button) border border-line text-[15px] font-semibold"
            @click="decide('keep')"
          >
            Pidä vanha
          </button>
          <button
            type="button"
            class="min-h-11 rounded-(--radius-button) border border-line text-[15px] font-semibold"
            @click="decide('update')"
          >
            Päivitä pohja
          </button>
        </div>
      </section>

      <template v-if="canSaveTemplate">
        <p v-if="savedTemplate" role="status" class="mt-4 text-center text-[13px] text-ink-muted">
          {{ savedTemplate }}
        </p>
        <button
          v-else
          type="button"
          class="mt-4 min-h-13 rounded-(--radius-button) border border-line text-base font-semibold"
          @click="savingTemplate = true"
        >
          Tallenna pohjaksi…
        </button>
      </template>

      <button
        type="button"
        :class="canSaveTemplate ? 'mt-2' : 'mt-4'"
        class="min-h-13 rounded-(--radius-button) bg-action text-base font-semibold text-on-action"
        @click="finish"
      >
        Valmis
      </button>

      <SaveTemplateSheet
        :open="savingTemplate"
        :session="active"
        @close="savingTemplate = false"
        @saved="onTemplateSaved"
      />
    </template>
  </div>
</template>
