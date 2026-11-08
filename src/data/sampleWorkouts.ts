import type { Workout } from '@/types/workout'

/**
 * Väliaikainen esimerkkidata, jotta näkymiä voi kehittää ennen Supabasea.
 * Näyttää kaikki kolme tilannetta: mitattu + kirjattu, pelkkä mitattu, ja
 * kirjattu jonka Strava-osuma odottaa vahvistusta.
 */
export const sampleWorkouts: Workout[] = [
  {
    id: 'w1',
    sport: 'strength',
    date: '2026-11-12',
    title: 'Jalkapäivä',
    measured: {
      stravaActivityId: 14920011,
      startedAt: '2026-11-12T17:28:00+02:00',
      durationSec: 3480,
      avgHr: 118,
      maxHr: 164,
      calories: 412,
    },
    logged: {
      rpe: 7,
      blocks: [
        {
          id: 'b1',
          restSec: 150,
          exercises: [
            {
              exerciseId: 'back-squat',
              sets: [
                { weightKg: 80, reps: 5, done: true },
                { weightKg: 80, reps: 5, done: true },
                { weightKg: 80, reps: 5, done: true },
              ],
            },
          ],
        },
        {
          id: 'b2',
          restSec: 150,
          exercises: [
            {
              exerciseId: 'deadlift',
              sets: [
                { weightKg: 90, reps: 5, done: true },
                { weightKg: 90, reps: 5, done: true },
                { weightKg: 90, reps: 5, done: true },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'w2',
    sport: 'run',
    date: '2026-11-11',
    title: 'Iltalenkki',
    measured: {
      stravaActivityId: 14911002,
      startedAt: '2026-11-11T18:02:00+02:00',
      durationSec: 2530,
      distanceM: 8240,
      avgHr: 154,
      maxHr: 171,
      elevationGainM: 62,
    },
  },
  {
    id: 'w3',
    sport: 'strength',
    date: '2026-11-10',
    title: 'Ylävartalo',
    logged: {
      startedAt: '2026-11-10T07:12:00+02:00',
      durationSec: 2760,
      rpe: 6,
      blocks: [
        {
          // Supersarja: penkki ja soutu vuorotellen, lepo parin jälkeen.
          id: 'b3',
          restSec: 90,
          exercises: [
            {
              exerciseId: 'bench-press',
              sets: [
                { weightKg: 60, reps: 8, done: true },
                { weightKg: 62.5, reps: 7, done: true },
                { weightKg: 62.5, reps: 6, done: true },
              ],
            },
            {
              exerciseId: 'seated-cable-row',
              sets: [
                { weightKg: 50, reps: 10, done: true },
                { weightKg: 50, reps: 10, done: true },
                { weightKg: 50, reps: 10, done: true },
              ],
            },
          ],
        },
        {
          id: 'b4',
          restSec: 60,
          exercises: [
            {
              exerciseId: 'plank',
              sets: [
                { durationSec: 60, done: true },
                { durationSec: 50, done: true },
              ],
            },
          ],
        },
      ],
    },
    pendingMatch: {
      stravaActivityId: 14903344,
      startedAt: '2026-11-10T07:05:00+02:00',
      durationSec: 2940,
      stravaSportName: 'Weight Training',
    },
  },
  {
    id: 'w4',
    sport: 'swim',
    date: '2026-11-09',
    title: 'Aamu-uinti',
    measured: {
      stravaActivityId: 14890455,
      startedAt: '2026-11-09T08:30:00+02:00',
      durationSec: 1930,
      distanceM: 1500,
      avgHr: 139,
    },
  },
  {
    id: 'w5',
    sport: 'yoga',
    date: '2026-11-08',
    title: 'Aamujooga',
    logged: {
      durationSec: 1500,
      rpe: 3,
      notes: 'Lonkat jumissa, pidempi avausosio ensi kerralla.',
    },
  },
  {
    id: 'w6',
    sport: 'nordic',
    date: '2026-11-07',
    title: 'Ensilumen latu',
    measured: {
      stravaActivityId: 14871209,
      startedAt: '2026-11-07T13:40:00+02:00',
      durationSec: 4080,
      distanceM: 12400,
      avgHr: 146,
      elevationGainM: 118,
    },
  },
]
