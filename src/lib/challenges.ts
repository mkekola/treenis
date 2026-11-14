import { localDate } from '@/lib/session'

export type ChallengeMetric = 'strength' | 'workouts' | 'weeks'

export const METRICS: { key: ChallengeMetric; label: string; hint: string; title: string }[] = [
  { key: 'strength', label: 'Salitreenit', hint: 'Montako salitreeniä tehdään', title: 'Salihaaste' },
  { key: 'workouts', label: 'Kaikki treenit', hint: 'Kaikki lajit, joita kaverit näkevät', title: 'Treenihaaste' },
  { key: 'weeks', label: 'Viikkoputki', hint: 'Viikot, joilla vähintään 2 treeniä', title: 'Viikkoputkihaaste' },
]

export interface ChallengeMember {
  userId: string
  name: string
  status: 'invited' | 'accepted'
  /** null ennen alkua ja kutsutuilla, jotka eivät ole vielä hyväksyneet. */
  score: number | null
}

/** Rivi sellaisena kuin my_challenges-funktio sen palauttaa. */
export interface ChallengeRow {
  id: string
  metric: ChallengeMetric
  starts_on: string
  ends_on: string
  creator: string
  my_status: 'invited' | 'accepted'
  previous_score: number | null
  members: ChallengeMember[]
}

export type ChallengeState = 'upcoming' | 'active' | 'finished'

export function challengeState(row: Pick<ChallengeRow, 'starts_on' | 'ends_on'>, today: string): ChallengeState {
  if (today < row.starts_on) return 'upcoming'
  if (today > row.ends_on) return 'finished'
  return 'active'
}

/** Kutsut ensin (odottavat vastausta), sitten käynnissä, tulossa ja päättyneet. Ryhmän sisällä aikajärjestys. */
export function sortChallenges(rows: ChallengeRow[], today: string): ChallengeRow[] {
  const group = (row: ChallengeRow) =>
    row.my_status === 'invited' ? 0 : { active: 1, upcoming: 2, finished: 3 }[challengeState(row, today)]
  return [...rows].sort((a, b) => group(a) - group(b) || a.ends_on.localeCompare(b.ends_on))
}

/** "Anna", "Anna ja Liisa", "Anna, Sinä ja Liisa". */
export function joinNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ja ${names.at(-1)}` : (names[0] ?? '')
}

export interface Standing {
  userId: string
  name: string
  score: number
  /** Sama sija tasatuloksella: 1, 1, 3. */
  rank: number
}

/** Hyväksyneet osallistujat tuloksen mukaan. Tasatulokset jakavat sijan ja ovat aakkosjärjestyksessä. */
export function standings(members: ChallengeMember[]): Standing[] {
  const sorted = members
    .filter((m) => m.status === 'accepted')
    .map((m) => ({ userId: m.userId, name: m.name, score: m.score ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fi'))
  return sorted.map((m) => ({ ...m, rank: sorted.findIndex((other) => other.score === m.score) + 1 }))
}

/** Voittajat: kaikki suurimman tuloksen tehneet, jolloin tasapeli on jaettu voitto. Ei voittajaa, jos kukaan ei treenannut. */
export function winners(members: ChallengeMember[]): Standing[] {
  const ranked = standings(members)
  if (!ranked.length || ranked[0].score === 0) return []
  return ranked.filter((m) => m.rank === 1)
}

/** Viikko tai kuukausi tästä päivästä alkaen. */
export function presetPeriod(kind: 'week' | 'month', today: Date): { startsOn: string; endsOn: string } {
  const end = new Date(today)
  end.setDate(end.getDate() + (kind === 'week' ? 6 : 29))
  return { startsOn: localDate(today), endsOn: localDate(end) }
}

/** Päättymispäivä mukaan lukien: viimeisenä päivänä jäljellä on 1 päivä. */
export function daysLeft(endsOn: string, today: string): number {
  const ms = new Date(`${endsOn}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Haasteen pituus päivinä, uusintaottelua varten. */
export function lengthInDays(startsOn: string, endsOn: string): number {
  return daysLeft(endsOn, startsOn)
}

/** "7 salitreeniä", "1 treeni", "3 viikkoa". */
export function scoreLabel(metric: ChallengeMetric, n: number): string {
  if (metric === 'strength') return n === 1 ? '1 salitreeni' : `${n} salitreeniä`
  if (metric === 'workouts') return n === 1 ? '1 treeni' : `${n} treeniä`
  return n === 1 ? '1 viikko' : `${n} viikkoa`
}

/** "14.11.–20.11." */
export function periodLabel(startsOn: string, endsOn: string): string {
  const short = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`)
    return `${d.getDate()}.${d.getMonth() + 1}.`
  }
  return `${short(startsOn)}–${short(endsOn)}`
}
