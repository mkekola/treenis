import { formatToday } from '@/lib/calendar'
import { formatDistance, formatDurationShort } from '@/lib/format'
import { localDate } from '@/lib/session'
import { SPORT_LABELS, type SportKey } from '@/types/workout'

/** Reaktiot tässä järjestyksessä valikossa. Avain tallennetaan, emoji ja nimi ovat sovelluksessa. */
export const REACTIONS = [
  { key: 'party', emoji: '🎉', label: 'Juhlaa' },
  { key: 'clap', emoji: '👏', label: 'Taputus' },
  { key: 'heart', emoji: '❤️', label: 'Sydän' },
  { key: 'hundred', emoji: '💯', label: 'Täydet pisteet' },
  { key: 'trophy', emoji: '🏆', label: 'Voittaja' },
  { key: 'fire', emoji: '🔥', label: 'Tulessa' },
  { key: 'hot', emoji: '🥵', label: 'Rankka treeni' },
] as const

export type ReactionKey = (typeof REACTIONS)[number]['key']

/** Syötteen rivi sellaisena kuin friend_feed-funktio sen palauttaa. */
export interface FeedRow {
  workout_id: string
  user_id: string
  name: string
  is_me: boolean
  sport: SportKey
  date: string
  started_at: string | null
  /** Pelkkä Strava-treeni, joka näkyy kavereille käyttäjän luvalla. */
  from_strava: boolean
  duration_sec: number | null
  distance_m: number | null
  /** null, jos kaveri ei jaa liikkeitä. bestKg on null myös, jos kaveri ei jaa painoja. */
  exercises: { exerciseId: string; name: string | null; sets: number; bestKg: number | null }[] | null
  /** null, jos kaveri ei jaa ennätyksiä. weightKg on null, jos kaveri ei jaa painoja. */
  records: { exerciseId: string; name: string | null; weightKg: number | null }[] | null
  /** name on null, jos reagoija ei ole sinä eikä kaverisi. */
  reactions: { reaction: ReactionKey; userId: string; name: string | null }[]
}

export interface ReactionSummary {
  key: ReactionKey
  emoji: string
  label: string
  count: number
  mine: boolean
  /** Tutut reagoijat nimeltä, muut lukumääränä. */
  names: string[]
  others: number
}

/** Kortissa näytettävät reaktiot: vain annetut, valikon järjestyksessä. */
export function summarizeReactions(reactions: FeedRow['reactions'], me: string): ReactionSummary[] {
  return REACTIONS.map(({ key, emoji, label }) => {
    const given = reactions.filter((r) => r.reaction === key)
    return {
      key,
      emoji,
      label,
      count: given.length,
      mine: given.some((r) => r.userId === me),
      names: given
        .filter((r) => r.userId === me || r.name)
        .map((r) => (r.userId === me ? 'Sinä' : (r.name as string))),
      others: given.filter((r) => r.userId !== me && !r.name).length,
    }
  }).filter((summary) => summary.count > 0)
}

/** Oma reaktio treeniin, jos on. */
export function myReaction(reactions: FeedRow['reactions'], me: string): ReactionKey | null {
  return reactions.find((r) => r.userId === me)?.reaction ?? null
}

/** Napautus: uusi reaktio korvaa vanhan, saman uudelleen napauttaminen poistaa sen. */
export function nextReaction(current: ReactionKey | null, tapped: ReactionKey): ReactionKey | null {
  return current === tapped ? null : tapped
}

/** Reagoijat: "Anna, Mikko ja 1 muu". */
export function reactionNames(summary: ReactionSummary): string {
  const people = [...summary.names]
  if (summary.others) people.push(summary.others === 1 ? '1 muu' : `${summary.others} muuta`)
  return people.length > 1 ? `${people.slice(0, -1).join(', ')} ja ${people.at(-1)}` : (people[0] ?? '')
}

/** Ruudunlukijalle: "Tulessa: Anna, Mikko ja 1 muu". */
export function reactionLabel(summary: ReactionSummary): string {
  return `${summary.label}: ${reactionNames(summary)}`
}

export interface FeedDay {
  date: string
  /** "Tänään", "Eilen" tai "Perjantai 13.11." */
  label: string
  rows: FeedRow[]
}

/** Syöte päivittäin. Rivit tulevat palvelimelta jo uusin ensin, joten järjestys säilyy. */
export function groupByDay(rows: FeedRow[], now: Date): FeedDay[] {
  const today = localDate(now)
  const yesterday = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const label = (date: string) =>
    date === today ? 'Tänään' : date === yesterday ? 'Eilen' : formatToday(new Date(`${date}T00:00:00`))

  const days: FeedDay[] = []
  for (const row of rows) {
    const last = days.at(-1)
    if (last?.date === row.date) last.rows.push(row)
    else days.push({ date: row.date, label: label(row.date), rows: [row] })
  }
  return days
}

/**
 * Rivin tekstit: kuka ("Beni"), mitä ("Juoksu") ja tiedot ("35 min · 5,00 km"). Treenin omaa
 * nimeä ("Treeni 1") ei näytetä: syötteessä riittää laji (Marian päätös).
 */
export function feedLines(row: FeedRow): { who: string; what: string; detail: string } {
  const who = row.is_me ? 'Sinä' : row.name || 'Nimetön'
  const detail = [
    row.duration_sec ? formatDurationShort(row.duration_sec) : null,
    row.distance_m ? formatDistance(row.sport, row.distance_m) : null,
    row.from_strava ? 'Strava' : null,
  ]
  return { who, what: SPORT_LABELS[row.sport], detail: detail.filter(Boolean).join(' · ') }
}
