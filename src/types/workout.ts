export type SportKey =
  | 'strength'
  | 'run'
  | 'bike'
  | 'swim'
  | 'nordic'
  | 'skating'
  | 'hike'
  | 'walk'
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
  walk: 'distance',
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

/** Päälihas. Tarkempi kuin lihasryhmä, jotta korvaava liike treenaa samoja lihaksia. */
export type Muscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'abs'
  | 'obliques'

/** Liikekirjaston liike. Historia kytkeytyy tunnisteeseen, ei nimeen. */
export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  /**
   * Päälihakset. Tyhjä kirjaston liikkeellä: koko kehon liike. Puuttuu omalta liikkeeltä,
   * joka on luotu ennen lihasvalintaa: silloin lihakset arvioidaan lihasryhmästä.
   */
  muscles?: Muscle[]
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
 * Käyttäjän kiinnittämät korvaavat liikkeet yhdelle liikkeelle. Kiinnitetyt näkyvät
 * korvaavien kärjessä ennen lihasvertailun ehdotuksia. Tyhjä lista: kaikki irrotettu.
 */
export interface SubstitutePins {
  exerciseId: string
  substituteIds: string[]
  updatedAt: string
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
  /** Muistiinpano tältä kerralta, esim. "Laite 2, istuin 4". */
  note?: string
  /**
   * Vain pohjassa: vaihtuvan liikkeen muut liikkeet omine tavoitteineen. Kierto alkaa
   * itse liikkeestä ja jatkuu näihin järjestyksessä (src/lib/rotation.ts).
   */
  alternatives?: RotationOption[]
}

/** Vaihtuvan liikkeen yksi liike ja sen tavoitesarjat. */
export interface RotationOption {
  exerciseId: string
  sets: SetEntry[]
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
/** Kestävyysosion määrä: aika (min tai s) tai matka (km tai m) siinä yksikössä, jolla se kirjoitettiin. */
export type CardioUnit = 'min' | 's' | 'km' | 'm'

export interface CardioAmount {
  value: number
  unit: CardioUnit
}

/** Teho suomalaisen valmennuksen nimillä: peruskestävyys, vauhtikestävyys, maksimikestävyys, nopeus. */
export type CardioZone = 'pk' | 'vk' | 'mk' | 'max'

export const CARDIO_ZONE_LABELS: Record<CardioZone, string> = { pk: 'PK', vk: 'VK', mk: 'MK', max: 'Nopeus' }

/** Valitun tehon selitys napin alle, jotta lyhenteet aukeavat myös muille kuin juoksijoille. */
export const CARDIO_ZONE_HINTS: Record<CardioZone, string> = {
  pk: 'peruskestävyys, rauhallinen: pystyt puhumaan',
  vk: 'vauhtikestävyys, reipas: puhe katkeilee',
  mk: 'maksimikestävyys, kova: 2–5 min vetoja',
  max: 'lyhyet spurtit täysillä',
}

/**
 * Kestävyyspohjan osio, kuten salipohjan liike: esimerkiksi "Vedot 6 × 400 m, palautus 90 s".
 * Teho, vauhti ja syke ovat vapaaehtoisia tavoitteita.
 */
export interface CardioSegment {
  id: string
  /** Esim. "Lämmittely" tai "Vedot". Saa olla tyhjä. */
  name: string
  reps: number
  work: CardioAmount
  /** Palautus toistojen välissä. Merkitsee vain, kun toistoja on useampi. */
  recovery?: CardioAmount
  zone?: CardioZone
  /** Tavoitevauhti sekunteina kilometrille. */
  paceSecPerKm?: number
  /** Tavoitesyke (keskisyke) lyönteinä minuutissa. */
  heartRate?: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  blocks: Block[]
  /** Kestävyyspohjan laji. Salipohjalla puuttuu. */
  sport?: SportKey
  /** Kestävyyspohjan osiot. Salipohjalla puuttuu. */
  segments?: CardioSegment[]
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
  /** Käsin kirjattu matka, esimerkiksi juoksu ilman Stravaa. Mitattu voittaa. */
  distanceM?: number
  /** Käsin kirjattu keskisyke. Mitattu voittaa. */
  avgHr?: number
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
  /** Piilotettu kaverisyötteestä. Piilotus koskee vain näkyvyyttä: treeni lasketaan yhä haasteisiin. */
  hiddenFromFriends?: boolean
  /** Asetetaan jokaisessa tallennuksessa. Synkassa uusin versio voittaa. */
  updatedAt?: string
  /** Poistettu treeni jää laitteelle merkinnäksi, kunnes poisto on välittynyt synkassa. */
  deletedAt?: string
}

export const SPORT_LABELS: Record<SportKey, string> = {
  strength: 'Sali',
  run: 'Juoksu',
  bike: 'Pyöräily',
  swim: 'Uinti',
  nordic: 'Hiihto',
  skating: 'Luistelu',
  hike: 'Vaellus',
  walk: 'Kävely',
  climb: 'Kiipeily',
  alpine: 'Laskettelu',
  windsurf: 'Purjelautailu',
  kitesurf: 'Leijalautailu',
  yoga: 'Jooga',
  pilates: 'Pilates',
  other: 'Muu',
}
