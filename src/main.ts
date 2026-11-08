import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { seedIfEmpty } from './db/seed'
import { router } from './router'
import { useSession } from './stores/session'
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
  useSession(pinia).load(),
])

app.mount('#app')

// Safari voi tyhjentää selaimen tallennustilan. Pysyvä tallennus pyydetään
// erikseen, ja vastaus on vain toive: selain saa kieltäytyä.
void navigator.storage?.persist?.()
