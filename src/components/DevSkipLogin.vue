<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()

async function skip() {
  auth.skipInDev()
  await router.replace('/')
}
</script>

<template>
  <button type="button" class="min-h-11 text-sm font-semibold text-ink-muted underline" @click="skip">
    Kehitys: jatka ilman kirjautumista
  </button>
</template>
