import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Elementin sisäleveys pikseleinä. Kaaviot piirretään tähän leveyteen, jolloin
 * teksti pysyy samankokoisena eikä kaavio jää kapeaksi leveämmällä näytöllä.
 */
export function useElementWidth(target: Ref<HTMLElement | null>, fallback = 300): Ref<number> {
  const width = ref(fallback)
  let observer: ResizeObserver | null = null

  onMounted(() => {
    if (!target.value) return
    width.value = target.value.clientWidth || fallback
    observer = new ResizeObserver(([entry]) => {
      width.value = Math.floor(entry.contentRect.width) || fallback
    })
    observer.observe(target.value)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return width
}
