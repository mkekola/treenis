import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { seedIfEmpty } from './db/seed'
import { router } from './router'
import { useExercises } from './stores/exercises'
import { usePrograms } from './stores/programs'
import { useSession } from './stores/session'
import { useSync } from './stores/sync'
import { useTemplates } from './stores/templates'
import { useWorkouts } from './stores/workouts'
import './style.css'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router)

// Data ladataan ennen ensimmäistä piirtoa, jotta näkymä ei välähdä tyhjänä.
await seedIfEmpty()
await Promise.all([
  useWorkouts(pinia).load(),
  useTemplates(pinia).load(),
  useExercises(pinia).load(),
  usePrograms(pinia).load(),
  useSession(pinia).load(),
])

app.mount('#app')

// Ilmoituksen napautus, kun Treenis on jo auki (public/push-sw.js): näkymä vaihtuu ilman uudelleenlatausta.
navigator.serviceWorker?.addEventListener('message', (event) => {
  const path = event.data?.type === 'open' ? event.data.path : null
  if (typeof path === 'string' && path.startsWith('/')) void router.push(path)
})

// Synkka käynnistyy vasta piirron jälkeen: sovellus ei odota verkkoa.
useSync(pinia).start()

// Safari voi tyhjentää selaimen tallennustilan. Pysyvä tallennus pyydetään
// erikseen, ja vastaus on vain toive: selain saa kieltäytyä.
void navigator.storage?.persist?.()
