export type SportKey =
  | 'strength'
  | 'run'
  | 'bike'
  | 'swim'
  | 'nordic'
  | 'skating'
  | 'hike'
  | 'climb'
  | 'alpine'
  | 'windsurf'
  | 'kitesurf'
  | 'yoga'
  | 'pilates'
  | 'other'

/**
 * Mitä lajista näytetään. Erillinen lajista itsestään, koska moni laji
 * käyttäytyy samalla tavalla: juoksu ja hiihto näyttävät matkan ja vauhdin,
 * jooga ja kiipeily pelkän keston.
 */
export type SportKind = 'strength' | 'distance' | 'session'

export const SPORT_KIND: Record<SportKey, SportKind> = {
  strength: 'strength',
  run: 'distance',
  bike: 'distance',
  swim: 'distance',
  nordic: 'distance',
  skating: 'distance',
  hike: 'distance',
  climb: 'session',
  alpine: 'session',
  windsurf: 'session',
  kitesurf: 'session',
  yoga: 'session',
  pilates: 'session',
  other: 'session',
}

/** Miten liikkeen suoritus mitataan. Kuuluu liikkeelle, ei sarjalle. */
export type Measurement =
  /** Kuorma ja toistot, esim. penkkipunnerrus. */
  | 'weight_reps'
  /** Toistot, lisäpaino valinnainen, esim. leuanveto. */
  | 'reps'
  /** Kesto, lisäpaino valinnainen, esim. lankku. */
  | 'time'

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'glutes'
  | 'core'
  | 'full_body'

/** Liikekirjaston liike. Historia kytkeytyy tunnisteeseen, ei nimeen. */
export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  measurement: Measurement
  /** Yhden puolen liike: kirjattu luku tarkoittaa per puoli, sama molemmille. */
  perSide: boolean
  /** Hakusanat, jotta "penkki" löytää Penkkipunnerruksen. */
  aliases: string[]
  /** Käyttäjän itse lisäämä, ei valmiista kirjastosta. */
  custom: boolean
  /**
   * Painon nousuaskel, kun sovellus ehdottaa nostoa. Riippuu välineestä:
   * käsipainot 2 kg, laitteet 5 kg, tanko 2,5 kg (oletus jos puuttuu).
   */
  weightStepKg?: number
  /** Vain omilla liikkeillä: asetetaan tallennuksessa synkkaa varten. */
  updatedAt?: string
}

/**
 * Tuntuma kysytään liikkeen viimeisen sarjan jälkeen, levon aikana.
 * Progressiosääntö jakaa sanat kolmeen tekoon: nosta, pidä, laske.
 */
export type Feel = 'very_easy' | 'easy' | 'right' | 'hard' | 'max'

export const FEEL_LABELS: Record<Feel, string> = {
  very_easy: 'Tosi kevyt',
  easy: 'Kevyt',
  right: 'Sopiva',
  hard: 'Raskas',
  max: 'Äärimmäinen',
}

/** Mitkä kentät ovat käytössä riippuu liikkeen mittaustavasta. */
export interface SetEntry {
  done: boolean
  reps?: number
  /** weight_reps: kuorma. reps ja time: lisäpaino, valinnainen. */
  weightKg?: number
  durationSec?: number
}

export interface BlockExercise {
  exerciseId: string
  sets: SetEntry[]
  /** Liikkeen tuntuma. Puuttuu jos kysymys ohitettiin. */
  feel?: Feel
}

/**
 * Lohko on joukko liikkeitä, jotka tehdään kierroksina. Tavallinen liike on
 * yhden liikkeen lohko, supersarja kahden ja kiertoharjoittelu kolmen tai
 * useamman. Lepo alkaa kun kierroksen viimeinen liike on tehty, eli yhden
 * liikkeen lohkossa jokaisen sarjan jälkeen. Erikoistapauksia ei tarvita.
 */
export interface Block {
  id: string
  exercises: BlockExercise[]
  restSec: number
}

