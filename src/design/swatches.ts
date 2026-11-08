/**
 * Valmiit väriparit. Käyttäjä valitsee lajille swatchin, ei hex-arvoa:
 * jokainen pari sisältää pinnan ja tekstivärin molempiin teemoihin ja ylittää
 * WCAG AA -rajan 4,5:1, joten sovellusta ei voi säätää lukukelvottomaksi.
 */
export interface Swatch {
  id: string
  name: string
  light: { surface: string; on: string }
  dark: { surface: string; on: string }
}

export const SWATCHES: Swatch[] = [
  {
    id: 'ruusu',
    name: 'Ruusu',
    light: { surface: '#F9C5C7', on: '#7A2730' },
    dark: { surface: '#5E2730', on: '#F7CCCF' },
  },
  {
    id: 'korall',
    name: 'Korall',
    light: { surface: '#FBC4AC', on: '#7A3520' },
    dark: { surface: '#5E3123', on: '#F9CFBE' },
  },
  {
    id: 'persikka',
    name: 'Persikka',
    light: { surface: '#FFC697', on: '#6B3A12' },
    dark: { surface: '#5C3A1C', on: '#FFD9B4' },
  },
  {
    id: 'hunaja',
    name: 'Hunaja',
    light: { surface: '#F7E5B7', on: '#5A4510' },
    dark: { surface: '#4D3F1C', on: '#F2E4BC' },
  },
  {
    id: 'sitruuna',
    name: 'Sitruuna',
    light: { surface: '#E6ECA8', on: '#474E12' },
    dark: { surface: '#414515', on: '#E2E9B2' },
  },
  {
    id: 'salvia',
    name: 'Salvia',
    light: { surface: '#CBD3AD', on: '#3A4420' },
    dark: { surface: '#3B4526', on: '#D9E2BE' },
  },
  {
    id: 'minttu',
    name: 'Minttu',
    light: { surface: '#BDE3CE', on: '#1D4A33' },
    dark: { surface: '#1C4433', on: '#C6E6D6' },
  },
  {
    id: 'turkoosi',
    name: 'Turkoosi',
    light: { surface: '#B4E0DE', on: '#11474A' },
    dark: { surface: '#14434A', on: '#BCE2E0' },
  },
  {
    id: 'taivas',
    name: 'Taivas',
    light: { surface: '#BEDCF2', on: '#15425F' },
    dark: { surface: '#173E58', on: '#C6DEF2' },
  },
  {
    id: 'pervinkki',
    name: 'Pervinkki',
    light: { surface: '#C8CEEE', on: '#2C3570' },
    dark: { surface: '#2A3356', on: '#CFD7F2' },
  },
  {
    id: 'syreeni',
    name: 'Syreeni',
    light: { surface: '#DDC3E3', on: '#4A2A55' },
    dark: { surface: '#43305A', on: '#E6D4EE' },
  },
  {
    id: 'savu',
    name: 'Savu',
    light: { surface: '#DDD5D2', on: '#413937' },
    dark: { surface: '#3A3330', on: '#DED7D4' },
  },
]

export const SWATCHES_BY_ID: Record<string, Swatch> = Object.fromEntries(
  SWATCHES.map((s) => [s.id, s]),
)

/** Ennätyksen väri on kiinteä: onnistuminen ei saa käyttää minkään lajin väriä. */
export const RECORD_SWATCH_ID = 'ruusu'
