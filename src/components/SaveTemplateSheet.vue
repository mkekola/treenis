<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { fromSession } from '@/lib/template'
import { usePrograms } from '@/stores/programs'
import type { ActiveSession } from '@/types/session'

const props = defineProps<{ open: boolean; session: ActiveSession }>()
const emit = defineEmits<{ close: []; saved: [templateName: string, programName: string] }>()

const programs = usePrograms()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

/** Jos kaikki ohjelmat on poistettu, pohjalle luodaan oma ohjelma. */
const FALLBACK_PROGRAM_NAME = 'Omat treenit'

const programId = ref('')
const name = ref('')
const nameEdited = ref(false)
const busy = ref(false)

// Oletusnimi seuraa valittua ohjelmaa (Treeni 3 …), kunnes nimeä muokataan itse.
watch(programId, (id) => {
  if (!nameEdited.value) name.value = id ? programs.nextTemplateName(id) : 'Treeni 1'
})

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      dialog.value?.close()
      return
    }
    nameEdited.value = false
    programId.value = programs.active?.id ?? programs.programs[0]?.id ?? ''
    name.value = programId.value ? programs.nextTemplateName(programId.value) : 'Treeni 1'
    await nextTick()
    dialog.value?.showModal()
  },
)

const canSave = computed(() => name.value.trim().length > 0 && !busy.value)

async function save() {
  if (!canSave.value) return
  busy.value = true
  try {
    let target = programs.byId(programId.value)
    if (!target) target = await programs.create(FALLBACK_PROGRAM_NAME)
    const template = fromSession(props.session, `template-${crypto.randomUUID()}`, name.value.trim())
    await programs.addTemplateTo(target.id, template)
    emit('saved', template.name, target.name)
  } finally {
    busy.value = false
  }
}

function onNativeClose() {
  if (props.open) emit('close')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="tallenna-pohjaksi"
    class="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-[480px] flex-col rounded-t-3xl bg-bg p-0 text-ink backdrop:bg-black/40 open:flex"
    @close="onNativeClose"
    @click="onBackdropClick"
  >
    <form
      class="flex flex-col gap-3 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      @submit.prevent="save"
    >
      <h2
        id="tallenna-pohjaksi"
        class="font-display text-[22px] leading-tight font-bold tracking-[-0.02em]"
      >
        Tallenna pohjaksi
      </h2>
      <p class="-mt-1 text-[13px] text-ink-muted">
        Pohjaan tulevat kaikki liikkeet sarjoineen sellaisina kuin ne olivat lopussa. Painot
        tulevat ensi kerralla historiasta.
      </p>

      <label class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Nimi
        <input
          v-model="name"
          type="text"
          required
          class="mt-1 block h-12 w-full rounded-(--radius-field) border border-line bg-surface px-3.5 text-base font-normal tracking-normal text-ink normal-case"
          @input="nameEdited = true"
        />
      </label>

      <label
        v-if="programs.programs.length"
        class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase"
      >
        Ohjelma
        <select
          v-model="programId"
          class="mt-1 block h-12 w-full rounded-(--radius-field) border border-line bg-surface px-3 text-[15px] font-normal tracking-normal text-ink normal-case"
        >
          <option v-for="program in programs.programs" :key="program.id" :value="program.id">
            {{ program.name }}{{ program.id === programs.active?.id ? ' (käytössä)' : '' }}
          </option>
        </select>
      </label>
      <p v-else class="text-[13px] text-ink-muted">
        Pohja tallennetaan uuteen ohjelmaan "{{ FALLBACK_PROGRAM_NAME }}".
      </p>

      <div class="mt-1 flex gap-2">
        <button
          type="button"
          class="min-h-12 flex-1 rounded-(--radius-button) border border-line font-semibold"
          @click="emit('close')"
        >
          Peruuta
        </button>
        <button
          type="submit"
          :disabled="!canSave"
          class="min-h-12 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-60"
        >
          Tallenna
        </button>
      </div>
    </form>
  </dialog>
</template>
