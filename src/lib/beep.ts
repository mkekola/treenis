/**
 * Lepoajan loppumerkki. Selain sallii äänen vasta käyttäjän kosketuksen jälkeen, joten
 * konteksti käynnistetään ensimmäisellä sarjan merkinnällä.
 *
 * Äänikanava pidetään kiinni muulloin kuin merkin aikana: auki oleva kanava saa
 * Androidilla toisen sovelluksen musiikin pysähtymään. iPhonella merkki soitetaan
 * lyhyenä ilmoitusäänenä, joka ei pysäytä taustalla soivaa musiikkia.
 */
let context: AudioContext | undefined
let releaseTimer: ReturnType<typeof setTimeout> | undefined

/** Safari 16.4+: äänen luonne. Muissa selaimissa ominaisuutta ei ole, ja se ohitetaan. */
interface AudioSessionNavigator extends Navigator {
  audioSession?: { type: string }
}

const RELEASE_AFTER_MS = 700

function release() {
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => void context?.suspend().catch(() => {}), RELEASE_AFTER_MS)
}

export function primeAudio() {
  try {
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session) session.type = 'transient'
    context ??= new AudioContext()
    void context.resume().then(release)
  } catch {
    // Ääni ei ole välttämätöntä.
  }
}

export async function beep() {
  if (!context) return
  try {
    await context.resume()
  } catch {
    return
  }

  // Kaksi lyhyttä äänimerkkiä erottuvat salin taustamelusta paremmin kuin yksi.
  for (const offset of [0, 0.28]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime + offset

    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)

    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.22)
  }
  release()
}
