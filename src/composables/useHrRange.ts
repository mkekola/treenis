import { ref, watch } from 'vue'
import { DEFAULT_HR_RANGE, type HrRange } from '@/lib/endurance'

const STORAGE_KEY = 'treenis.hrRange'

function load(): HrRange {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_HR_RANGE }
    const saved = JSON.parse(raw) as Partial<HrRange>
    return typeof saved.min === 'number' && typeof saved.max === 'number' ? { min: saved.min, max: saved.max } : { ...DEFAULT_HR_RANGE }
  } catch {
    // Safari voi estää tai tyhjentää tallennustilan. Oletus riittää.
    return { ...DEFAULT_HR_RANGE }
  }
}

/** Peruskestävyyden sykehaarukka. Oma jokaisella käyttäjällä, joten se muistetaan laitteella. */
export function useHrRange() {
  const range = ref<HrRange>(load())
  watch(
    range,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Tallennus saa epäonnistua hiljaa: haarukka palaa oletukseen seuraavalla kerralla.
      }
    },
    { deep: true },
  )
  return range
}
