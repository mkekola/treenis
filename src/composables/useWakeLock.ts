import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Pitää näytön päällä kun komponentti on näkyvissä. Salilla puhelin ei saa
 * mennä lukkoon sarjojen välissä. Selain vapauttaa lukon aina kun sivu
 * piilotetaan, joten se pyydetään uudelleen kun sivu palaa näkyviin.
 * Tuki puuttuu osasta selaimia, eikä sen puute ole virhe.
 */
export function useWakeLock() {
  let lock: WakeLockSentinel | undefined

  async function request() {
    try {
      lock = await navigator.wakeLock?.request('screen')
    } catch {
      // Esimerkiksi akkusäästö voi estää lukon. Treeni toimii ilmankin.
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void request()
  }

  onMounted(() => {
    void request()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    void lock?.release()
  })
}
