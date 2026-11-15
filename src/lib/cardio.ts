import {
  CARDIO_ZONE_LABELS,
  SPORT_KIND,
  type CardioAmount,
  type CardioSegment,
  type SportKey,
  type WorkoutTemplate,
} from '@/types/workout'

/**
 * Kestävyyspohjat: juoksu, kävely, pyöräily ja muut matkalajit osioina.
 * Kuten salipohjassa, jokainen muutos palauttaa uuden pohjan vanhaa muuttamatta.
 */

/** Lajit, joille kestävyyspohjan voi tehdä: ne, joissa mitataan matkaa. Yleisimmät ensin. */
const CARDIO_ORDER: SportKey[] = ['run', 'walk', 'bike', 'swim', 'nordic', 'hike', 'skating']
export const CARDIO_SPORTS = CARDIO_ORDER.filter((sport) => SPORT_KIND[sport] === 'distance')

/** Kapea sitova välilyönti: luku ja yksikkö eivät rivity erilleen. */
const NBSP_THIN = ' '

export function isCardio(template: WorkoutTemplate): boolean {
  return template.sport !== undefined && template.sport !== 'strength'
}

export function newSegment(id: string): CardioSegment {
  return { id, name: '', reps: 1, work: { value: 30, unit: 'min' } }
}

export function newCardioTemplate(id: string, name: string, sport: SportKey, segmentId: string): WorkoutTemplate {
  return { id, name, blocks: [], sport, segments: [newSegment(segmentId)] }
}

const segmentsOf = (template: WorkoutTemplate) => template.segments ?? []

export function addSegment(template: WorkoutTemplate, segmentId: string): WorkoutTemplate {
  return { ...template, segments: [...segmentsOf(template), newSegment(segmentId)] }
}

/**
 * Osion muutos. Toistojen laskiessa yhteen palautus jää talteen mutta ei näy eikä
 * vaikuta, joten se palaa, jos toistoja lisätään taas.
 */
export function updateSegment(template: WorkoutTemplate, index: number, change: Partial<CardioSegment>): WorkoutTemplate {
  return { ...template, segments: segmentsOf(template).map((s, i) => (i === index ? { ...s, ...change } : s)) }
}

export function removeSegment(template: WorkoutTemplate, index: number): WorkoutTemplate {
  return { ...template, segments: segmentsOf(template).filter((_, i) => i !== index) }
}

export function canMoveSegment(template: WorkoutTemplate, index: number, direction: -1 | 1): boolean {
  const target = index + direction
  return target >= 0 && target < segmentsOf(template).length
}

export function moveSegment(template: WorkoutTemplate, index: number, direction: -1 | 1): WorkoutTemplate {
  if (!canMoveSegment(template, index, direction)) return template
  const segments = [...segmentsOf(template)]
  const [moved] = segments.splice(index, 1)
  segments.splice(index + direction, 0, moved)
  return { ...template, segments }
}

// ---------------------------------------------------------------- tekstit

const fi = (n: number) => n.toLocaleString('fi-FI', { maximumFractionDigits: 2 })

/** "15 min", "90 s", "400 m", "8,5 km". */
export function amountText(amount: CardioAmount): string {
  return `${fi(amount.value)}${NBSP_THIN}${amount.unit}`
}

/** Palautus merkitsee vain toistojen välissä. Nolla tarkoittaa, että yksikkö on valittu mutta arvoa ei vielä ole. */
const hasRecovery = (segment: CardioSegment) => segment.reps > 1 && (segment.recovery?.value ?? 0) > 0

/** "15 min" tai "6 × 400 m". */
export function workText(segment: CardioSegment): string {
  const work = amountText(segment.work)
  return segment.reps > 1 ? `${segment.reps} × ${work}` : work
}

/** "6 × 400 m · palautus 90 s". */
export function segmentText(segment: CardioSegment): string {
  return hasRecovery(segment) ? `${workText(segment)} · palautus ${amountText(segment.recovery!)}` : workText(segment)
}

/** "4.30" sekunneista kilometrille. */
export function paceText(secPerKm: number): string {
  const minutes = Math.floor(secPerKm / 60)
  return `${minutes}.${String(Math.round(secPerKm % 60)).padStart(2, '0')}`
}

/** "4.30", "4:30" tai "4,30" sekunneiksi kilometrille. Tyhjä tai virheellinen ei ole tavoite. */
export function parsePace(text: string): number | undefined {
  const match = /^(\d{1,2})[.:,](\d{2})$/.exec(text.trim())
  if (!match) return undefined
  const [minutes, seconds] = [Number(match[1]), Number(match[2])]
  return seconds < 60 && minutes + seconds > 0 ? minutes * 60 + seconds : undefined
}

/** Tavoitteet yhdellä rivillä: "MK · 4.30 /km · syke 130". Tyhjä, jos tavoitteita ei ole. */
export function goalText(segment: CardioSegment): string {
  return [
    segment.zone ? CARDIO_ZONE_LABELS[segment.zone] : null,
    segment.paceSecPerKm ? `${paceText(segment.paceSecPerKm)}${NBSP_THIN}/km` : null,
    segment.heartRate ? `syke ${segment.heartRate}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Ohjelman listalle: "15 min · 6 × 400 m · 10 min". */
export function planSummary(template: WorkoutTemplate): string {
  return segmentsOf(template).map(workText).join(' · ')
}

/** Suunnitelma kokonaisuutena: aikaosiot sekunteina ja matkaosiot metreinä erikseen. */
export function planTotals(template: WorkoutTemplate): { timeSec: number; distanceM: number } {
  const totals = { timeSec: 0, distanceM: 0 }
  const add = (amount: CardioAmount, times: number) => {
    if (amount.unit === 'min') totals.timeSec += amount.value * 60 * times
    else if (amount.unit === 's') totals.timeSec += amount.value * times
    else if (amount.unit === 'km') totals.distanceM += amount.value * 1000 * times
    else totals.distanceM += amount.value * times
  }
  for (const segment of segmentsOf(template)) {
    add(segment.work, segment.reps)
    if (hasRecovery(segment)) add(segment.recovery!, segment.reps - 1)
  }
  return totals
}

/** "Yhteensä 37 min", "Yhteensä 8 km" tai "Yhteensä 25 min + 2,4 km". */
export function totalsText(template: WorkoutTemplate): string {
  const { timeSec, distanceM } = planTotals(template)
  const parts = [
    timeSec ? `${fi(Math.round(timeSec / 60))}${NBSP_THIN}min` : null,
    distanceM ? (distanceM >= 1000 ? `${fi(Math.round(distanceM / 100) / 10)}${NBSP_THIN}km` : `${fi(distanceM)}${NBSP_THIN}m`) : null,
  ].filter(Boolean)
  return parts.length ? `Yhteensä ${parts.join(' + ')}` : ''
}
