import { LIBRARY_MUSCLES } from '@/data/exerciseMuscles'
import type { Exercise, Measurement, Muscle, MuscleGroup } from '@/types/workout'

/**
 * Valmis liikekirjasto. Historia kytkeytyy id:hen eikä nimeen, joten nimen
 * voi korjata ilman että aiemmat treenit hajoavat. Id:tä ei saa vaihtaa
 * sen jälkeen kun liike on ollut käytössä.
 */
function ex(
  id: string,
  name: string,
  muscleGroup: MuscleGroup,
  measurement: Measurement,
  aliases: string[] = [],
  perSide = false,
): Exercise {
  return { id, name, muscleGroup, muscles: LIBRARY_MUSCLES[id] ?? [], measurement, perSide, aliases, custom: false }
}

export const EXERCISE_LIBRARY: Exercise[] = [
  // Rinta
  ex('bench-press', 'Penkkipunnerrus', 'chest', 'weight_reps', ['penkki', 'bench']),
  ex('incline-bench-press', 'Vinopenkkipunnerrus', 'chest', 'weight_reps', ['vinopenkki', 'incline']),
  ex('dumbbell-bench-press', 'Penkkipunnerrus käsipainoilla', 'chest', 'weight_reps', ['käsipainopenkki']),
  ex('incline-dumbbell-press', 'Vinopenkki käsipainoilla', 'chest', 'weight_reps', ['vinopenkki käsipainoilla']),
  ex('dumbbell-fly', 'Chest fly', 'chest', 'weight_reps', ['rintaflyes', 'flyes', 'fly', 'levitys', 'pec deck', 'peck-deck', 'pec machine', 'vipunostot maaten']),
  ex('cable-crossover', 'Rintavipu taljalla', 'chest', 'weight_reps', ['crossover', 'kaapeliristi', 'rintavipu kaapelilla', 'ristikkäistalja']),
  ex('chest-press-machine', 'Rintaprässi', 'chest', 'weight_reps', ['chest press', 'rintapunnerrus laitteessa']),
  ex('push-up', 'Punnerrus', 'chest', 'reps', ['punnerrukset', 'push up', 'lauta']),
  ex('dips', 'Dippi', 'chest', 'reps', ['dipit', 'dips', 'pystypunnerrus tangoissa']),

  // Selkä
  ex('deadlift', 'Maastaveto', 'back', 'weight_reps', ['mave', 'deadlift']),
  ex('trap-bar-deadlift', 'Maastaveto trap-tangolla', 'back', 'weight_reps', ['trap-tanko', 'trap tanko', 'trap bar', 'hex bar', 'mave trap']),
  ex('pull-up', 'Leuanveto', 'back', 'reps', ['leuka', 'leuat', 'pull up']),
  ex('chin-up', 'Leuanveto vastaotteella', 'back', 'reps', ['chin up', 'vastaote']),
  ex('lat-pulldown', 'Ylätalja', 'back', 'weight_reps', ['yläkuljetin', 'lat pulldown', 'alasveto']),
  ex('seated-cable-row', 'Taljasoutu', 'back', 'weight_reps', ['istuen soutu', 'alatalja', 'soutu', 'kaapelisoutu']),
  ex('barbell-row', 'Kulmasoutu tangolla', 'back', 'weight_reps', ['kulmasoutu', 'tankosoutu']),
  ex('dumbbell-row', 'Kulmasoutu käsipainoilla', 'back', 'weight_reps', ['soutu käsipainolla', 'kulmasoutu käsipainolla', 'käsipainosoutu', 'yhden käden soutu'], true),
  ex('t-bar-row', 'T-tankosoutu', 'back', 'weight_reps', ['t-bar', 't tanko']),
  ex('face-pull', 'Face pull', 'back', 'weight_reps', ['facepull', 'takaolka kaapelilla']),
  ex('back-extension', 'Selänojennus', 'back', 'reps', ['hyperextension', 'selkäpenkki', 'selkälihas', 'ojennus selkäpenkissä']),
  ex('straight-arm-pulldown', 'Alaspainallus taljassa', 'back', 'weight_reps', ['suorin käsin alasveto', 'pull down suorin käsin', 'straight arm']),
  ex('dumbbell-pullover', 'Päänyliveto käsipainolla', 'back', 'weight_reps', ['pullover', 'päänyliveto', 'päänyliveto käsipainoilla']),
  ex('inverted-row', 'Käänteinen soutu', 'back', 'reps', ['australialainen leuka', 'inverted']),

  // Olkapäät
  ex('overhead-press', 'Pystypunnerrus', 'shoulders', 'weight_reps', ['military press', 'olkapunnerrus tangolla', 'ylöstyöntö']),
  ex('dumbbell-shoulder-press', 'Pystypunnerrus käsipainoilla', 'shoulders', 'weight_reps', ['olkapunnerrus käsipainoilla', 'olkapunnerrus']),
  ex('machine-shoulder-press', 'Pystypunnerrus laitteessa', 'shoulders', 'weight_reps', ['olkapunnerrus laitteessa', 'shoulder press', 'olkalaite']),
  ex('arnold-press', 'Arnold-punnerrus', 'shoulders', 'weight_reps', ['arnold']),
  ex('lateral-raise', 'Sivunosto', 'shoulders', 'weight_reps', ['sivunostot', 'lateral raise', 'sivuolkapää', 'sivuolkapäät', 'vipunostot sivulle']),
  ex('front-raise', 'Etunosto', 'shoulders', 'weight_reps', ['etunostot', 'front raise', 'etuolkapää', 'etuolkapäät', 'vipunostot eteen']),
  ex('rear-delt-fly', 'Takaolkapäänosto', 'shoulders', 'weight_reps', ['takaolka', 'reverse fly', 'takaolkapää', 'vipunostot kulmassa']),
  ex('upright-row', 'Pystysoutu', 'shoulders', 'weight_reps', ['upright row']),
  ex('shrug', 'Olankohautus käsipainoilla', 'shoulders', 'weight_reps', ['hartioiden kohautus', 'olannosto', 'olannostot', 'shrug', 'niskavedot', 'kohautus']),

  // Kädet
  ex('barbell-curl', 'Hauiskääntö tangolla', 'arms', 'weight_reps', ['hauis', 'hauiskäännö', 'tankokääntö', 'curl']),
  ex('dumbbell-curl', 'Hauiskääntö käsipainoilla', 'arms', 'weight_reps', ['hauis käsipainoilla', 'käsipainokääntö', 'hauiskäännö käsipainoilla']),
  ex('hammer-curl', 'Vasarakääntö', 'arms', 'weight_reps', ['hammer curl', 'vasara', 'vasarakäännö']),
  ex('preacher-curl', 'Scott-penkki', 'arms', 'weight_reps', ['saarnaajapenkki', 'hauiskääntö scott penkissä', 'preacher', 'scott']),
  ex('cable-curl', 'Hauiskääntö taljalla', 'arms', 'weight_reps', ['hauis taljalla', 'kaapelihauis', 'hauiskääntö kaapelilla', 'hauiskäännö kaapelilla']),
  ex('triceps-pushdown', 'Ojentajapunnerrus taljalla', 'arms', 'weight_reps', ['ojentajapunnerrus', 'pushdown', 'ojentajaveto', 'ojentaja', 'ojentajat']),
  ex('skull-crusher', 'Ranskalainen punnerrus', 'arms', 'weight_reps', ['skull crusher', 'ranskalainen', 'ojentajapunnerrus makuulla']),
  ex('overhead-triceps-extension', 'Ojentajapunnerrus pään yli', 'arms', 'weight_reps', ['overhead extension', 'ojentaja pään yli']),
  ex('close-grip-bench', 'Penkkipunnerrus kapealla otteella', 'arms', 'weight_reps', ['kapea penkki']),
  ex('bench-dip', 'Penkkidippi', 'arms', 'reps', ['penkkidipit', 'dippi penkillä', 'dipit penkillä']),

  // Jalat
  ex('back-squat', 'Jalkakyykky', 'legs', 'weight_reps', ['kyykky', 'squat', 'takakyykky']),
  ex('front-squat', 'Etukyykky', 'legs', 'weight_reps', ['front squat']),
  ex('goblet-squat', 'Goblet-kyykky', 'legs', 'weight_reps', ['goblet', 'kahvakuulakyykky']),
  ex('hack-squat', 'Hack-kyykky', 'legs', 'weight_reps', ['hack squat', 'hacksquat']),
  ex('leg-press', 'Jalkaprässi', 'legs', 'weight_reps', ['prässi', 'leg press', 'jalkaprässi']),
  ex('single-leg-press', 'Jalkaprässi yhdellä jalalla', 'legs', 'weight_reps', ['yhden jalan prässi', 'yhden jalan jalkaprässi', 'single leg press', 'prässi yhdellä jalalla'], true),
  ex('lunge', 'Askelkyykky', 'legs', 'weight_reps', ['askelkyykyt', 'lunge', 'askel'], true),
  ex('walking-lunge', 'Askelkyykky kävellen', 'legs', 'weight_reps', ['kävelevä askelkyykky', 'kävelyaskel', 'walking lunge'], true),
  ex('bulgarian-split-squat', 'Bulgarialainen askelkyykky', 'legs', 'weight_reps', ['bulgarialainen', 'split squat', 'bulgarian'], true),
  ex('step-up', 'Step-up', 'legs', 'weight_reps', ['ylösastuminen', 'step up', 'penkille astuminen'], true),
  ex('leg-extension', 'Reiden ojennus', 'legs', 'weight_reps', ['jalan ojennus', 'polven ojennus laitteessa', 'leg extension', 'etureisi', 'etureidet']),
  ex('leg-curl', 'Reiden koukistus', 'legs', 'weight_reps', ['jalan koukistus', 'polven koukistus laitteessa', 'leg curl', 'takareisi', 'takareidet']),
  ex('romanian-deadlift', 'Romanialainen maastaveto', 'legs', 'weight_reps', ['rdl', 'romanialainen', 'suorin jaloin', 'suorin jaloin maastaveto']),
  ex('calf-raise', 'Pohjenousu', 'legs', 'weight_reps', ['pohjenosto', 'pohjenousut', 'pohkeet', 'pohje', 'calf raise', 'pohjeprässi seisten']),
  ex('seated-calf-raise', 'Pohjenousu istuen', 'legs', 'weight_reps', ['pohjeprässi', 'pohjeprässi istuen', 'seated calf raise']),
  ex('hip-adductor', 'Reiden lähennys', 'legs', 'weight_reps', ['lonkan lähennys', 'reisilähennys', 'reiden lähennys taljassa', 'sisäreisi', 'adductor', 'lähennys']),
  ex('hip-abductor', 'Reiden loitonnus', 'legs', 'weight_reps', ['lonkan loitonnus', 'reisiloitonnus', 'reiden loitonnus taljassa', 'ulkoreisi', 'abductor', 'loitonnus']),
  ex('sumo-squat', 'Sumokyykky', 'legs', 'weight_reps', ['sumo', 'sumo squat', 'leveä kyykky']),

  // Pakarat
  ex('hip-thrust', 'Lantionnosto', 'glutes', 'weight_reps', ['hip thrust', 'pakarat', 'lantio']),
  ex('glute-bridge', 'Lantiosilta', 'glutes', 'reps', ['glute bridge', 'silta']),
  ex('cable-kickback', 'Pakaranpotku taljalla', 'glutes', 'weight_reps', ['kickback', 'potku taljalla', 'pakaranpotku kaapelilla', 'lonkan ojennus taljassa'], true),
  ex('good-morning', 'Good morning', 'glutes', 'weight_reps', ['goodmorning', 'hyvää huomenta']),

  // Keskivartalo
  ex('plank', 'Lankku', 'core', 'time', ['plank', 'etulankku']),
  ex('side-plank', 'Sivulankku', 'core', 'time', ['side plank'], true),
  ex('hollow-hold', 'Hollow hold', 'core', 'time', ['hollow', 'venepito']),
  ex('crunch', 'Vatsarutistus', 'core', 'reps', ['vatsarutistukset', 'crunch', 'vatsat']),
  ex('sit-up', 'Istumaannousu', 'core', 'reps', ['sit up', 'vatsaprässi']),
  ex('cable-crunch', 'Vatsarutistus taljalla', 'core', 'weight_reps', ['cable crunch', 'kaapelivatsa', 'vatsarutistus kaapelilla']),
  ex('hanging-leg-raise', 'Riipunnassa jalkojen nosto', 'core', 'reps', ['jalannosto', 'jalan nostot roikkuen', 'hanging leg raise', 'polvennosto']),
  ex('russian-twist', 'Venäläinen kierto', 'core', 'weight_reps', ['russian twist', 'kierto', 'vartalon kierto paino sylissä']),
  ex('ab-wheel', 'Vatsarulla', 'core', 'reps', ['ab wheel', 'rulla']),
  ex('dead-bug', 'Dead bug', 'core', 'reps', ['deadbug', 'kuollut ötökkä']),
  ex('bicycle-crunch', 'Bicycle crunch', 'core', 'reps', ['polkupyöräkrunch', 'polkupyörä', 'vatsarutistukset kiertäen']),
  ex('dumbbell-side-bend', 'Sivutaivutus käsipainolla', 'core', 'weight_reps', ['sivutaivutus', 'sivutaivutus käsipainoilla', 'side bend'], true),
  ex('pallof-press', 'Pallof-punnerrus', 'core', 'weight_reps', ['pallof'], true),

  // Koko keho
  ex('kettlebell-swing', 'Kahvakuulaheitto', 'full_body', 'weight_reps', ['kettlebell swing', 'swing', 'kahvakuula']),
  ex('turkish-get-up', 'Turkkilainen ylösnousu', 'full_body', 'weight_reps', ['turkish get up', 'tgu'], true),
  ex('clean', 'Rinnalleveto', 'full_body', 'weight_reps', ['clean', 'power clean']),
  ex('snatch', 'Tempaus', 'full_body', 'weight_reps', ['snatch']),
  ex('thruster', 'Thruster', 'full_body', 'weight_reps', ['thrusterit']),
  ex('burpee', 'Burpee', 'full_body', 'reps', ['burpeet']),
  ex('mountain-climber', 'Vuorikiipeilijä', 'full_body', 'time', ['mountain climber', 'vuorikiipeily']),
  ex('farmers-carry', 'Kantokävely', 'full_body', 'time', ['farmers walk', 'farmer', 'kantaminen']),
  ex('sled-push', 'Kelkan työntö', 'full_body', 'time', ['sled', 'kelkka', 'sled push']),
  ex('battle-ropes', 'Taisteluköydet', 'full_body', 'time', ['battle ropes', 'köydet']),
]

