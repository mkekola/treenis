import type { SportKey } from '@/types/workout'

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
  /** null pelkälle Strava-treenille: Stravassa kirjoitettua nimeä ei näytetä kavereille. */
  title: string | null
  date: string
  started_at: string | null
  /** Pelkkä Strava-treeni, joka näkyy kavereille käyttäjän luvalla. */
  from_strava: boolean
  duration_sec: number | null
  distance_m: number | null
  /** null, jos kaveri ei jaa liikkeitä. */
  exercises: { exerciseId: string; name: string | null; sets: number; bestKg: number | null }[] | null
  /** null, jos kaveri ei jaa ennätyksiä. */
  records: { exerciseId: string; name: string | null; weightKg: number }[] | null
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

/** Ruudunlukijalle ja vihjeeksi: "Tulessa: Anna, Mikko ja 1 muu". */
export function reactionLabel(summary: ReactionSummary): string {
  const people = [...summary.names]
  if (summary.others) people.push(summary.others === 1 ? '1 muu' : `${summary.others} muuta`)
  const list = people.length > 1 ? `${people.slice(0, -1).join(', ')} ja ${people.at(-1)}` : people[0]
  return `${summary.label}: ${list}`
}
