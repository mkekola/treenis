import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import { supabase } from '@/lib/supabase'

const DEVICE_USER_KEY = 'treenis.userId'
const DEVICE_EMAIL_KEY = 'treenis.userEmail'

// Tämän laitteen käyttäjän data localStoragessa. Ulkoasun asetukset eivät ole
// tässä: ne kuuluvat laitteelle, eivät tilille.
const ACCOUNT_KEYS = [DEVICE_USER_KEY, DEVICE_EMAIL_KEY, 'treenis.lastPull', 'treenis.customExercises']

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Jos tallennus on estetty, kirjautuminen kysytään seuraavalla käynnistyksellä uudelleen.
  }
}

/**
 * Kirjautuminen kerran per laite. Supabasen istunto vanhenee tunnissa ja
 * uusitaan verkon kautta, joten ilman verkkoa se näyttää hetkellisesti
 * puuttuvan. Laite muistaa siksi itse, kenen se on: sovellus aukeaa salilla
 * ilman verkkoa, ja synkka odottaa kunnes istunto saadaan uusittua.
 */
export const useAuth = defineStore('auth', () => {
  const userId = ref<string | null>(read(DEVICE_USER_KEY))
  const email = ref<string | null>(read(DEVICE_EMAIL_KEY))
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      userId.value = session.user.id
      email.value = session.user.email ?? null
      write(DEVICE_USER_KEY, session.user.id)
      if (session.user.email) write(DEVICE_EMAIL_KEY, session.user.email)
    }
  })

  /** Lähettää koodin vain jo olemassa olevalle käyttäjälle: uusia tilejä ei luoda. */
  async function sendCode(address: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false },
    })
    if (error) throw error
  }

  async function verifyCode(address: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email: address, token, type: 'email' })
    if (error) throw error
  }

  /**
   * Vain kehitysversiossa: avaa sovelluksen ilman kirjautumista. Synkka ei
   * toimi ilman oikeaa istuntoa, joten muutokset jäävät tälle koneelle.
   */
  function skipInDev() {
    if (!import.meta.env.DEV) return
    userId.value = 'dev'
  }

  /**
   * Kirjaa ulos ja tyhjentää laitteen, jotta seuraava kirjautuja ei näe eikä
   * lähetä edellisen treenejä omalle tililleen. Kutsujan vastuulla on
   * varmistaa, ettei lähettämättömiä muutoksia ole.
   */
  async function signOut() {
    // 'local' kirjaa ulos vain tältä laitteelta eikä tarvitse verkkoa.
    await supabase.auth.signOut({ scope: 'local' })
    await db.delete()
    for (const key of ACCOUNT_KEYS) {
      try {
        localStorage.removeItem(key)
      } catch {
        // Ei haittaa: tunniste korvautuu seuraavassa kirjautumisessa.
      }
    }
    // Täysi uudelleenlataus: muistissa olevat listat ja avattu tietokanta nollautuvat.
    window.location.replace('/kirjaudu')
  }

  return { userId, email, sendCode, verifyCode, skipInDev, signOut }
})
