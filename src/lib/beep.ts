/**
 * Lepoajan loppumerkki. iOS ei värise selaimessa, joten ääni on ainoa merkki
 * kun puhelin on taskussa. Selain sallii äänen vasta käyttäjän kosketuksen
 * jälkeen, joten konteksti käynnistetään ensimmäisellä sarjan merkinnällä.
 */
let context: AudioContext | undefined

export function primeAudio() {
  try {
    context ??= new AudioContext()
    void context.resume()
  } catch {
    // Ääni ei ole välttämätöntä.
  }
}

export function beep() {
  if (!context) return

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
}