/**
 * Painon nousuaskel välineen mukaan, kun sovellus ehdottaa nostoa. Tanko
 * (2,5 kg) on oletus eikä tarvitse merkintää. Laitteiden pinot vaihtelevat
 * saleittain, joten niiden 5 kg on arvio, jota voi muuttaa.
 */
const WEIGHT_STEP_KG: Record<string, number> = {
  'dumbbell-bench-press': 2,
  'incline-dumbbell-press': 2,
  'dumbbell-fly': 2,
  'dumbbell-row': 2,
  'dumbbell-pullover': 2,
  'dumbbell-side-bend': 2,
  'dumbbell-shoulder-press': 2,
  'arnold-press': 2,
  'lateral-raise': 2,
  'front-raise': 2,
  'rear-delt-fly': 2,
  'dumbbell-curl': 2,
  'hammer-curl': 2,
  'goblet-squat': 2,
  'lat-pulldown': 5,
  'seated-cable-row': 5,
  'triceps-pushdown': 5,
  'face-pull': 5,
  'cable-curl': 5,
  'calf-raise': 5,
  'seated-calf-raise': 5,
  'leg-press': 5,
  'single-leg-press': 5,
  'hip-abductor': 5,
  'hip-adductor': 5,
  'machine-shoulder-press': 5,
  'chest-press-machine': 5,
  'leg-extension': 5,
  'leg-curl': 5,
  'cable-crossover': 5,
  'cable-kickback': 5,
  'cable-crunch': 5,
  'straight-arm-pulldown': 5,
}

