/** Asetusten alasivut listan järjestyksessä. Avain on osoitteen loppu: /asetukset/<avain>. */
export const SETTINGS_PAGES = [
  { key: 'ulkoasu', title: 'Ulkoasu', hint: 'Teema' },
  { key: 'lajien-varit', title: 'Lajien värit', hint: 'Lajiryhmien värit' },
  { key: 'kaverit', title: 'Kaverit näkevät', hint: 'Mitä jaat kavereille' },
  { key: 'ilmoitukset', title: 'Ilmoitukset', hint: 'Kaveripyynnöt, reaktiot, haasteet' },
  { key: 'strava', title: 'Strava', hint: 'Yhteys ja tuonti' },
  { key: 'tiedot', title: 'Omat tietosi', hint: 'Vienti ja tuonti muistiinpanoista' },
  { key: 'tili', title: 'Tili', hint: 'Nimi ja uloskirjautuminen' },
] as const

export type SettingsPageKey = (typeof SETTINGS_PAGES)[number]['key'] | 'ikonit'
