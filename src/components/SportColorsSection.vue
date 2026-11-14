<script setup lang="ts">
import { computed, ref } from 'vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { RECORD_SWATCH_ID, SWATCHES } from '@/design/swatches'
import { SPORT_GROUP_LABELS, sportsInGroup, type SportGroupKey } from '@/design/sportGroups'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { SPORT_LABELS } from '@/types/workout'

const colors = useSportColors()
const { isDark } = useTheme()

const openGroup = ref<SportGroupKey | null>(null)

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
  <div class="flex flex-col gap-4">
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
  </div>
</template>
