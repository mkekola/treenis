import { ref, type Ref } from 'vue'

interface Drag {
  from: number
  to: number
  startY: number
  dy: number
  /** Raahattavan kohteen korkeus väleineen: muut kohteet väistävät tämän verran. */
  step: number
  /** Kohteiden keskikohdat raahauksen alussa. */
  middles: number[]
}

/**
 * Listan järjestys raahaamalla kahvasta. Lista on elementti, jonka suorat lapset ovat
 * järjestettävät kohteet. Raahattava kohde seuraa sormea, muut väistävät, ja irti
 * päästäessä onMove saa vanhan ja uuden paikan. Näppäimistöllä siirto on moveBy.
 */
export function useDragReorder(
  list: Readonly<Ref<HTMLElement | null>>,
  gapPx: number,
  onMove: (from: number, to: number) => void,
) {
  const drag = ref<Drag | null>(null)

  function start(index: number, event: PointerEvent) {
    if (!list.value) return
    const rects = [...list.value.children].map((el) => el.getBoundingClientRect())
    drag.value = {
      from: index,
      to: index,
      startY: event.clientY,
      dy: 0,
      step: rects[index].height + gapPx,
      middles: rects.map((r) => r.top + r.height / 2),
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent) {
    const d = drag.value
    if (!d) return
    d.dy = event.clientY - d.startY
    const middle = d.middles[d.from] + d.dy
    d.to = d.middles.filter((m, i) => i !== d.from && m < middle).length
  }

  function end() {
    const d = drag.value
    drag.value = null
    if (d && d.to !== d.from) onMove(d.from, d.to)
  }

  /** Raahattava kohde seuraa sormea, ja sen ja kohteen väliset kohteet väistävät. */
  function shift(index: number): string | undefined {
    const d = drag.value
    if (!d) return undefined
    if (index === d.from) return `translateY(${d.dy}px)`
    if (d.from < d.to && index > d.from && index <= d.to) return `translateY(${-d.step}px)`
    if (d.from > d.to && index >= d.to && index < d.from) return `translateY(${d.step}px)`
    return undefined
  }

  function moveBy(index: number, delta: -1 | 1, count: number) {
    const to = index + delta
    if (to >= 0 && to < count) onMove(index, to)
  }

  return { drag, start, move, end, shift, moveBy }
}
