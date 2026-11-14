import { describe, expect, it } from 'vitest'
import { myReaction, nextReaction, reactionLabel, reactionNames, summarizeReactions, type FeedRow } from './feed'

const me = 'me'
const reactions: FeedRow['reactions'] = [
  { reaction: 'fire', userId: 'anna', name: 'Anna' },
  { reaction: 'clap', userId: me, name: 'Maria' },
  { reaction: 'fire', userId: 'mikko', name: 'Mikko' },
  { reaction: 'fire', userId: 'outsider', name: null },
]

describe('reaktiot', () => {
  it('kokoaa annetut reaktiot valikon järjestyksessä', () => {
    const summary = summarizeReactions(reactions, me)
    expect(summary.map((s) => [s.key, s.count, s.mine])).toEqual([
      ['clap', 1, true],
      ['fire', 3, false],
    ])
  })

  it('näyttää tutut nimeltä, oman "Sinä" ja vieraat lukumääränä', () => {
    const [clap, fire] = summarizeReactions(reactions, me)
    expect(reactionLabel(clap)).toBe('Taputus: Sinä')
    expect(reactionLabel(fire)).toBe('Tulessa: Anna, Mikko ja 1 muu')
    expect(reactionNames(fire)).toBe('Anna, Mikko ja 1 muu')
  })

  it('oma reaktio on "Sinä", vaikka nimeä ei olisi asetettu', () => {
    const [fire] = summarizeReactions([{ reaction: 'fire', userId: me, name: null }], me)
    expect(reactionLabel(fire)).toBe('Tulessa: Sinä')
  })

  it('löytää oman reaktion', () => {
    expect(myReaction(reactions, me)).toBe('clap')
    expect(myReaction([], me)).toBeNull()
  })

  it('uusi reaktio korvaa vanhan, sama napautus poistaa', () => {
    expect(nextReaction(null, 'fire')).toBe('fire')
    expect(nextReaction('clap', 'fire')).toBe('fire')
    expect(nextReaction('fire', 'fire')).toBeNull()
  })
})
