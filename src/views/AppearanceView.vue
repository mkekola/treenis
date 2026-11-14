<script setup lang="ts">
import { computed, ref } from 'vue'
import AccountSection from '@/components/AccountSection.vue'
import ShareSettingsSection from '@/components/ShareSettingsSection.vue'
import StravaSection from '@/components/StravaSection.vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { RECORD_SWATCH_ID, SWATCHES } from '@/design/swatches'
import { SPORT_GROUP_LABELS, sportsInGroup, type SportGroupKey } from '@/design/sportGroups'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { ICON_CREATOR, ICON_CREDITS } from '@/design/iconCredits'
import { SPORT_LABELS } from '@/types/workout'

const colors = useSportColors()
const { mode, isDark } = useTheme()

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Järjestelmä' },
  { value: 'light', label: 'Vaalea' },
  { value: 'dark', label: 'Tumma' },
]

const openGroup = ref<SportGroupKey | null>('strength')

const groups = computed(() =>
  (Object.keys(SPORT_GROUP_LABELS) as SportGroupKey[]).map((group) => ({
    group,
    label: SPORT_GROUP_LABELS[group],
    swatch: colors.swatchForGroup(group),
    vars: sportVars(colors.swatchForGroup(group), isDark.value),
    sports: sportsInGroup(group),
  })),
)

function toggle(group: SportGroupKey) {
  openGroup.value = openGroup.value === group ? null : group
}

function swatchState(swatchId: string, group: SportGroupKey) {
  if (swatchId === RECORD_SWATCH_ID) return 'reserved' as const
  const users = colors.usersOf(swatchId)
  if (users.includes(group)) return 'selected' as const
  if (users.length) return 'shared' as const
  return 'free' as const
}

/** Muut ryhmät, joilla sama väri on käytössä, ruudunlukijaa varten. */
function sharedWith(swatchId: string, group: SportGroupKey) {
  return colors
    .usersOf(swatchId)
    .filter((g) => g !== group)
    .map((g) => SPORT_GROUP_LABELS[g])
    .join(', ')
}

function pairFor(swatchId: string) {
  const swatch = SWATCHES.find((s) => s.id === swatchId)!
  return isDark.value ? swatch.dark : swatch.light
}

function swatchLabel(swatchId: string, name: string, group: SportGroupKey) {
  const state = swatchState(swatchId, group)
  if (state === 'shared') return `${name}, käytössä myös: ${sharedWith(swatchId, group)}`
  if (state === 'reserved') return `${name}, varattu ennätyksille`
  return name
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <RouterLink
      to="/"
      aria-label="Takaisin päiväkirjaan"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <h1 class="-mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Asetukset</h1>

    <!-- Teema -->
    <section class="rounded-(--radius-feature) bg-surface p-3.5">
      <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Teema</h2>
      <div
        role="group"
        aria-label="Teema"
        class="mt-2.5 grid grid-cols-3 gap-1 rounded-full bg-track p-1"
      >
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="min-h-9 rounded-full text-sm font-semibold"
          :class="
            mode === option.value ? 'bg-surface text-ink' : 'bg-transparent text-ink-muted'
          "
          :aria-pressed="mode === option.value"
          @click="mode = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <p class="mt-2 text-xs text-ink-muted">
        Järjestelmä seuraa puhelimen asetusta ja vaihtuu sen mukana. Lajivärit vaihtavat paria
        automaattisesti teeman mukana.
      </p>
    </section>

    <!-- Lajiryhmien värit -->
    <h2 class="mt-1 text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
      Lajiryhmien värit
    </h2>
    <p class="-mt-1 text-[13px] text-ink-muted">
      Väri kertoo lajiryhmän, ikoni kertoo lajin. Jokainen väri sisältää valmiin tekstivärin
      molempiin teemoihin, joten luettavuus pysyy kunnossa valitsit minkä tahansa.
    </p>

    <section
      v-for="row in groups"
      :key="row.group"
      class="rounded-(--radius-feature) bg-surface p-3.5"
    >
      <button
        type="button"
        class="flex w-full items-center gap-3 text-left"
        :aria-expanded="openGroup === row.group"
        @click="toggle(row.group)"
      >
        <span
          :style="row.vars"
          aria-hidden="true"
          class="flex size-13 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]"
        >
          <SportIcon :sport="row.sports[0]" :size="30" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-base font-semibold">{{ row.label }}</span>
          <span class="block truncate text-xs text-ink-muted">
            {{ row.sports.map((s) => SPORT_LABELS[s]).join(', ') }}
          </span>
        </span>
        <span class="flex-none text-xs text-ink-muted">{{ row.swatch.name }}</span>
      </button>

      <div
        v-if="openGroup === row.group"
        role="group"
        :aria-label="`Valitse väri ryhmälle ${row.label}`"
        class="mt-3.5 grid grid-cols-6 gap-2"
      >
        <button
          v-for="swatch in SWATCHES"
          :key="swatch.id"
          type="button"
          class="flex aspect-square items-center justify-center rounded-xl"
          :style="{
            background: pairFor(swatch.id).surface,
            color: pairFor(swatch.id).on,
            outline:
              swatchState(swatch.id, row.group) === 'selected'
                ? '2px solid var(--color-ink)'
                : 'none',
            outlineOffset: '1px',
          }"
          :aria-pressed="swatchState(swatch.id, row.group) === 'selected'"
          :aria-disabled="swatchState(swatch.id, row.group) === 'reserved'"
          :aria-label="swatchLabel(swatch.id, swatch.name, row.group)"
          @click="colors.assign(row.group, swatch.id)"
        >
          <svg
            v-if="swatchState(swatch.id, row.group) === 'selected'"
            class="size-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="5,13 10,18 19,7" />
          </svg>
          <!-- Toisen ryhmän käyttämä väri: pieni piste kertoo sen, mutta värin voi silti valita. -->
          <span
            v-else-if="swatchState(swatch.id, row.group) === 'shared'"
            class="size-2 rounded-full bg-current opacity-60"
            aria-hidden="true"
          />
          <svg
            v-else-if="swatchState(swatch.id, row.group) === 'reserved'"
            class="size-4 opacity-60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </button>
      </div>
    </section>

    <p class="text-xs text-ink-muted">
      Ennätysten väri on ruusu, eikä sitä voi antaa lajiryhmälle. Se pysyy samana, jotta ennätys
      erottuu aina.
    </p>

    <StravaSection class="mt-1" />

    <ShareSettingsSection />

    <AccountSection />

    <RouterLink to="/tietosuoja" class="inline-flex min-h-11 items-center self-start text-sm text-ink-muted underline">Tietosuoja</RouterLink>

    <!-- Noun Projectin ilmainen lisenssi vaatii tekijämaininnan. -->
    <section class="mb-6 rounded-(--radius-feature) bg-surface p-3.5">
      <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Ikonit</h2>
      <p class="mt-2 text-[13px]">
        Lajien ikonit ovat {{ ICON_CREATOR }}'n piirtämiä, Noun Projectista.
      </p>
      <ul class="mt-2 flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-ink-muted">
        <li v-for="(credit, index) in ICON_CREDITS" :key="credit.sport">
          <a :href="credit.url" target="_blank" rel="noopener" class="underline">{{
            credit.iconName
          }}</a
          ><span v-if="index < ICON_CREDITS.length - 1">,</span>
        </li>
      </ul>
      <p class="mt-2 text-xs text-ink-muted">by {{ ICON_CREATOR }} from Noun Project</p>
    </section>
  </div>
</template>
