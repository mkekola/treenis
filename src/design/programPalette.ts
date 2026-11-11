/**
 * Ohjelmien oma paletti. Lajivärit ovat vaaleita pastelleja ja tummaa tekstiä;
 * ohjelmavärit ovat syviä, murrettuja sävyjä ja vaaleaa tekstiä, joten ohjelmaa
 * ei voi sekoittaa lajiin. Tummassa teemassa sävyt on nostettu, jotta kortti
 * erottuu taustasta. Tekstin kontrasti on kaikissa vähintään 4,8:1.
 */
export interface ProgramColor {
  id: string
  name: string
  light: { surface: string; on: string }
  dark: { surface: string; on: string }
}

export const PROGRAM_COLORS: ProgramColor[] = [
  { id: 'luumu', name: 'Luumu', light: { surface: '#5E3B63', on: '#F5E4F2' }, dark: { surface: '#77517C', on: '#F5E4F2' } },
  { id: 'sammal', name: 'Sammal', light: { surface: '#4A5A3A', on: '#E9F0D9' }, dark: { surface: '#5A6D43', on: '#E9F0D9' } },
  { id: 'savi', name: 'Savi', light: { surface: '#8A4B3A', on: '#FBE3DA' }, dark: { surface: '#94543F', on: '#FBE3DA' } },
  { id: 'muste', name: 'Muste', light: { surface: '#34436B', on: '#E1E7FA' }, dark: { surface: '#4A5C8C', on: '#E1E7FA' } },
  { id: 'petrooli', name: 'Petrooli', light: { surface: '#2F5B5B', on: '#DDF1EE' }, dark: { surface: '#3B6E6C', on: '#DDF1EE' } },
  { id: 'okra', name: 'Okra', light: { surface: '#7D5F22', on: '#FAF0D6' }, dark: { surface: '#7D5F22', on: '#FAF0D6' } },
  { id: 'grafiitti', name: 'Grafiitti', light: { surface: '#3E3A3D', on: '#EEE8EA' }, dark: { surface: '#5E585C', on: '#EEE8EA' } },
]

export const DEFAULT_PROGRAM_COLOR = 'luumu'

export function programColor(id: string | undefined): ProgramColor {
  return PROGRAM_COLORS.find((c) => c.id === id) ?? PROGRAM_COLORS[0]
}

/** Kortin juureen asetettavat muuttujat, kuten lajiväreillä (sportVars). */
export function programVars(id: string | undefined, isDark: boolean): Record<string, string> {
  const pair = isDark ? programColor(id).dark : programColor(id).light
  return { '--program-surface': pair.surface, '--program-on': pair.on }
}

/** Uudelle ohjelmalle ensimmäinen väri, jota mikään ohjelma ei vielä käytä. */
export function nextFreeColor(used: (string | undefined)[]): string {
  return PROGRAM_COLORS.find((c) => !used.includes(c.id))?.id ?? DEFAULT_PROGRAM_COLOR
}
