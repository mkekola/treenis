import { createRouter, createWebHistory } from 'vue-router'
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
    { path: '/tilastot', name: 'stats', component: () => import('@/views/StatsView.vue') },
    {
      path: '/asetukset/ulkoasu',
      name: 'appearance',
      component: () => import('@/views/AppearanceView.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
