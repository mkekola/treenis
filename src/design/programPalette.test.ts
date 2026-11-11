import { describe, expect, it } from 'vitest'
import { nextFreeColor, programColor, programVars } from '@/design/programPalette'

describe('ohjelmapaletti', () => {
  it('antaa uudelle ohjelmalle ensimmäisen vapaan värin', () => {
    expect(nextFreeColor([])).toBe('luumu')
    expect(nextFreeColor(['luumu', 'sammal'])).toBe('savi')
  })

  it('palaa oletusväriin, kun kaikki ovat käytössä tai väri on tuntematon', () => {
    const all = ['luumu', 'sammal', 'savi', 'muste', 'petrooli', 'okra', 'grafiitti']
    expect(nextFreeColor(all)).toBe('luumu')
    expect(programColor('ei-ole').id).toBe('luumu')
    expect(programColor(undefined).id).toBe('luumu')
  })

  it('käyttää tummassa teemassa nostettua sävyä', () => {
    expect(programVars('muste', false)['--program-surface']).toBe('#34436B')
    expect(programVars('muste', true)['--program-surface']).toBe('#4A5C8C')
  })
})
