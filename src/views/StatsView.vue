<script setup lang="ts">
import { computed, ref } from 'vue'
import ChartNumbers from '@/components/stats/ChartNumbers.vue'
import DaySheet from '@/components/stats/DaySheet.vue'
import FootChart from '@/components/stats/FootChart.vue'
import PeriodCalendar from '@/components/stats/PeriodCalendar.vue'
import Sparkline from '@/components/stats/Sparkline.vue'
import YearGrid from '@/components/stats/YearGrid.vue'
import WorkoutSheet from '@/components/WorkoutSheet.vue'
import { useNow } from '@/composables/useNow'
import { useTheme } from '@/composables/useTheme'
import { SPORT_GROUP_LABELS } from '@/design/sportGroups'
import { formatDurationShort } from '@/lib/format'
import { localDate } from '@/lib/session'
import {
  comparisonLabel,
  footBuckets,
  footMeters,
  inPeriod,
  liftProgress,
  periodLabel,
  periodOf,
  regularityRows,
  secondsByDay,
  secondsByGroup,
  shiftPeriod,
  sportTotals,
  totalSeconds,
  weekStreak,
  type StatsView,
} from '@/lib/stats'
import { useExercises } from '@/stores/exercises'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useWorkouts } from '@/stores/workouts'

const store = useWorkouts()
const exercises = useExercises()
const colors = useSportColors()
const { isDark } = useTheme()
const nowMs = useNow(60_000)
const today = computed(() => localDate(new Date(nowMs.value)))

const VIEWS: { value: StatsView; label: string }[] = [
  { value: 'week', label: 'Viikko' },
  { value: 'month', label: 'Kuukausi' },
  { value: 'year', label: 'Vuosi' },
]

const period = ref(periodOf('year', today.value))

function choose(view: StatsView) {
  period.value = periodOf(view, today.value)
}

const firstDate = computed(() => store.workouts.reduce((min, w) => (w.date < min ? w.date : min), today.value))
const canGoBack = computed(() => period.value.start > firstDate.value)
const canGoForward = computed(() => period.value.end <= today.value)

const workouts = computed(() => inPeriod(store.workouts, period.value))
const previous = computed(() => inPeriod(store.workouts, shiftPeriod(period.value, -1)))
const seconds = computed(() => totalSeconds(workouts.value))
const footKm = computed(() => footMeters(workouts.value) / 1000)

const kmFormat = (km: number) =>
  km.toLocaleString('fi-FI', { maximumFractionDigits: km > 0 && km < 10 ? 1 : 0 })

const delta = computed(() => {
  if (!previous.value.length) return ''
  const diff = workouts.value.length - previous.value.length
  return `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} treeniä ${comparisonLabel(period.value)} verrattuna`
})

// ------------------------------------------------------------- säännöllisyys

const byDay = computed(() => secondsByDay(workouts.value))
const regularity = computed(() => regularityRows(workouts.value, period.value))
const streak = computed(() => weekStreak(store.workouts, period.value, today.value))
const streakText = computed(() => {
  const s = streak.value
  const weeks = `${s.weeks} ${s.weeks === 1 ? 'viikko' : 'viikkoa'}`
  if (s.kind === 'past') return `pisin putki ${weeks} (väh. ${s.goal} treeniä)`
  const now = `tällä viikolla ${Math.min(s.thisWeek, s.goal)}/${s.goal}`
  return s.weeks ? `putki ${weeks} · ${now}` : now
})

// Kalenteripäivä avaa päivän treenit; treenin tiedot avautuvat niiden päälle,
// ja niiden sulkeminen palaa päivän listaan.
const selectedDay = ref<string | null>(null)
const selectedWorkoutId = ref<string | null>(null)
const selectedWorkout = computed(() => store.workouts.find((w) => w.id === selectedWorkoutId.value) ?? null)

async function removeWorkout(id: string) {
  selectedWorkoutId.value = null
  await store.remove(id)
}

// ---------------------------------------------------------------- tasapaino