for (const exercise of EXERCISE_LIBRARY) {
  const step = WEIGHT_STEP_KG[exercise.id]
  if (step) exercise.weightStepKg = step
}

export const EXERCISES_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISE_LIBRARY.map((exercise) => [exercise.id, exercise]),
)

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Rinta',
  back: 'Selkä',
  shoulders: 'Olkapäät',
  arms: 'Kädet',
  legs: 'Jalat',
  glutes: 'Pakarat',
  core: 'Keskivartalo',
  full_body: 'Koko keho',
}

/** Päälihakset salikielellä, alueittain kuten omaa liikettä luodessa. */
export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Rinta',
  front_delts: 'Etuolkapää',
  side_delts: 'Sivuolkapää',
  rear_delts: 'Takaolkapää',
  lats: 'Leveä selkälihas',
  upper_back: 'Yläselkä',
  lower_back: 'Alaselkä',
  biceps: 'Hauis',
  triceps: 'Ojentajat',
  forearms: 'Kyynärvarret',
  quads: 'Etureidet',
  hamstrings: 'Takareidet',
  glutes: 'Pakarat',
  adductors: 'Sisäreidet',
  calves: 'Pohkeet',
  abs: 'Vatsat',
  obliques: 'Vinot vatsat',
}

export const MUSCLE_AREAS: { label: string; muscles: Muscle[] }[] = [
  {
    label: 'Ylävartalo',
    muscles: ['chest', 'front_delts', 'side_delts', 'rear_delts', 'lats', 'upper_back', 'lower_back', 'biceps', 'triceps', 'forearms'],
  },
  { label: 'Alavartalo', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'] },
  { label: 'Keskivartalo', muscles: ['abs', 'obliques'] },
]

export const MEASUREMENT_LABELS: Record<Measurement, string> = {
  weight_reps: 'Paino ja toistot',
  reps: 'Toistot',
  time: 'Kesto',
}
