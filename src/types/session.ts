import type { BlockExercise, Feel, Measurement } from '@/types/workout'

export interface SessionTarget {
  sets: number
  reps: number
}

/** Mitä liikkeestä tehtiin viimeksi, näytetään sarjarivin alla. */
export interface PreviousResult {
  weightKg: number
  feel?: Feel
}

/**
 * Painoehdotus, joka on jo viety riville valmiiksi täytettynä painona.
 * Merkintä ("+2 kg") näytetään vain niin kauan kuin rivin paino on edelleen
 * ehdotettu paino: kun käyttäjä muuttaa sen, ehdotus on käsitelty.
 */
export interface WeightHint {
  kind: 'increase' | 'decrease'
  fromKg: number
  toKg: number
}

export interface SessionExercise extends BlockExercise {
  /** Liikkeen mittaustapa kopioituna, jotta näkymä ei tarvitse kirjastohakua. */
  measurement: Measurement
  target: SessionTarget
  previous?: PreviousResult
  hint?: WeightHint
  /** Käyttäjä ohitti tuntumakysymyksen, joten sitä ei kysytä uudelleen. */
  feelSkipped?: boolean
}

export interface SessionBlock {
  id: string
  restSec: number
  exercises: SessionExercise[]
}

/** Käynnissä oleva salitreeni. Tallennetaan jokaisen muutoksen jälkeen. */
export interface ActiveSession {
  /** Sama tunniste jolla valmis treeni tallennetaan. */
  id: string
  title: string
  templateId?: string
  startedAt: string
  updatedAt: string
  blocks: SessionBlock[]
  currentBlock: number
  /** Muistiinpano, kirjoitetaan yhteenvedossa. */
  notes?: string
  /** Levon päättymishetki. Aikaleima eikä laskuri, jotta lepo jatkuu sivun uudelleenlatauksen yli. */
  restEndsAt?: string
}

export interface SetRef {
  block: number
  exercise: number
  set: number
}
