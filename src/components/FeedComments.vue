<script setup lang="ts">
import { computed, ref } from 'vue'
import { COMMENT_MAX, commentTime, type FeedRow } from '@/lib/feed'
import { useAuth } from '@/stores/auth'
import { useFeed } from '@/stores/feed'

/**
 * Treenin kommenttiketju avatussa syöterivissä. Pitkästä ketjusta näytetään uusimmat,
 * jotta syöte ei veny. Kirjoittaja poistaa omansa, treenin tekijä minkä tahansa.
 */
const props = defineProps<{ row: FeedRow }>()

const SHOWN = 3

const auth = useAuth()
const feed = useFeed()

const comments = computed(() => props.row.comments ?? [])
const showAll = ref(false)
const hiddenCount = computed(() => (showAll.value ? 0 : Math.max(0, comments.value.length - SHOWN)))
const shown = computed(() => comments.value.slice(hiddenCount.value))

const draft = ref('')
const sending = ref(false)
const error = ref('')
/** Poisto vaatii toisen napautuksen, koska poistettua ei saa takaisin. */
const confirming = ref<string | null>(null)
const inputId = computed(() => `kommentti-${props.row.workout_id}`)
const canSend = computed(() => draft.value.trim().length > 0 && !sending.value)
const now = new Date()

const canDelete = (userId: string) => props.row.is_me || userId === auth.userId

async function send() {
  if (!canSend.value) return
  sending.value = true
  error.value = ''
  try {
    await feed.addComment(props.row.workout_id, draft.value)
    draft.value = ''
  } catch {
    error.value = 'Kommentti ei tallentunut. Tarkista verkkoyhteys.'
  } finally {
    sending.value = false
  }
}

async function remove(commentId: string) {
  if (confirming.value !== commentId) {
    confirming.value = commentId
    return
  }
  confirming.value = null
  error.value = ''
  try {
    await feed.deleteComment(props.row.workout_id, commentId)
  } catch {
    error.value = 'Poisto ei onnistunut. Tarkista verkkoyhteys.'
  }
}
</script>

<template>
  <section :aria-label="`Kommentit, ${comments.length}`" class="flex flex-col gap-2">
    <button
      v-if="hiddenCount"
      type="button"
      class="min-h-11 self-start text-[13px] font-semibold underline"
      @click="showAll = true"
    >
      Näytä kaikki kommentit ({{ comments.length }})
    </button>

    <ul v-if="shown.length" class="flex flex-col gap-2">
      <li v-for="comment in shown" :key="comment.id" class="flex flex-col">
        <div class="flex items-center justify-between gap-2">
          <p class="min-w-0 text-ink-muted" data-numeric>
            <strong class="font-semibold text-ink">{{ comment.userId === auth.userId ? 'Sinä' : comment.name }}</strong>
            · {{ commentTime(comment.createdAt, now) }}
          </p>
          <button
            v-if="canDelete(comment.userId)"
            type="button"
            class="-my-2 min-h-9 flex-none px-1 text-[13px] text-ink-muted underline"
            :class="confirming === comment.id ? 'font-semibold text-ink' : ''"
            @click="remove(comment.id)"
            @blur="confirming === comment.id && (confirming = null)"
          >
            {{ confirming === comment.id ? 'Vahvista poisto' : 'Poista' }}
          </button>
        </div>
        <p class="text-[15px] break-words whitespace-pre-line text-ink">{{ comment.body }}</p>
      </li>
    </ul>

    <form class="flex items-end gap-2" @submit.prevent="send">
      <label :for="inputId" class="sr-only">Kommentti</label>
      <textarea
        :id="inputId"
        v-model="draft"
        rows="1"
        :maxlength="COMMENT_MAX"
        placeholder="Kirjoita kommentti"
        class="field-sizing-content max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-(--radius-field) border border-line bg-bg px-3 py-2.5 text-base text-ink placeholder:text-ink-muted"
      />
      <button
        type="submit"
        :disabled="!canSend"
        class="min-h-11 flex-none rounded-(--radius-button) bg-action px-4 text-[15px] font-semibold text-on-action disabled:opacity-40"
      >
        {{ sending ? 'Lähetetään…' : 'Lähetä' }}
      </button>
    </form>
    <p v-if="draft.length > COMMENT_MAX - 50" class="text-ink-muted" data-numeric>
      {{ draft.length }} / {{ COMMENT_MAX }} merkkiä
    </p>
    <p v-if="error" role="alert" class="font-semibold">{{ error }}</p>
  </section>
</template>
