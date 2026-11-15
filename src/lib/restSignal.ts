import { beep } from '@/lib/beep'

/**
 * Levon loppumerkki on laitekohtainen valinta: mikä toimii, riippuu puhelimesta ja siitä,
 * soiko taustalla musiikki. iPhone ei salli selainsovelluksen väristä, joten värinä on
 * tarjolla vain, jos laite tukee sitä.
 */
export type RestSignal = 'sound' | 'vibrate' | 'none'

const STORAGE_KEY = 'treenis.restSignal'
const VIBRATION_MS = [200, 120, 200]

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator

export function loadRestSignal(): RestSignal {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'sound' || saved === 'none' || (saved === 'vibrate' && canVibrate())) return saved
  } catch {
    // Tallennustila voi olla estetty. Oletus riittää.
  }
  return 'sound'
}

export function saveRestSignal(signal: RestSignal) {
  try {
    localStorage.setItem(STORAGE_KEY, signal)
  } catch {
    // Valinta palaa oletukseen seuraavalla kerralla.
  }
}

/** Levon päättyessä: valittu merkki. */
export function signalRestEnd() {
  const signal = loadRestSignal()
  if (signal === 'sound') void beep()
  else if (signal === 'vibrate') navigator.vibrate(VIBRATION_MS)
}
