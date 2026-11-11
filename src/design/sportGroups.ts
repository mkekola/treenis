import type { SportKey } from '@/types/workout'

/**
 * Väri koodaa lajiryhmän, ei yksittäistä lajia.
 *
 * Kolmetoista lajia tarkoittaisi kolmeatoista lähes samanvaaleaa pastellia,
 * joita ei erota toisistaan. Ryhmä on se taso jolla väri pystyy tekemään
 * työtä: aikajanalta näkee yhdellä silmäyksellä paljonko on ollut vettä,
 * talvea tai voimaa. Yksittäisen lajin kertoo ikoni ja tekstilabel.
 */
export type SportGroupKey =
  | 'strength'
  | 'land'
  | 'cycling'
  | 'water'
  | 'winter'
  | 'climbing'
  | 'body'
  | 'other'

export const SPORT_GROUP_LABELS: Record<SportGroupKey, string> = {
  strength: 'Voima',
  land: 'Juoksu ja vaellus',
  cycling: 'Pyöräily',
  water: 'Vesilajit',
  winter: 'Talvilajit',
  climbing: 'Kiipeily',
  body: 'Kehonhallinta',
  other: 'Muu',
}

export const SPORT_GROUP_OF: Record<SportKey, SportGroupKey> = {
  strength: 'strength',
  run: 'land',
  hike: 'land',
  bike: 'cycling',
  swim: 'water',
  windsurf: 'water',
  kitesurf: 'water',
  nordic: 'winter',
  alpine: 'winter',
  skating: 'winter',
  climb: 'climbing',
  yoga: 'body',
  pilates: 'body',
  other: 'other',
}

/** Mitkä lajit kuuluvat ryhmään — asetusnäkymä kertoo tämän käyttäjälle. */
export function sportsInGroup(group: SportGroupKey): SportKey[] {
  return (Object.keys(SPORT_GROUP_OF) as SportKey[]).filter(
    (sport) => SPORT_GROUP_OF[sport] === group,
  )
}

export const DEFAULT_GROUP_SWATCHES: Record<SportGroupKey, string> = {
  strength: 'syreeni',
  land: 'salvia',
  cycling: 'persikka',
  water: 'pervinkki',
  winter: 'taivas',
  climbing: 'korall',
  body: 'minttu',
  other: 'savu',
}
