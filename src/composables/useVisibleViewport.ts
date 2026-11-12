import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Näkyvän alueen korkeus ja näppäimistön viemä tila alareunasta.
 *
 * iPhonessa näppäimistö ei pienennä sivua vaan peittää sen alaosan, joten
 * ruudun alareunaan kiinnitetty paneeli jää näppäimistön alle. visualViewport
 * kertoo, paljonko ruudusta oikeasti näkyy, ja paneeli mitoitetaan sen mukaan.
 */
export function useVisibleViewport() {
  const height = ref(window.innerHeight)
  const keyboardInset = ref(0)
  /** Kuinka paljon selain on vierittänyt näkymää alas, kun kenttään kohdistettiin. */
  const offsetTop = ref(0)

  function update() {
    const viewport = window.visualViewport
    if (!viewport) return
    height.value = Math.round(viewport.height)
    offsetTop.value = Math.round(viewport.offsetTop)
    keyboardInset.value = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
  }

  onMounted(() => {
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
  })

  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
  })

  return { height, keyboardInset, offsetTop }
}
