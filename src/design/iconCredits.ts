import type { SportKey } from '@/types/workout'

/**
 * Noun Projectin ilmainen lisenssi vaatii tekijämaininnan. Krediitit pidetään
 * täällä ja näytetään asetuksissa automaattisesti, jottei merkintä unohdu tai
 * vanhene kun ikoni vaihtuu.
 *
 * Merkintämuoto on Noun Projectin ohjeen mukainen:
 * "<ikonin nimi>" by <tekijä> from Noun Project.
 */
export interface IconCredit {
  sport: SportKey
  /** Ikonin nimi Noun Projectissa, täsmälleen kuten sivulla. */
  iconName: string
  creator: string
  url: string
}

export const ICON_CREATOR = 'Adrien Coquet'

export const ICON_CREDITS: IconCredit[] = [
  { sport: 'strength', iconName: 'Gym', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/gym-4306447/' },
  { sport: 'run', iconName: 'run', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/run-1294198/' },
  { sport: 'swim', iconName: 'Swimming', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/swimming-3194817/' },
  { sport: 'bike', iconName: 'Bike', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/bike-3202509/' },
  { sport: 'climb', iconName: 'climb', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/climb-2195072/' },
  { sport: 'windsurf', iconName: 'sail', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/sail-4592630/' },
  { sport: 'kitesurf', iconName: 'watersport', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/watersport-4847150/' },
  { sport: 'yoga', iconName: 'yoga', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/yoga-2334496/' },
  { sport: 'pilates', iconName: 'Pilates', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/pilates-4310910/' },
  { sport: 'alpine', iconName: 'freestyle', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/freestyle-4516834/' },
  { sport: 'nordic', iconName: 'Ski', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/ski-4516841/' },
  { sport: 'skating', iconName: 'Ice Skating', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/ice-skating-8320557/' },
  { sport: 'hike', iconName: 'Trail', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/trail-4236407/' },
  { sport: 'walk', iconName: 'Walk', creator: ICON_CREATOR, url: 'https://thenounproject.com/icon/walk-1826969/' },
]
