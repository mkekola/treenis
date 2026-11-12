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

  /** Ryhmät, joilla swatch on käytössä. Saman värin saa antaa useammalle ryhmälle. */
  const usersOf = computed(() => (swatchId: string): SportGroupKey[] =>
    (Object.entries(assignments.value) as [SportGroupKey, string][])
      .filter(([, id]) => id === swatchId)
      .map(([group]) => group),
  )

  /**
   * Värin voi valita vapaasti, myös toisen ryhmän värin: jos tilastoissa kaksi
   * ryhmää näyttää samalta, se on käyttäjän oma valinta. Ruusu on varattu
   * ennätyksille, jotta ennätys erottuu aina.
   */
  function assign(group: SportGroupKey, swatchId: string) {
    if (swatchId === RECORD_SWATCH_ID) return
    assignments.value = { ...assignments.value, [group]: swatchId }
  }

  function reset() {
    assignments.value = { ...DEFAULT_GROUP_SWATCHES }
  }

  return { assignments, swatchFor, swatchForGroup, usersOf, assign, reset }
})

/** Tummentaa värin sekoittamalla mustaa: amount 0 = ennallaan, 1 = musta. */
function darken(hex: string, amount: number): string {
  const channel = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount))
  return `#${[1, 3, 5].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Ryhmän värit CSS-muuttujina. Komponentti ei tiedä mikä väri on kyseessä eikä
 * kumpi teema on päällä — se lukee vain --sport-surface ja --sport-on.
 *
 * Lajin värisen kortin sisällä olevat pinnat (--sport-raised, --sport-sunken)
 * tulevat myös lajin väristä. Tummassa teemassa sovelluksen yleiset pinnat
 * taittuvat luumuun, ja ne näyttäisivät vierailta esimerkiksi vihreän kortin
 * sisällä. Vaaleassa teemassa valkoinen ja pohjaväri sopivat kaikkiin väreihin.
 */
export function sportVars(swatch: Swatch, dark: boolean) {
  const pair = dark ? swatch.dark : swatch.light
  return {
    '--sport-surface': pair.surface,
    '--sport-on': pair.on,
    '--sport-raised': dark ? darken(pair.surface, 0.35) : 'var(--c-surface)',
    '--sport-sunken': dark ? darken(pair.surface, 0.6) : 'var(--c-bg)',
  }
}

/** Ennätysten väri. Kiinteä eikä lajin valittavissa, jotta ennätys erottuu aina. */
export function recordVars(dark: boolean) {
  const pair = dark ? SWATCHES_BY_ID[RECORD_SWATCH_ID].dark : SWATCHES_BY_ID[RECORD_SWATCH_ID].light
  return { '--record-surface': pair.surface, '--record-on': pair.on }
}
