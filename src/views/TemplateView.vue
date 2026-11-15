<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import CardioTemplateEditView from '@/views/CardioTemplateEditView.vue'
import TemplateEditView from '@/views/TemplateEditView.vue'
import { isCardio } from '@/lib/cardio'
import { useTemplates } from '@/stores/templates'

// Sama osoite molemmille pohjille: kestävyyspohja muokataan osioina, salipohja liikkeinä.
const route = useRoute()
const templates = useTemplates()
const cardio = computed(() => {
  const template = templates.templates.find((t) => t.id === route.params.id)
  return template !== undefined && isCardio(template)
})
</script>

<template>
  <CardioTemplateEditView v-if="cardio" />
  <TemplateEditView v-else />
</template>
