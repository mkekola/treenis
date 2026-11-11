import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'
import DiaryView from '@/views/DiaryView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'diary', component: DiaryView },
    {
      path: '/treeni/uusi',
      name: 'new-workout',
      component: () => import('@/views/NewWorkoutView.vue'),
    },
    {
      path: '/treeni',
      name: 'session',
      component: () => import('@/views/SessionView.vue'),
      meta: { hideNav: true },
    },
    {
      path: '/treeni/esikatselu/:templateId',
      name: 'preview',
      component: () => import('@/views/WorkoutPreviewView.vue'),
      meta: { hideNav: true },
    },
    {
      path: '/treeni/yhteenveto',
      name: 'summary',
      component: () => import('@/views/SummaryView.vue'),
      meta: { hideNav: true },
    },
    { path: '/ohjelmat', name: 'programs', component: () => import('@/views/ProgramsView.vue') },
    { path: '/ohjelmat/:id', name: 'program', component: () => import('@/views/ProgramView.vue') },
    {
      path: '/ohjelmat/:programId/:id',
      name: 'template-edit',
      component: () => import('@/views/TemplateEditView.vue'),
    },
    { path: '/tilastot', name: 'stats', component: () => import('@/views/StatsView.vue') },
    {
      path: '/asetukset/ulkoasu',
      name: 'appearance',
      component: () => import('@/views/AppearanceView.vue'),
    },
    {
      path: '/kirjaudu',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { hideNav: true, public: true },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Kutsutuille tehty sovellus: ilman kirjautumista näkyy vain kirjautumissivu.
router.beforeEach((to) => {
  const signedIn = useAuth().userId !== null
  if (!signedIn && !to.meta.public) return { name: 'login' }
  if (signedIn && to.name === 'login') return { name: 'diary' }
})