const balance = computed(() =>
  secondsByGroup(workouts.value).map((row) => ({
    ...row,
    label: SPORT_GROUP_LABELS[row.group],
    share: Math.max(1, Math.round((row.seconds / seconds.value) * 100)),
    vars: sportVars(colors.swatchForGroup(row.group), isDark.value),
  })),
)

// ---------------------------------------------------------------- kestävyys

const buckets = computed(() => footBuckets(workouts.value, period.value, today.value))
const hasFoot = computed(() => buckets.value.some((b) => b.meters > 0))
const landVars = computed(() => sportVars(colors.swatchForGroup('land'), isDark.value))
const otherDistance = computed(() =>
  [
    { label: 'Pyöräily', ...sportTotals(workouts.value, 'bike'), unit: 'km' as const },
    { label: 'Uinti', ...sportTotals(workouts.value, 'swim'), unit: 'm' as const },
  ].filter((row) => row.count > 0),
)

// -------------------------------------------------------------- salikehitys

const strengthVars = computed(() => sportVars(colors.swatchForGroup('strength'), isDark.value))
const kg = (value: number) => value.toLocaleString('fi-FI', { maximumFractionDigits: 2 })
const lifts = computed(() =>
  liftProgress(workouts.value, (id) => exercises.byId.get(id)).map((lift) => {
    const first = lift.weights[0]
    const last = lift.weights[lift.weights.length - 1]
    return { ...lift, name: exercises.byId.get(lift.exerciseId)?.name ?? lift.exerciseId, first, last, change: last - first }
  }),
)
</script>

