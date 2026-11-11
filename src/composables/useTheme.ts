import { computed, ref, watchEffect } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'treenis.theme'

/** Status bar -värit iOS:n PWA:ta varten, samat kuin --c-bg molemmissa teemoissa. */
const THEME_COLOR = { light: '#FBF5F4', dark: '#18141C' }

function load(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // Safari voi estää tallennustilan. Järjestelmän valinta on hyvä oletus.
  }
  return 'system'
}

const query = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(query.matches)
query.addEventListener('change', (event) => {
  systemDark.value = event.matches
})

const mode = ref<ThemeMode>(load())

const isDark = computed(() => mode.value === 'dark' || (mode.value === 'system' && systemDark.value))

watchEffect(() => {
  const root = document.documentElement

  // CSS tuntee kolme tilaa: ei attribuuttia (järjestelmä), light ja dark.
  if (mode.value === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode.value)

  const color = isDark.value ? THEME_COLOR.dark : THEME_COLOR.light
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', color))

  try {
    localStorage.setItem(STORAGE_KEY, mode.value)
  } catch {
    // Tallennus saa epäonnistua hiljaa.
  }
})

/**
 * Teeman tila yhdessä paikassa. `isDark` kertoo mikä teema on juuri nyt
 * voimassa — lajivärien parit valitaan sen mukaan, koska ne eivät ole
 * CSS-tokeneita vaan tulevat käyttäjän asetuksista.
 */
export function useTheme() {
  return { mode, isDark }
}