/**
 * Treenipohja rakennetaan Pohjat-sivulla tai tallennetaan valmiista treenistä.
 * Sarjojen arvot ovat tavoitteita, done on aina false.
 */
export interface WorkoutTemplate {
  id: string
  name: string
  blocks: Block[]
  lastUsedAt?: string
  /**
   * Toistuvat poikkeamat, joihin käyttäjä vastasi "Pidä vanha". Niistä ei
   * kysytä uudelleen niin kauan kuin poikkeama jatkuu (src/lib/deviation.ts).
   */
  keptDeviations?: string[]
  /** Asetetaan jokaisessa tallennuksessa. Synkassa uusin versio voittaa. */
  updatedAt?: string
  /** Poistettu pohja jää laitteelle merkinnäksi, jotta poisto välittyy synkassa. */
  deletedAt?: string
}

/**
 * Ohjelma kokoaa treenipohjia, esimerkiksi "Koko kroppa 2krt/vko" sisältää
 * treenit A ja B. Treeni kuuluu yhteen ohjelmaan, ja ohjelma omistaa niiden
 * järjestyksen. Käytössä on se ohjelma, joka on otettu käyttöön viimeksi.
 */
export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced'

export const PROGRAM_LEVEL_LABELS: Record<ProgramLevel, string> = {
  beginner: 'Aloittelija',
  intermediate: 'Keskitaso',
  advanced: 'Edistynyt',
}

export interface Program {
  id: string
  name: string
  templateIds: string[]
  /** Ohjelmapaletin väri (src/design/programPalette.ts). Puuttuessa oletusväri. */
  color?: string
  /** Valinnainen kesto. Ilman sitä ohjelma jatkuu, kunnes toinen otetaan käyttöön. */
  durationWeeks?: number
  level?: ProgramLevel
  activatedAt?: string
  updatedAt?: string
  deletedAt?: string
}

/**
 * Kellon mittaama ja Stravan kautta saapunut data. Tätä Treenis ei muokkaa:
 * integraatio on vain luku, eikä sovellus kirjoita Stravaan mitään.
 */
export interface MeasuredData {
  stravaActivityId: number
  /** ISO-aikaleima, tarvitaan yhdistämiseen kirjatun treenin kanssa. */
  startedAt: string
  durationSec: number
  distanceM?: number
  avgHr?: number
  maxHr?: number
  calories?: number
  elevationGainM?: number
}

/** Mitä käyttäjä itse kirjasi. Tähän mittaus ei yllä. */
export interface LoggedData {
  startedAt?: string
  /** Käytetään vain jos mittausta ei ole. */
  durationSec?: number
  blocks?: Block[]
  /** Koettu rasitus 1–10 */
  rpe?: number
  notes?: string
}

/** Strava-aktiviteetti joka saattaa olla sama treeni, mutta osuma ei ole varma. */
export interface PendingMatch {
  stravaActivityId: number
  startedAt: string
  durationSec: number
  stravaSportName: string
}

export interface Workout {
  id: string
  sport: SportKey
  /** ISO-päivämäärä, esim. 2026-11-12 */
  date: string
  title: string
  /** Pohja josta treeni aloitettiin. Tarvitaan poikkeamien tunnistukseen. */
  templateId?: string
  measured?: MeasuredData
  logged?: LoggedData
  /** Odottaa vahvistusta: onko tämä sama treeni kuin mitattu aktiviteetti. */
  pendingMatch?: PendingMatch
  /** Asetetaan jokaisessa tallennuksessa. Synkassa uusin versio voittaa. */
  updatedAt?: string
}

export const SPORT_LABELS: Record<SportKey, string> = {
  strength: 'Sali',
  run: 'Juoksu',
  bike: 'Pyöräily',
  swim: 'Uinti',
  nordic: 'Hiihto',
  skating: 'Luistelu',
  hike: 'Vaellus',
  climb: 'Kiipeily',
  alpine: 'Laskettelu',
  windsurf: 'Purjelautailu',
  kitesurf: 'Leijalautailu',
  yoga: 'Jooga',
  pilates: 'Pilates',
  other: 'Muu',
}