<template>
  <div class="flex min-h-full flex-col px-5 pt-6 pb-6">
    <h1 class="font-display text-[32px] leading-[1.04] font-bold tracking-[-0.02em]">Tilastot</h1>

    <!-- Aikaväli: kaikki alla oleva lasketaan tälle jaksolle. -->
    <div role="group" aria-label="Aikaväli" class="mt-3.5 grid grid-cols-3 gap-1 rounded-full bg-track p-1">
      <button
        v-for="option in VIEWS"
        :key="option.value"
        type="button"
        :aria-pressed="period.view === option.value"
        :class="period.view === option.value ? 'bg-surface text-ink' : 'bg-transparent text-ink-muted'"
        class="min-h-9 rounded-full text-sm font-semibold"
        @click="choose(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div class="mt-2.5 flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="Edellinen jakso"
        :disabled="!canGoBack"
        class="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface disabled:opacity-35"
        @click="period = shiftPeriod(period, -1)"
      >
        <svg class="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15,6 9,12 15,18" />
        </svg>
      </button>
      <p class="text-center text-[17px] font-semibold" aria-live="polite" data-numeric>{{ periodLabel(period) }}</p>
      <button
        type="button"
        aria-label="Seuraava jakso"
        :disabled="!canGoForward"
        class="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface disabled:opacity-35"
        @click="period = shiftPeriod(period, 1)"
      >
        <svg class="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9,6 15,12 9,18" />
        </svg>
      </button>
    </div>

    <!-- Yhteenveto -->
    <section aria-label="Yhteenveto" class="mt-2.5 rounded-(--radius-feature) bg-surface p-4">
      <div class="flex items-end justify-between gap-3">
        <p class="flex items-end gap-2">
          <span class="font-display text-[52px] leading-[0.95] font-bold tracking-[-0.035em]">{{ workouts.length }}</span>
          <span class="pb-1.5 text-[15px] text-ink-muted">{{ workouts.length === 1 ? 'treeni' : 'treeniä' }}</span>
        </p>
        <div class="grid gap-1.5 text-right" data-numeric>
          <p>
            <span class="block text-[17px] font-bold">{{ formatDurationShort(seconds) }}</span>
            <span class="text-[11px] text-ink-muted">yhteensä</span>
          </p>
          <p v-if="footKm > 0">
            <span class="block text-[17px] font-bold">{{ kmFormat(footKm) }} km</span>
            <span class="text-[11px] text-ink-muted">jalan</span>
          </p>
        </div>
      </div>
      <p v-if="delta" class="mt-2 text-[13px] text-ink-muted" data-numeric>{{ delta }}</p>
    </section>

    <!-- Säännöllisyys: vuosi ruudukkona, kuukausi ja viikko kalenterina. -->
    <section class="mt-5.5" aria-labelledby="saannollisyys">
      <h2 id="saannollisyys" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Säännöllisyys</h2>
      <div class="mt-2.5 rounded-(--radius-feature) bg-surface p-4">
        <p class="mb-2.5 text-[13px] text-ink-muted" data-numeric>
          <span class="font-semibold text-ink">{{ byDay.size }} {{ byDay.size === 1 ? 'treenipäivä' : 'treenipäivää' }}</span>
          · {{ streakText }}
        </p>
        <YearGrid
          v-if="period.view === 'year'"
          :year="Number(period.start.slice(0, 4))"
          :by-day="byDay"
          :today="today"
        />
        <PeriodCalendar v-else :period="period" :by-day="byDay" :today="today" @select="selectedDay = $event" />
        <p class="mt-2.5 flex items-center justify-end gap-1 text-[11px] text-ink-muted">
          Treeniaika päivässä: vähän
          <span class="size-2.5 rounded-[2px] bg-track" aria-hidden="true" />
          <span v-for="level in 4" :key="level" :style="{ background: `var(--c-heat-${level})` }" class="size-2.5 rounded-[2px]" aria-hidden="true" />
          paljon
        </p>
        <ChartNumbers v-if="regularity.length">
          <table class="w-full text-left text-sm" data-numeric>
            <caption class="sr-only">Treenit {{ period.view === 'year' ? 'kuukausittain' : 'päivittäin' }}</caption>
            <thead class="text-xs text-ink-muted">
              <tr>
                <th scope="col" class="py-1.5 font-semibold">{{ period.view === 'year' ? 'Kuukausi' : 'Päivä' }}</th>
                <th scope="col" class="py-1.5 text-right font-semibold">Treenit</th>
                <th v-if="period.view === 'year'" scope="col" class="py-1.5 text-right font-semibold">Päivät</th>
                <th scope="col" class="py-1.5 text-right font-semibold">Aika</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in regularity" :key="row.key" class="border-t border-line">
                <th scope="row" class="py-1.5 font-normal">{{ row.label }}</th>
                <td class="py-1.5 text-right">{{ row.workouts }}</td>
                <td v-if="period.view === 'year'" class="py-1.5 text-right">{{ row.days }}</td>
                <td class="py-1.5 text-right">{{ formatDurationShort(row.seconds) }}</td>
              </tr>
            </tbody>
          </table>
        </ChartNumbers>
      </div>
    </section>

    <!-- Lajien tasapaino: sama väri kuin päiväkirjassa, joten ryhmän tunnistaa. -->
    <section class="mt-5.5" aria-labelledby="tasapaino">
      <h2 id="tasapaino" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Lajien tasapaino</h2>
      <div class="mt-2.5 rounded-(--radius-feature) bg-surface p-4">
        <template v-if="balance.length">
          <div class="flex h-2.5 gap-[2px]" aria-hidden="true">
            <span
              v-for="row in balance"
              :key="row.group"
              :style="{ ...row.vars, flexGrow: row.seconds }"
              class="rounded-full bg-[var(--sport-surface)]"
            />
          </div>
          <ul class="mt-3 grid gap-2 text-sm">
            <li v-for="row in balance" :key="row.group" class="flex items-center gap-2">
              <span :style="row.vars" class="size-2.5 flex-none rounded-[3px] bg-[var(--sport-surface)]" aria-hidden="true" />
              {{ row.label }}
              <span class="ml-auto text-ink-muted" data-numeric>{{ formatDurationShort(row.seconds) }} · {{ row.share }} %</span>
            </li>
          </ul>
        </template>
        <p v-else class="text-[13px] text-ink-muted">Ei treenejä tällä jaksolla.</p>
      </div>
    </section>

    <!-- Kestävyys: kilometrit jalan, muut matkalajit riveinä omissa yksiköissään. -->
    <section class="mt-5.5" aria-labelledby="kestavyys">
      <h2 id="kestavyys" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Kestävyys</h2>
      <div class="mt-2.5 rounded-(--radius-feature) bg-surface p-4">
        <p class="mb-2 text-[13px] text-ink-muted">
          Kilometrit jalan
          {{ period.view === 'year' ? 'kuukausittain' : period.view === 'month' ? 'viikoittain' : 'päivittäin' }}
        </p>
        <FootChart v-if="hasFoot" :buckets="buckets" :style="landVars" />
        <ChartNumbers v-if="hasFoot">
          <table class="w-full text-left text-sm" data-numeric>
            <caption class="sr-only">Kilometrit jalan</caption>
            <thead class="text-xs text-ink-muted">
              <tr>
                <th scope="col" class="py-1.5 font-semibold">
                  {{ period.view === 'year' ? 'Kuukausi' : period.view === 'month' ? 'Viikko' : 'Päivä' }}
                </th>
                <th scope="col" class="py-1.5 text-right font-semibold">Kilometrit</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bucket in buckets.filter((b) => !b.future)" :key="bucket.title" class="border-t border-line">
                <th scope="row" class="py-1.5 font-normal">{{ bucket.title }}</th>
                <td class="py-1.5 text-right">{{ kmFormat(bucket.meters / 1000) }} km</td>
              </tr>
            </tbody>
          </table>
        </ChartNumbers>
        <p v-else class="text-[13px] text-ink-muted">Ei kävelyä, juoksua eikä vaellusta tällä jaksolla.</p>
        <ul v-if="otherDistance.length" class="mt-1.5 grid text-sm">
          <li v-for="row in otherDistance" :key="row.label" class="flex justify-between gap-2 border-t border-line py-2">
            {{ row.label }}
            <span class="text-ink-muted" data-numeric>
              {{ row.count }} {{ row.count === 1 ? 'kerta' : 'kertaa' }} ·
              {{ row.unit === 'km' ? `${kmFormat(row.meters / 1000)} km` : `${row.meters.toLocaleString('fi-FI')} m` }}
            </span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Salikehitys: jokaisen kerran raskain sarja. -->
    <section class="mt-5.5" aria-labelledby="salikehitys">
      <h2 id="salikehitys" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Salikehitys</h2>
      <div :style="strengthVars" class="mt-2.5 rounded-(--radius-feature) bg-surface px-4 py-1.5">
        <ul v-if="lifts.length">
          <li
            v-for="lift in lifts"
            :key="lift.exerciseId"
            class="grid grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-3 border-t border-line py-2.5 first:border-t-0"
          >
            <p class="truncate text-[15px] font-semibold">{{ lift.name }}</p>
            <Sparkline :values="lift.weights" :label="`${lift.name}: ${kg(lift.first)} kg → ${kg(lift.last)} kg`" />
            <p class="text-right" data-numeric>
              <span class="block text-[15px] font-bold">{{ kg(lift.last) }} kg</span>
              <span class="text-xs text-ink-muted">{{ lift.change >= 0 ? '+' : '−' }}{{ kg(Math.abs(lift.change)) }} kg</span>
            </p>
          </li>
        </ul>
        <p v-else class="py-2.5 text-[13px] text-ink-muted">
          Kehitys näkyy, kun olet tehnyt saman liikkeen painoilla vähintään kahdesti tällä jaksolla.
        </p>
      </div>
    </section>

    <DaySheet
      :date="selectedWorkoutId ? null : selectedDay"
      @close="selectedDay = null"
      @open="selectedWorkoutId = $event"
    />
    <WorkoutSheet :workout="selectedWorkout" @close="selectedWorkoutId = null" @remove="removeWorkout" />
  </div>
</template>
