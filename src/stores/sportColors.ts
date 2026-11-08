import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RECORD_SWATCH_ID, SWATCHES_BY_ID, type Swatch } from '@/design/swatches'
import {
  DEFAULT_GROUP_SWATCHES,
  SPORT_GROUP_OF,
  type SportGroupKey,
} from '@/design/sportGroups'
import type { SportKey } from '@/types/workout'

const STORAGE_KEY = 'treenis.sportColors'

function load(): Record<SportGroupKey, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GROUP_SWATCHES }
    return { ...DEFAULT_GROUP_SWATCHES, ...JSON.parse(raw) }
  } catch {
    // Safari voi estää tai tyhjentää tallennustilan. Oletukset riittävät.
    return { ...DEFAULT_GROUP_SWATCHES }
  }
}

export const useSportColors = defineStore('sportColors', () => {
  const assignments = ref<Record<SportGroupKey, string>>(load())

  watch(
    assignments,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Sama kuin yllä: tallennus saa epäonnistua hiljaa.
      }
    },
    { deep: true },
  )

  function swatchForGroup(group: SportGroupKey): Swatch {
    return SWATCHES_BY_ID[assignments.value[group]] ?? SWATCHES_BY_ID[DEFAULT_GROUP_SWATCHES[group]]
  }

  function swatchFor(sport: SportKey): Swatch {
    return swatchForGroup(SPORT_GROUP_OF[sport])
  }

  /** Mihin ryhmään swatch on varattu, tai null jos vapaa. */
  const ownerOf = computed(() => (swatchId: string): SportGroupKey | null => {
    const entry = Object.entries(assignments.value).find(([, id]) => id === swatchId)
    return entry ? (entry[0] as SportGroupKey) : null
  })

  function assign(group: SportGroupKey, swatchId: string) {
    if (swatchId === RECORD_SWATCH_ID) return
    if (ownerOf.value(swatchId)) return
    assignments.value = { ...assignments.value, [group]: swatchId }
  }

  function reset() {
    assignments.value = { ...DEFAULT_GROUP_SWATCHES }
  }

  return { assignments, swatchFor, swatchForGroup, ownerOf, assign, reset }
})

/**
 * Ryhmän värit CSS-muuttujina. Komponentti ei tiedä mikä väri on kyseessä eikä
 * kumpi teema on päällä — se lukee vain --sport-surface ja --sport-on.
 */
export function sportVars(swatch: Swatch, dark: boolean) {
  const pair = dark ? swatch.dark : swatch.light
  return {
    '--sport-surface': pair.surface,
    '--sport-on': pair.on,
  }
}
